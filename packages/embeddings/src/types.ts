/**
 * @wukong/embeddings - Type definitions
 */

/**
 * Configuration for embedding generation
 */
export interface EmbeddingConfig {
  /**
   * API key for the embedding provider
   */
  apiKey: string;

  /**
   * Maximum number of texts to batch in a single request
   * @default 100
   */
  maxBatchSize?: number;

  /**
   * Maximum retries for failed requests
   * @default 3
   */
  maxRetries?: number;

  /**
   * Base delay in ms for exponential backoff
   * @default 1000
   */
  retryDelayMs?: number;

  /**
   * Custom API endpoint (optional)
   */
  baseURL?: string;
}

/**
 * Options for generating embeddings
 */
export interface EmbedOptions {
  /**
   * User identifier for tracking/rate limiting (optional)
   */
  user?: string;

  /**
   * Embedding dimensions (for models that support it)
   */
  dimensions?: number;
}

/**
 * Result of embedding generation
 */
export interface EmbeddingResult {
  /**
   * The embedding vector
   */
  embedding: number[];

  /**
   * The input text that was embedded
   */
  text: string;

  /**
   * Token count for the input
   */
  tokens?: number;
}

/**
 * Batch embedding result
 */
export interface BatchEmbeddingResult {
  /**
   * Array of embedding results
   */
  embeddings: EmbeddingResult[];

  /**
   * Total tokens used
   */
  totalTokens: number;

  /**
   * Model used for embeddings
   */
  model: string;
}

/**
 * Interface for embedding generators
 */
export interface EmbeddingGenerator {
  /**
   * Generate embedding for a single text
   */
  generate(text: string, options?: EmbedOptions): Promise<number[]>;

  /**
   * Generate embeddings for multiple texts in a batch
   */
  generateBatch(texts: string[], options?: EmbedOptions): Promise<BatchEmbeddingResult>;

  /**
   * Get the dimension of embeddings produced by this generator
   */
  getDimensions(): number;

  /**
   * Get the model identifier
   */
  getModel(): string;
}
