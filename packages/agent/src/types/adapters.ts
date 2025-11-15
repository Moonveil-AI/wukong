/**
 * Adapter interface definitions for the Wukong Agent system
 *
 * These interfaces define the contracts for different storage and service adapters,
 * allowing the system to work with different backends (Vercel, Local, AWS, etc.)
 */

import type { Checkpoint, ForkAgentTask, ParallelToolCall, Session, Step, Todo } from './index';

// ==========================================
// Storage Adapter
// ==========================================

/**
 * Storage adapter for persisting sessions, steps, and todos
 *
 * Implementations: VercelStorageAdapter, LocalStorageAdapter
 */
export interface StorageAdapter {
  // ==========================================
  // Session Operations
  // ==========================================

  /**
   * Create a new session
   */
  createSession(session: Omit<Session, 'id' | 'createdAt' | 'updatedAt'>): Promise<Session>;

  /**
   * Get a session by ID
   */
  getSession(sessionId: string): Promise<Session | null>;

  /**
   * Update a session
   */
  updateSession(sessionId: string, updates: Partial<Session>): Promise<Session>;

  /**
   * Delete a session (soft delete)
   */
  deleteSession(sessionId: string): Promise<void>;

  /**
   * List sessions for a user
   */
  listSessions(filters: {
    userId?: string;
    organizationId?: string;
    status?: Session['status'];
    limit?: number;
    offset?: number;
  }): Promise<{ sessions: Session[]; total: number }>;

  // ==========================================
  // Step Operations
  // ==========================================

  /**
   * Create a new step
   */
  createStep(step: Omit<Step, 'id' | 'createdAt' | 'updatedAt'>): Promise<Step>;

  /**
   * Get a step by ID
   */
  getStep(stepId: number): Promise<Step | null>;

  /**
   * Update a step
   */
  updateStep(stepId: number, updates: Partial<Step>): Promise<Step>;

  /**
   * List steps for a session
   */
  listSteps(
    sessionId: string,
    filters?: {
      includeDiscarded?: boolean;
      limit?: number;
      offset?: number;
    },
  ): Promise<Step[]>;

  /**
   * Mark steps as discarded
   */
  markStepsAsDiscarded(sessionId: string, stepIds: number[]): Promise<void>;

  /**
   * Compress steps with LLM-provided compressed content
   */
  compressSteps(
    sessionId: string,
    compressions: Array<{ stepId: number; compressed: string }>,
  ): Promise<void>;

  /**
   * Get the last step for a session
   */
  getLastStep(sessionId: string): Promise<Step | null>;

  // ==========================================
  // Todo Operations
  // ==========================================

  /**
   * Create a new todo
   */
  createTodo(todo: Omit<Todo, 'createdAt' | 'updatedAt'>): Promise<Todo>;

  /**
   * Get a todo by ID
   */
  getTodo(todoId: string): Promise<Todo | null>;

  /**
   * Update a todo
   */
  updateTodo(todoId: string, updates: Partial<Todo>): Promise<Todo>;

  /**
   * Delete a todo
   */
  deleteTodo(todoId: string): Promise<void>;

  /**
   * List todos for a session
   */
  listTodos(sessionId: string): Promise<Todo[]>;

  /**
   * Batch create todos
   */
  batchCreateTodos(todos: Omit<Todo, 'createdAt' | 'updatedAt'>[]): Promise<Todo[]>;

  /**
   * Batch update todos
   */
  batchUpdateTodos(updates: Array<{ id: string; updates: Partial<Todo> }>): Promise<Todo[]>;

  // ==========================================
  // Parallel Tool Call Operations
  // ==========================================

