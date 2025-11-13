/**
 * Local Adapter
 *
 * Combined adapter that includes storage, cache, and files adapters
 */

import type {
  CacheOptions,
  CacheValue,
  Checkpoint,
  CombinedAdapter,
  FilesAdapter,
  Session,
  Step,
  StorageAdapter,
  Todo,
} from '@wukong/agent';
import { LocalCacheAdapter } from './LocalCacheAdapter.js';
import { LocalFilesAdapter } from './LocalFilesAdapter.js';
import { LocalStorageAdapter } from './LocalStorageAdapter.js';

export interface LocalAdapterConfig {
  /**
   * Path to SQLite database file
   * Use ':memory:' for in-memory database
   */
  dbPath: string;

  /**
   * Base directory for file storage
   * @default './data/files'
   */
  filesPath?: string;

  /**
   * Base URL for generating file URLs
   * @default 'file://'
   */
  filesBaseUrl?: string;

  /**
   * Enable WAL mode for better concurrency
   * @default true
   */
  enableWAL?: boolean;

  /**
   * Enable verbose mode for debugging
   * @default false
   */
  verbose?: boolean;
}

/**
 * Combined local adapter for development and local deployment
 *
 * Includes:
 * - StorageAdapter: SQLite with better-sqlite3
 * - CacheAdapter: In-memory cache
 * - FilesAdapter: Local file system
 */
export class LocalAdapter implements CombinedAdapter {
  private storageAdapter: LocalStorageAdapter;
  private cacheAdapter: LocalCacheAdapter;
  private filesAdapter: LocalFilesAdapter;

  public readonly files: FilesAdapter;

  constructor(config: LocalAdapterConfig) {
    // Initialize storage adapter
    this.storageAdapter = new LocalStorageAdapter({
      dbPath: config.dbPath,
      enableWAL: config.enableWAL,
      verbose: config.verbose,
    });

    // Initialize cache adapter
    this.cacheAdapter = new LocalCacheAdapter();

    // Initialize files adapter
    this.filesAdapter = new LocalFilesAdapter({
      basePath: config.filesPath || './data/files',
      baseUrl: config.filesBaseUrl,
    });

    this.files = this.filesAdapter;
  }

  // ==========================================
  // StorageAdapter Implementation
  // ==========================================

  async createSession(session: Omit<Session, 'id' | 'createdAt' | 'updatedAt'>): Promise<Session> {
    return await this.storageAdapter.createSession(session);
  }

  async getSession(sessionId: string): Promise<Session | null> {
    return await this.storageAdapter.getSession(sessionId);
  }

  async updateSession(sessionId: string, updates: Partial<Session>): Promise<Session> {
    return await this.storageAdapter.updateSession(sessionId, updates);
  }

  async deleteSession(sessionId: string): Promise<void> {
    return await this.storageAdapter.deleteSession(sessionId);
  }

  async listSessions(filters: {
    userId?: string;
    organizationId?: string;
    status?: Session['status'];
    limit?: number;
    offset?: number;
  }): Promise<{ sessions: Session[]; total: number }> {
    return await this.storageAdapter.listSessions(filters);
  }

  async createStep(step: Omit<Step, 'id' | 'createdAt' | 'updatedAt'>): Promise<Step> {
    return await this.storageAdapter.createStep(step);
  }

  async getStep(stepId: number): Promise<Step | null> {
    return await this.storageAdapter.getStep(stepId);
  }

  async updateStep(stepId: number, updates: Partial<Step>): Promise<Step> {
    return await this.storageAdapter.updateStep(stepId, updates);
  }

  async listSteps(
    sessionId: string,
    filters?: {
      includeDiscarded?: boolean;
      limit?: number;
      offset?: number;
    },
  ): Promise<Step[]> {
    return await this.storageAdapter.listSteps(sessionId, filters);
  }

  async markStepsAsDiscarded(sessionId: string, stepIds: number[]): Promise<void> {
    return await this.storageAdapter.markStepsAsDiscarded(sessionId, stepIds);
  }

  async getLastStep(sessionId: string): Promise<Step | null> {
    return await this.storageAdapter.getLastStep(sessionId);
  }

  async createTodo(todo: Omit<Todo, 'createdAt' | 'updatedAt'>): Promise<Todo> {
    return await this.storageAdapter.createTodo(todo);
  }

