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
  ForkAgentTask,
  ParallelToolCall,
  Session,
  Step,
  StorageAdapter,
  Todo,
} from '@wukong/agent';
import { LocalCacheAdapter } from './LocalCacheAdapter.js';
import { LocalFilesAdapter } from './LocalFilesAdapter.js';
import { LocalStorageAdapter } from './LocalStorageAdapter.js';
import { LocalVectorAdapter, type LocalVectorAdapterConfig } from './LocalVectorAdapter.js';

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

  /**
   * Enable vector adapter (uses same database)
   * @default false
   */
  enableVector?: boolean | Omit<LocalVectorAdapterConfig, 'db'>;
}

/**
 * Combined local adapter for development and local deployment
 *
 * Includes:
 * - StorageAdapter: SQLite with better-sqlite3
 * - CacheAdapter: In-memory cache
 * - FilesAdapter: Local file system
 * - VectorAdapter: SQLite with BLOB storage (optional)
 */
export class LocalAdapter implements CombinedAdapter {
  private storageAdapter: LocalStorageAdapter;
  private cacheAdapter: LocalCacheAdapter;
  private filesAdapter: LocalFilesAdapter;
  private vectorAdapter?: LocalVectorAdapter;

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

    // Initialize vector adapter (optional)
    if (config.enableVector) {
      const vectorConfig =
        typeof config.enableVector === 'boolean'
          ? { db: this.storageAdapter.db }
          : { db: this.storageAdapter.db, ...config.enableVector };
      this.vectorAdapter = new LocalVectorAdapter(vectorConfig);
    }
  }

  get vector() {
    return this.vectorAdapter;
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

  async compressSteps(
    sessionId: string,
    compressions: Array<{ stepId: number; compressed: string }>,
  ): Promise<void> {
    return await this.storageAdapter.compressSteps(sessionId, compressions);
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

  async createParallelToolCall(
    call: Omit<ParallelToolCall, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<ParallelToolCall> {
    return await this.storageAdapter.createParallelToolCall(call);
  }

  async getParallelToolCall(callId: number): Promise<ParallelToolCall | null> {
    return await this.storageAdapter.getParallelToolCall(callId);
  }

  async updateParallelToolCall(
    callId: number,
    updates: Partial<ParallelToolCall>,
  ): Promise<ParallelToolCall> {
    return await this.storageAdapter.updateParallelToolCall(callId, updates);
  }

  async listParallelToolCalls(stepId: number): Promise<ParallelToolCall[]> {
    return await this.storageAdapter.listParallelToolCalls(stepId);
  }

  async createForkAgentTask(
    task: Omit<ForkAgentTask, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<ForkAgentTask> {
    return await this.storageAdapter.createForkAgentTask(task);
  }

  async getForkAgentTask(taskId: string): Promise<ForkAgentTask | null> {
    return await this.storageAdapter.getForkAgentTask(taskId);
  }

  async updateForkAgentTask(
    taskId: string,
    updates: Partial<ForkAgentTask>,
  ): Promise<ForkAgentTask> {
    return await this.storageAdapter.updateForkAgentTask(taskId, updates);
  }

  async listForkAgentTasks(sessionId: string): Promise<ForkAgentTask[]> {
    return await this.storageAdapter.listForkAgentTasks(sessionId);
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
