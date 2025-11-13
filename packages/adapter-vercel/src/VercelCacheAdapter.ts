/**
 * Vercel Cache Adapter
 *
 * Uses Vercel KV for temporary state and async task tracking
 */

import { kv } from '@vercel/kv';
import type { CacheAdapter, CacheOptions, CacheValue } from '@wukong/agent';

export interface VercelCacheAdapterConfig {
  /**
   * KV connection string
   * Usually from process.env.KV_REST_API_URL and KV_REST_API_TOKEN
   */
  kvUrl?: string;
  kvToken?: string;
}

export class VercelCacheAdapter implements CacheAdapter {
  constructor(config: VercelCacheAdapterConfig = {}) {
    // Connection is handled automatically by @vercel/kv
    // It uses environment variables KV_REST_API_URL and KV_REST_API_TOKEN
    // Store config if needed for future use
    if (config.kvUrl || config.kvToken) {
      // Config is used implicitly by @vercel/kv via environment
    }
  }

  // ==========================================
  // Basic Cache Operations
  // ==========================================

  async get<T = CacheValue>(key: string): Promise<T | null> {
    return await kv.get<T>(key);
  }

  async set(key: string, value: CacheValue, options?: CacheOptions): Promise<void> {
    if (options?.ttl) {
      await kv.set(key, value, { ex: options.ttl });
    } else {
      await kv.set(key, value);
    }
  }

  async delete(key: string): Promise<void> {
    await kv.del(key);
  }

  async exists(key: string): Promise<boolean> {
    const result = await kv.exists(key);
    return result === 1;
  }

  async increment(key: string, by = 1): Promise<number> {
    return await kv.incrby(key, by);
  }

  async decrement(key: string, by = 1): Promise<number> {
    return await kv.decrby(key, by);
  }

  async expire(key: string, seconds: number): Promise<void> {
    await kv.expire(key, seconds);
  }

  // ==========================================
  // Batch Operations
  // ==========================================

  async mget<T = CacheValue>(keys: string[]): Promise<Array<T | null>> {
    if (keys.length === 0) return [];

    // Vercel KV supports mget
    const values = await kv.mget(...keys);
    return values as Array<T | null>;
  }

  async mset(
    entries: Array<{ key: string; value: CacheValue; options?: CacheOptions }>,
  ): Promise<void> {
    // Vercel KV doesn't support mset with TTL, so we need to set them individually
    const promises = entries.map(({ key, value, options }) => this.set(key, value, options));
    await Promise.all(promises);
  }

  async mdel(keys: string[]): Promise<void> {
    if (keys.length === 0) return;

    await kv.del(...keys);
  }

  async keys(pattern: string): Promise<string[]> {
    // Vercel KV supports SCAN with pattern matching
    const keys: string[] = [];
    let cursor: string | number = 0;

    do {
      const result: [string | number, string[]] = await kv.scan(cursor, {
        match: pattern,
        count: 100,
      });
      cursor = result[0];
      keys.push(...result[1]);
    } while (cursor !== 0 && cursor !== '0');

    return keys;
  }

  async clear(): Promise<void> {
    // WARNING: This will delete ALL keys in the KV store
    // Use with extreme caution
    const allKeys = await this.keys('*');
    if (allKeys.length > 0) {
      await kv.del(...allKeys);
    }
  }

  // ==========================================
  // Queue Operations (for async tasks)
  // ==========================================

  async queuePush(queueName: string, value: CacheValue): Promise<void> {
    await kv.rpush(queueName, value);
  }

  async queuePop<T = CacheValue>(queueName: string): Promise<T | null> {
    const result = await kv.lpop<T>(queueName);
    return result;
  }

  async queueLength(queueName: string): Promise<number> {
    return await kv.llen(queueName);
  }

  // ==========================================
  // Lock Operations (for concurrency control)
  // ==========================================

  async acquireLock(lockKey: string, ttlSeconds: number): Promise<boolean> {
    // Use SET NX (set if not exists) with expiration
    const lockValue = `${Date.now()}_${Math.random()}`;
    const result = await kv.set(lockKey, lockValue, {
      nx: true,
      ex: ttlSeconds,
    });

    // Result is 'OK' if successful, null if key already exists
    return result !== null;
  }

  async releaseLock(lockKey: string): Promise<void> {
    await kv.del(lockKey);
  }

  async withLock<T>(lockKey: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T> {
    const maxRetries = 10;
    const retryDelayMs = 100;

    let acquired = false;
    let retries = 0;

    // Try to acquire lock with retries
    while (!acquired && retries < maxRetries) {
      acquired = await this.acquireLock(lockKey, ttlSeconds);

      if (!acquired) {
        retries++;
        await this.sleep(retryDelayMs * retries); // Exponential backoff
      }
    }

    if (!acquired) {
      throw new Error(`Failed to acquire lock: ${lockKey} after ${maxRetries} retries`);
    }

    try {
      // Execute the function
      return await fn();
    } finally {
      // Always release the lock
      await this.releaseLock(lockKey);
    }
  }

  // ==========================================
  // Helper Methods
  // ==========================================

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
