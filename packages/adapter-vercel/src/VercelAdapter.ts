/**
 * Vercel Combined Adapter
 *
 * Combines Storage, Cache, and Blob adapters for convenience
 */

import type { CombinedAdapter } from '@wukong/agent';
import { VercelBlobAdapter, type VercelBlobAdapterConfig } from './VercelBlobAdapter.js';
import { VercelCacheAdapter, type VercelCacheAdapterConfig } from './VercelCacheAdapter.js';
import { VercelStorageAdapter, type VercelStorageAdapterConfig } from './VercelStorageAdapter.js';

export interface VercelAdapterConfig {
  /**
   * Postgres connection configuration
   */
  postgres: string | VercelStorageAdapterConfig;

  /**
   * KV configuration (optional, uses environment variables by default)
   */
  kv?: VercelCacheAdapterConfig;

  /**
   * Blob configuration (optional, uses environment variables by default)
   */
  blob?: VercelBlobAdapterConfig;
}

/**
 * Combined Vercel Adapter
 *
 * Provides all necessary adapters for Wukong in a single class
 */
export class VercelAdapter implements CombinedAdapter {
  private storageAdapter: VercelStorageAdapter;
  private cacheAdapter: VercelCacheAdapter;
  private blobAdapter: VercelBlobAdapter;

  constructor(config: VercelAdapterConfig) {
    // Initialize storage adapter
    const postgresConfig =
      typeof config.postgres === 'string' ? { postgresUrl: config.postgres } : config.postgres;
    this.storageAdapter = new VercelStorageAdapter(postgresConfig);

    // Initialize cache adapter
    this.cacheAdapter = new VercelCacheAdapter(config.kv || {});

    // Initialize blob adapter
    this.blobAdapter = new VercelBlobAdapter(config.blob || {});
  }

  // ==========================================
  // Storage Adapter Methods (delegated)
  // ==========================================

  async createSession(session: Parameters<VercelStorageAdapter['createSession']>[0]) {
    return await this.storageAdapter.createSession(session);
  }

  async getSession(sessionId: string) {
    return await this.storageAdapter.getSession(sessionId);
  }

  async updateSession(
    sessionId: string,
    updates: Parameters<VercelStorageAdapter['updateSession']>[1],
  ) {
    return await this.storageAdapter.updateSession(sessionId, updates);
  }

  async deleteSession(sessionId: string) {
    return await this.storageAdapter.deleteSession(sessionId);
  }

  async listSessions(filters: Parameters<VercelStorageAdapter['listSessions']>[0]) {
    return await this.storageAdapter.listSessions(filters);
  }

  async createStep(step: Parameters<VercelStorageAdapter['createStep']>[0]) {
    return await this.storageAdapter.createStep(step);
  }

  async getStep(stepId: number) {
    return await this.storageAdapter.getStep(stepId);
  }

  async updateStep(stepId: number, updates: Parameters<VercelStorageAdapter['updateStep']>[1]) {
    return await this.storageAdapter.updateStep(stepId, updates);
  }

  async listSteps(sessionId: string, filters?: Parameters<VercelStorageAdapter['listSteps']>[1]) {
    return await this.storageAdapter.listSteps(sessionId, filters);
  }

  async markStepsAsDiscarded(sessionId: string, stepIds: number[]) {
    return await this.storageAdapter.markStepsAsDiscarded(sessionId, stepIds);
  }

  async getLastStep(sessionId: string) {
    return await this.storageAdapter.getLastStep(sessionId);
  }

  async createTodo(todo: Parameters<VercelStorageAdapter['createTodo']>[0]) {
    return await this.storageAdapter.createTodo(todo);
  }

  async getTodo(todoId: string) {
    return await this.storageAdapter.getTodo(todoId);
  }

  async updateTodo(todoId: string, updates: Parameters<VercelStorageAdapter['updateTodo']>[1]) {
    return await this.storageAdapter.updateTodo(todoId, updates);
  }

  async deleteTodo(todoId: string) {
    return await this.storageAdapter.deleteTodo(todoId);
  }