  async getTodo(todoId: string): Promise<Todo | null> {
    return await this.storageAdapter.getTodo(todoId);
  }

  async updateTodo(todoId: string, updates: Partial<Todo>): Promise<Todo> {
    return await this.storageAdapter.updateTodo(todoId, updates);
  }

  async deleteTodo(todoId: string): Promise<void> {
    return await this.storageAdapter.deleteTodo(todoId);
  }

  async listTodos(sessionId: string): Promise<Todo[]> {
    return await this.storageAdapter.listTodos(sessionId);
  }

  async batchCreateTodos(todos: Omit<Todo, 'createdAt' | 'updatedAt'>[]): Promise<Todo[]> {
    return await this.storageAdapter.batchCreateTodos(todos);
  }

  async batchUpdateTodos(updates: Array<{ id: string; updates: Partial<Todo> }>): Promise<Todo[]> {
    return await this.storageAdapter.batchUpdateTodos(updates);
  }

  async createCheckpoint(checkpoint: Omit<Checkpoint, 'id' | 'createdAt'>): Promise<Checkpoint> {
    return await this.storageAdapter.createCheckpoint(checkpoint);
  }

  async getCheckpoint(checkpointId: string): Promise<Checkpoint | null> {
    return await this.storageAdapter.getCheckpoint(checkpointId);
  }

  async listCheckpoints(sessionId: string): Promise<Checkpoint[]> {
    return await this.storageAdapter.listCheckpoints(sessionId);
  }

  async deleteCheckpoint(checkpointId: string): Promise<void> {
    return await this.storageAdapter.deleteCheckpoint(checkpointId);
  }

  async transaction<T>(fn: (tx: StorageAdapter) => Promise<T>): Promise<T> {
    return await this.storageAdapter.transaction(fn);
  }

  // ==========================================
  // CacheAdapter Implementation
  // ==========================================

  async get<T = CacheValue>(key: string): Promise<T | null> {
    return await this.cacheAdapter.get<T>(key);
  }

  async set(key: string, value: CacheValue, options?: CacheOptions): Promise<void> {
    return await this.cacheAdapter.set(key, value, options);
  }

  async delete(key: string): Promise<void> {
    return await this.cacheAdapter.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    return await this.cacheAdapter.exists(key);
  }

  async increment(key: string, by?: number): Promise<number> {
    return await this.cacheAdapter.increment(key, by);
  }

  async decrement(key: string, by?: number): Promise<number> {
    return await this.cacheAdapter.decrement(key, by);
  }

  async expire(key: string, seconds: number): Promise<void> {
    return await this.cacheAdapter.expire(key, seconds);
  }

  async mget<T = CacheValue>(keys: string[]): Promise<Array<T | null>> {
    return await this.cacheAdapter.mget<T>(keys);
  }

  async mset(
    entries: Array<{ key: string; value: CacheValue; options?: CacheOptions }>,
  ): Promise<void> {
    return await this.cacheAdapter.mset(entries);
  }

  async mdel(keys: string[]): Promise<void> {
    return await this.cacheAdapter.mdel(keys);
  }

  async keys(pattern: string): Promise<string[]> {
    return await this.cacheAdapter.keys(pattern);
  }

  async clear(): Promise<void> {
    return await this.cacheAdapter.clear();
  }

  async queuePush(queueName: string, value: CacheValue): Promise<void> {
    return await this.cacheAdapter.queuePush(queueName, value);
  }

  async queuePop<T = CacheValue>(queueName: string): Promise<T | null> {
    return await this.cacheAdapter.queuePop<T>(queueName);
  }

  async queueLength(queueName: string): Promise<number> {
    return await this.cacheAdapter.queueLength(queueName);
  }

  async acquireLock(lockKey: string, ttlSeconds: number): Promise<boolean> {
    return await this.cacheAdapter.acquireLock(lockKey, ttlSeconds);
  }

  async releaseLock(lockKey: string): Promise<void> {
    return await this.cacheAdapter.releaseLock(lockKey);
  }

  async withLock<T>(lockKey: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T> {
    return await this.cacheAdapter.withLock(lockKey, ttlSeconds, fn);
  }

  // ==========================================
  // Cleanup
  // ==========================================

  close(): Promise<void> {
    this.storageAdapter.close();
    this.cacheAdapter.close();
    this.filesAdapter.close();
    return Promise.resolve();
  }
}