  /**
   * Create a parallel tool call
   */
  createParallelToolCall(
    call: Omit<ParallelToolCall, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<ParallelToolCall>;

  /**
   * Get a parallel tool call by ID
   */
  getParallelToolCall(callId: number): Promise<ParallelToolCall | null>;

  /**
   * Update a parallel tool call
   */
  updateParallelToolCall(
    callId: number,
    updates: Partial<ParallelToolCall>,
  ): Promise<ParallelToolCall>;

  /**
   * List parallel tool calls for a step
   */
  listParallelToolCalls(stepId: number): Promise<ParallelToolCall[]>;

  // ==========================================
  // Fork Agent Task Operations
  // ==========================================

  /**
   * Create a fork agent task
   */
  createForkAgentTask(
    task: Omit<ForkAgentTask, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<ForkAgentTask>;

  /**
   * Get a fork agent task by ID
   */
  getForkAgentTask(taskId: string): Promise<ForkAgentTask | null>;

  /**
   * Update a fork agent task
   */
  updateForkAgentTask(taskId: string, updates: Partial<ForkAgentTask>): Promise<ForkAgentTask>;

  /**
   * List fork agent tasks for a session
   */
  listForkAgentTasks(sessionId: string): Promise<ForkAgentTask[]>;

  // ==========================================
  // Checkpoint Operations
  // ==========================================

  /**
   * Create a checkpoint
   */
  createCheckpoint(checkpoint: Omit<Checkpoint, 'id' | 'createdAt'>): Promise<Checkpoint>;

  /**
   * Get a checkpoint by ID
   */
  getCheckpoint(checkpointId: string): Promise<Checkpoint | null>;

  /**
   * List checkpoints for a session
   */
  listCheckpoints(sessionId: string): Promise<Checkpoint[]>;

  /**
   * Delete a checkpoint
   */
  deleteCheckpoint(checkpointId: string): Promise<void>;

  // ==========================================
  // Transaction Support
  // ==========================================

  /**
   * Execute operations in a transaction
   */
  transaction<T>(fn: (tx: StorageAdapter) => Promise<T>): Promise<T>;
}

// ==========================================
// Cache Adapter
// ==========================================

/**
 * Cache value type
 */
export type CacheValue = string | number | boolean | object | null;

/**
 * Cache options
 */
export interface CacheOptions {
  /** Time-to-live in seconds */
  ttl?: number;

  /** Whether to overwrite existing value */
  overwrite?: boolean;
}

/**
 * Cache adapter for temporary state and async task tracking
 *
 * Implementations: VercelKVAdapter, LocalCacheAdapter (in-memory)
 */
export interface CacheAdapter {
  /**
   * Get a value from cache
   */
  get<T = CacheValue>(key: string): Promise<T | null>;

  /**
   * Set a value in cache
   */
  set(key: string, value: CacheValue, options?: CacheOptions): Promise<void>;

  /**
   * Delete a value from cache
   */
  delete(key: string): Promise<void>;

  /**
   * Check if a key exists
   */
  exists(key: string): Promise<boolean>;

  /**
   * Increment a numeric value
   */
  increment(key: string, by?: number): Promise<number>;

  /**
   * Decrement a numeric value
   */
  decrement(key: string, by?: number): Promise<number>;

  /**
   * Set expiry time for a key
   */
  expire(key: string, seconds: number): Promise<void>;

  /**
   * Get multiple values at once
   */
  mget<T = CacheValue>(keys: string[]): Promise<Array<T | null>>;

  /**
   * Set multiple values at once
   */
  mset(entries: Array<{ key: string; value: CacheValue; options?: CacheOptions }>): Promise<void>;

  /**
   * Delete multiple keys at once
   */
  mdel(keys: string[]): Promise<void>;

  /**
   * List keys matching a pattern
   */
  keys(pattern: string): Promise<string[]>;

  /**
   * Clear all cache (use with caution)
   */
  clear(): Promise<void>;

  // ==========================================
  // Queue Operations (for async tasks)
  // ==========================================

  /**
   * Push to a queue
   */
  queuePush(queueName: string, value: CacheValue): Promise<void>;

  /**
   * Pop from a queue
   */
  queuePop<T = CacheValue>(queueName: string): Promise<T | null>;

  /**
   * Get queue length
   */
  queueLength(queueName: string): Promise<number>;

  // ==========================================
  // Lock Operations (for concurrency control)
  // ==========================================

  /**
   * Acquire a lock
   * @returns true if lock was acquired, false otherwise
   */
  acquireLock(lockKey: string, ttlSeconds: number): Promise<boolean>;

  /**
   * Release a lock
   */
  releaseLock(lockKey: string): Promise<void>;

  /**
   * Execute function with lock
   */
  withLock<T>(lockKey: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T>;
}

// ==========================================
// Files Adapter
// ==========================================

/**
 * File metadata
 */
export interface FileMetadata {
  /** File name */
  name: string;

  /** File size in bytes */
  size: number;

  /** MIME type */
  contentType: string;

  /** Upload timestamp */
  uploadedAt: Date;

  /** Additional metadata */
  [key: string]: any;
}

/**
 * File upload options
 */
export interface FileUploadOptions {
  /** Content type */
  contentType?: string;

  /** Whether file is publicly accessible */
  public?: boolean;

  /** Cache control header */
  cacheControl?: string;

  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * Files adapter for file storage and retrieval
 *
 * Implementations: VercelBlobAdapter, LocalFilesAdapter
 */
export interface FilesAdapter {
  /**
   * Upload a file
   */
  upload(
    path: string,
    content: Buffer | string | Blob,
    options?: FileUploadOptions,
  ): Promise<{ url: string; metadata: FileMetadata }>;

  /**
   * Download a file
   */
  download(path: string): Promise<{ content: Buffer; metadata: FileMetadata }>;

  /**
   * Get file metadata
   */
  getMetadata(path: string): Promise<FileMetadata | null>;

  /**
   * Delete a file
   */
  delete(path: string): Promise<void>;

  /**
   * List files in a directory
   */
  list(prefix: string): Promise<Array<{ path: string; metadata: FileMetadata }>>;

  /**
   * Check if file exists
   */
  exists(path: string): Promise<boolean>;

  /**
   * Copy a file
   */
  copy(sourcePath: string, destinationPath: string): Promise<void>;

  /**
   * Move a file
   */
  move(sourcePath: string, destinationPath: string): Promise<void>;

  /**
   * Get a signed URL for temporary access
   */
  getSignedUrl(path: string, expiresIn: number): Promise<string>;
}

// ==========================================
// Vector Adapter
// ==========================================

/**
 * Vector embedding
 */
export type Vector = number[];

/**
 * Vector metadata
 */
export interface VectorMetadata {
  /** Content text */
  content: string;

  /** Source document */
  source?: string;

  /** Document title */
  title?: string;

  /** Knowledge level */
  level: 'public' | 'organization' | 'individual';

  /** User ID (for individual knowledge) */
  userId?: string;

  /** Organization ID (for organization knowledge) */
  organizationId?: string;

  /** Session ID (if extracted from session) */
  sessionId?: string;

  /** Created timestamp */
  createdAt: Date;

  /** Additional metadata */
  [key: string]: any;
}

/**
 * Vector upsert options
 */
export interface VectorUpsertOptions {
  /** Metadata */
  metadata: VectorMetadata;

  /** Whether to update if exists */
  update?: boolean;
}

/**
 * Vector search filters
 */
export interface VectorSearchFilters {
  /** User ID filter */
  userId?: string;

  /** Organization ID filter */
  organizationId?: string;

  /** Knowledge level filter */
  level?: 'public' | 'organization' | 'individual';

  /** Session ID filter */
  sessionId?: string;

  /** Custom metadata filters */
  metadata?: Record<string, any>;
}

/**
 * Vector search options
 */
export interface VectorSearchOptions {
  /** Number of results to return */
  topK?: number;

  /** Minimum similarity score (0-1) */
  minScore?: number;

  /** Filters */
  filters?: VectorSearchFilters;

  /** Include vectors in results */
  includeVectors?: boolean;
}

/**
 * Vector search result
 */
export interface VectorSearchResult {
  /** Document ID */
  id: string;

  /** Similarity score (0-1) */
  score: number;

  /** Vector embedding (if includeVectors is true) */
  vector?: Vector;

  /** Metadata */
  metadata: VectorMetadata;
}

/**
 * Vector adapter for semantic search
 *
 * Implementations: VercelVectorAdapter (pgvector), PineconeAdapter, etc.
 */
export interface VectorAdapter {
  /**
   * Upsert a vector
   */
  upsert(id: string, vector: Vector, options: VectorUpsertOptions): Promise<void>;

  /**
   * Batch upsert vectors
   */
  batchUpsert(
    vectors: Array<{ id: string; vector: Vector; options: VectorUpsertOptions }>,
  ): Promise<void>;

  /**
   * Search for similar vectors
   */
  search(queryVector: Vector, options?: VectorSearchOptions): Promise<VectorSearchResult[]>;

  /**
   * Get a vector by ID
   */
  get(id: string): Promise<{ vector: Vector; metadata: VectorMetadata } | null>;

  /**
   * Delete a vector
   */
  delete(id: string): Promise<void>;

  /**
   * Delete multiple vectors
   */
  batchDelete(ids: string[]): Promise<void>;

  /**
   * Delete vectors matching filters
   */
  deleteByFilter(filters: VectorSearchFilters): Promise<number>;

  /**
   * Update vector metadata
   */
  updateMetadata(id: string, metadata: Partial<VectorMetadata>): Promise<void>;

  /**
   * List all vector IDs (paginated)
   */
  listIds(options?: { limit?: number; offset?: number }): Promise<{ ids: string[]; total: number }>;

  /**
   * Get collection statistics
   */
  getStats(): Promise<{
    totalVectors: number;
    dimensions: number;
    indexStatus: 'ready' | 'building' | 'error';
  }>;
}

// ==========================================
// LLM Adapter
// ==========================================

/**
 * LLM model configuration
 */
export interface LLMModelConfig {
  /** Model name */
  model: string;

  /** Temperature (0-1) */
  temperature?: number;

  /** Max tokens to generate */
  maxTokens?: number;

  /** Top P sampling */
  topP?: number;

  /** Frequency penalty */
  frequencyPenalty?: number;

  /** Presence penalty */
  presencePenalty?: number;

  /** Stop sequences */
  stop?: string[];
}

/**
 * LLM message
 */
export interface LLMMessage {
  /** Role */
  role: 'system' | 'user' | 'assistant';

  /** Content */
  content: string;
}

/**
 * LLM streaming options
 */
export interface LLMStreamingOptions {
  /** Callback for each chunk */
  onChunk?: (chunk: string) => void;

  /** Callback when streaming completes */
  onComplete?: (fullText: string) => void;

  /** Callback for errors */
  onError?: (error: Error) => void;
}

/**
 * LLM call options
 */
export interface LLMCallOptions extends LLMModelConfig {
  /** Messages (if using chat format) */
  messages?: LLMMessage[];

  /** Streaming options */
  streaming?: LLMStreamingOptions;

  /** Timeout in seconds */
  timeout?: number;

  /** Number of retries */
  retries?: number;
}

/**
 * LLM response
 */
export interface LLMCallResponse {
  /** Response text */
  text: string;

  /** Token usage */
  tokensUsed: {
    prompt: number;
    completion: number;
    total: number;
  };

  /** Model used */
  model: string;

  /** Response time in ms */
  responseTimeMs: number;

  /** Finish reason */
  finishReason: 'stop' | 'length' | 'error';
}

/**
 * LLM adapter for calling language models
 *
 * Implementations: OpenAILLMAdapter, GeminiLLMAdapter, AnthropicLLMAdapter
 */
export interface LLMAdapter {
  /**
   * Call the LLM with a prompt
   */
  call(prompt: string, options?: LLMCallOptions): Promise<LLMCallResponse>;

  /**
   * Call the LLM with messages (chat format)
   */
  callWithMessages(messages: LLMMessage[], options?: LLMCallOptions): Promise<LLMCallResponse>;

  /**
   * Call the LLM with streaming
   */
  callWithStreaming(
    prompt: string,
    options: LLMCallOptions & { streaming: LLMStreamingOptions },
  ): Promise<LLMCallResponse>;

  /**
   * Count tokens in a text
   */
  countTokens(text: string): Promise<number>;

  /**
   * Get model capabilities
   */
  getCapabilities(): {
    maxTokens: number;
    supportsStreaming: boolean;
    supportsFunctionCalling: boolean;
    supportsVision: boolean;
  };
}

// ==========================================
// Embedding Adapter
// ==========================================

/**
 * Embedding options
 */
export interface EmbeddingOptions {
  /** Model to use */
  model?: string;

  /** Batch size for batch operations */
  batchSize?: number;
}

/**
 * Embedding result
 */
export interface EmbeddingResult {
  /** Embedding vector */
  embedding: Vector;

  /** Model used */
  model: string;

  /** Tokens used */
  tokensUsed: number;
}

/**
 * Embedding adapter for generating vector embeddings
 *
 * Implementations: OpenAIEmbeddingAdapter, LocalEmbeddingAdapter
 */
export interface EmbeddingAdapter {
  /**
   * Generate embedding for a single text
   */
  generate(text: string, options?: EmbeddingOptions): Promise<EmbeddingResult>;

  /**
   * Generate embeddings for multiple texts (batched)
   */
  batchGenerate(texts: string[], options?: EmbeddingOptions): Promise<EmbeddingResult[]>;

  /**
   * Get embedding dimensions
   */
  getDimensions(): number;

  /**
   * Get model name
   */
  getModel(): string;
}

// ==========================================
// Combined Adapter (for convenience)
// ==========================================

/**
 * Combined adapter that includes all common adapters
 * Used by official adapters like VercelAdapter, LocalAdapter
 */
export interface CombinedAdapter extends StorageAdapter, CacheAdapter {
  /** Files adapter (optional) */
  files?: FilesAdapter;

  /** Vector adapter (optional) */
  vector?: VectorAdapter;

  /** LLM adapter (optional) */
  llm?: LLMAdapter;

  /** Embedding adapter (optional) */
  embedding?: EmbeddingAdapter;

  /**
   * Close/cleanup adapter connections
   */
  close(): Promise<void>;
}
