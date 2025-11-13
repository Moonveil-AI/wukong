/**
 * Local Cache Adapter
 *
 * In-memory cache implementation for local development
 */

import type { CacheAdapter, CacheOptions, CacheValue } from '@wukong/agent';

interface CacheEntry {
  value: CacheValue;
  expiresAt?: number;
}

interface QueueEntry {
  items: CacheValue[];
}

export class LocalCacheAdapter implements CacheAdapter {
  private cache: Map<string, CacheEntry> = new Map();
  private queues: Map<string, QueueEntry> = new Map();
  private locks: Map<string, number> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Start cleanup interval to remove expired entries
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpired();
    }, 60000); // Run every minute
  }

  // ==========================================
  // Basic Cache Operations
  // ==========================================

  get<T = CacheValue>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);

    if (!entry) return Promise.resolve(null);

    // Check if expired
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      return Promise.resolve(null);
    }

    return Promise.resolve(entry.value as T);
  }

  set(key: string, value: CacheValue, options?: CacheOptions): Promise<void> {
    // Check if key exists and overwrite is disabled
    if (options?.overwrite === false && this.cache.has(key)) {
      return Promise.resolve();
    }

    const expiresAt = options?.ttl ? Date.now() + options.ttl * 1000 : undefined;

    this.cache.set(key, { value, expiresAt });
    return Promise.resolve();
  }

  delete(key: string): Promise<void> {
    this.cache.delete(key);
    return Promise.resolve();
  }

  exists(key: string): Promise<boolean> {
    const entry = this.cache.get(key);

    if (!entry) return Promise.resolve(false);

    // Check if expired
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      return Promise.resolve(false);
    }

    return Promise.resolve(true);
  }

  async increment(key: string, by = 1): Promise<number> {
    const current = await this.get<number>(key);
    const newValue = (current || 0) + by;

    await this.set(key, newValue);
    return newValue;
  }

  async decrement(key: string, by = 1): Promise<number> {
    const current = await this.get<number>(key);
    const newValue = (current || 0) - by;

    await this.set(key, newValue);
    return newValue;
  }

  expire(key: string, seconds: number): Promise<void> {
    const entry = this.cache.get(key);

    if (!entry) return Promise.resolve();

    entry.expiresAt = Date.now() + seconds * 1000;
    this.cache.set(key, entry);
    return Promise.resolve();
  }

  // ==========================================
  // Batch Operations
  // ==========================================

  async mget<T = CacheValue>(keys: string[]): Promise<Array<T | null>> {
    return Promise.all(keys.map((key) => this.get<T>(key)));
  }

  async mset(
    entries: Array<{ key: string; value: CacheValue; options?: CacheOptions }>,
  ): Promise<void> {
    await Promise.all(entries.map(({ key, value, options }) => this.set(key, value, options)));
  }

  mdel(keys: string[]): Promise<void> {
    for (const key of keys) {
      this.cache.delete(key);
    }
    return Promise.resolve();
  }

  // ==========================================
  // Key Pattern Matching
  // ==========================================

  keys(pattern: string): Promise<string[]> {
    const regex = this.patternToRegex(pattern);
    const matchingKeys: string[] = [];

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        // Check if not expired
        const entry = this.cache.get(key);
        if (entry && (!entry.expiresAt || entry.expiresAt >= Date.now())) {
          matchingKeys.push(key);
        }
      }
    }

    return Promise.resolve(matchingKeys);
  }

  clear(): Promise<void> {
    this.cache.clear();
    this.queues.clear();
    this.locks.clear();
    return Promise.resolve();
  }

  // ==========================================
  // Queue Operations
  // ==========================================

  queuePush(queueName: string, value: CacheValue): Promise<void> {
    const queue = this.queues.get(queueName) || { items: [] };
    queue.items.push(value);
    this.queues.set(queueName, queue);
    return Promise.resolve();
  }

  queuePop<T = CacheValue>(queueName: string): Promise<T | null> {
    const queue = this.queues.get(queueName);

    if (!queue || queue.items.length === 0) {
      return Promise.resolve(null);
    }

    const value = queue.items.shift() as T;

    if (queue.items.length === 0) {
      this.queues.delete(queueName);
    } else {
      this.queues.set(queueName, queue);
    }

    return Promise.resolve(value);
  }

  queueLength(queueName: string): Promise<number> {
    const queue = this.queues.get(queueName);
    return Promise.resolve(queue ? queue.items.length : 0);
  }

  // ==========================================
  // Lock Operations
  // ==========================================

  acquireLock(lockKey: string, ttlSeconds: number): Promise<boolean> {
    const now = Date.now();
    const existingLock = this.locks.get(lockKey);

    // Check if lock exists and is still valid
    if (existingLock && existingLock > now) {
      return Promise.resolve(false);
    }

    // Acquire lock
    const expiresAt = now + ttlSeconds * 1000;
    this.locks.set(lockKey, expiresAt);

    return Promise.resolve(true);
  }

  releaseLock(lockKey: string): Promise<void> {
    this.locks.delete(lockKey);
    return Promise.resolve();
  }

  async withLock<T>(lockKey: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T> {
    // Try to acquire lock with retries
    const maxRetries = 10;
    const retryDelay = 100; // ms

    let acquired = false;
    for (let i = 0; i < maxRetries; i++) {
      acquired = await this.acquireLock(lockKey, ttlSeconds);
      if (acquired) break;

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }

    if (!acquired) {
      throw new Error(`Failed to acquire lock: ${lockKey}`);
    }

    try {
      return await fn();
    } finally {
      await this.releaseLock(lockKey);
    }
  }

  // ==========================================
  // Helper Methods
  // ==========================================

  /**
   * Convert glob pattern to regex
   */
  private patternToRegex(pattern: string): RegExp {
    // Convert glob pattern to regex
    // * matches any characters except /
    // ? matches a single character
    // ** matches any characters including /

    const regexStr = pattern.replace(/\./g, '\\.').replace(/\*/g, '[^/]*').replace(/\?/g, '.');

    return new RegExp(`^${regexStr}$`);
  }

  /**
   * Clean up expired entries
   */
  private cleanupExpired(): void {
    const now = Date.now();

    // Clean up cache entries
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt && entry.expiresAt < now) {
        this.cache.delete(key);
      }
    }

    // Clean up expired locks
    for (const [key, expiresAt] of this.locks.entries()) {
      if (expiresAt < now) {
        this.locks.delete(key);
      }
    }
  }

  /**
   * Stop cleanup interval and cleanup resources
   */
  close(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    this.cache.clear();
    this.queues.clear();
    this.locks.clear();
  }
}