  async listTodos(sessionId: string) {
    return await this.storageAdapter.listTodos(sessionId);
  }

  async batchCreateTodos(todos: Parameters<VercelStorageAdapter['batchCreateTodos']>[0]) {
    return await this.storageAdapter.batchCreateTodos(todos);
  }

  async batchUpdateTodos(updates: Parameters<VercelStorageAdapter['batchUpdateTodos']>[0]) {
    return await this.storageAdapter.batchUpdateTodos(updates);
  }

  async createCheckpoint(checkpoint: Parameters<VercelStorageAdapter['createCheckpoint']>[0]) {
    return await this.storageAdapter.createCheckpoint(checkpoint);
  }

  async getCheckpoint(checkpointId: string) {
    return await this.storageAdapter.getCheckpoint(checkpointId);
  }

  async listCheckpoints(sessionId: string) {
    return await this.storageAdapter.listCheckpoints(sessionId);
  }

  async deleteCheckpoint(checkpointId: string) {
    return await this.storageAdapter.deleteCheckpoint(checkpointId);
  }

  async transaction<T>(fn: (tx: import('@wukong/agent').StorageAdapter) => Promise<T>): Promise<T> {
    return await this.storageAdapter.transaction(fn);
  }

  // ==========================================
  // Cache Adapter Methods (delegated)
  // ==========================================

  async get<T = any>(key: string) {
    return await this.cacheAdapter.get<T>(key);
  }

  async set(
    key: string,
    value: Parameters<VercelCacheAdapter['set']>[1],
    options?: Parameters<VercelCacheAdapter['set']>[2],
  ) {
    return await this.cacheAdapter.set(key, value, options);
  }

  async delete(key: string) {
    return await this.cacheAdapter.delete(key);
  }

  async exists(key: string) {
    return await this.cacheAdapter.exists(key);
  }

  async increment(key: string, by?: number) {
    return await this.cacheAdapter.increment(key, by);
  }

  async decrement(key: string, by?: number) {
    return await this.cacheAdapter.decrement(key, by);
  }

  async expire(key: string, seconds: number) {
    return await this.cacheAdapter.expire(key, seconds);
  }

  async mget<T = any>(keys: string[]) {
    return await this.cacheAdapter.mget<T>(keys);
  }

  async mset(entries: Parameters<VercelCacheAdapter['mset']>[0]) {
    return await this.cacheAdapter.mset(entries);
  }

  async mdel(keys: string[]) {
    return await this.cacheAdapter.mdel(keys);
  }

  async keys(pattern: string) {
    return await this.cacheAdapter.keys(pattern);
  }

  async clear() {
    return await this.cacheAdapter.clear();
  }

  async queuePush(queueName: string, value: Parameters<VercelCacheAdapter['queuePush']>[1]) {
    return await this.cacheAdapter.queuePush(queueName, value);
  }

  async queuePop<T = any>(queueName: string) {
    return await this.cacheAdapter.queuePop<T>(queueName);
  }

  async queueLength(queueName: string) {
    return await this.cacheAdapter.queueLength(queueName);
  }

  async acquireLock(lockKey: string, ttlSeconds: number) {
    return await this.cacheAdapter.acquireLock(lockKey, ttlSeconds);
  }

  async releaseLock(lockKey: string) {
    return await this.cacheAdapter.releaseLock(lockKey);
  }

  async withLock<T>(lockKey: string, ttlSeconds: number, fn: () => Promise<T>) {
    return await this.cacheAdapter.withLock(lockKey, ttlSeconds, fn);
  }

  // ==========================================
  // Blob/Files Adapter Access
  // ==========================================

  get files() {
    return this.blobAdapter;
  }

  // Optional adapters (not implemented in base Vercel adapter)
  vector = undefined;
  llm = undefined;
  embedding = undefined;

  // ==========================================
  // Cleanup
  // ==========================================

  async close(): Promise<void> {
    // Vercel adapters don't require explicit cleanup
    // Connections are handled automatically
  }
}
