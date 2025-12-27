/**
 * @file OpenAIEmbeddings.ts
 * @input Depends on openai SDK, types.ts (EmbeddingGenerator interface)
 * @output Exports OpenAIEmbeddings class (implements EmbeddingGenerator), OpenAIEmbeddingConfig interface
 * @position Embedding provider - OpenAI embeddings API. Consumed by KnowledgeBaseManager.
 *
 * SYNC: When modified, update this header and /packages/embeddings/src/README.md
 *
 * @wukong/embeddings - OpenAI Embeddings
 */

import OpenAI from 'openai';
import type {
  BatchEmbeddingResult,
  EmbedOptions,
  EmbeddingConfig,
  EmbeddingGenerator,
} from './types';

/**
 * OpenAI-specific configuration
 */
export interface OpenAIEmbeddingConfig extends EmbeddingConfig {
  /**
   * Model to use for embeddings
   * @default 'text-embedding-3-small'
   */
  model?: string;

  /**
   * Organization ID (optional)
   */
  organization?: string;
}

/**
 * OpenAI embedding generator
 */
export class OpenAIEmbeddings implements EmbeddingGenerator {
  private client: OpenAI;
  private model: string;
  private maxBatchSize: number;
  private maxRetries: number;
  private retryDelayMs: number;
  private dimensions: number;

  constructor(config: OpenAIEmbeddingConfig) {
    if (!config.apiKey) {
      throw new Error('OpenAI API key is required');
    }

    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      organization: config.organization,
    });

    this.model = config.model || 'text-embedding-3-small';
    this.maxBatchSize = config.maxBatchSize || 100;
    this.maxRetries = config.maxRetries !== undefined ? config.maxRetries : 3;
    this.retryDelayMs = config.retryDelayMs || 1000;

    // Set dimensions based on model
    this.dimensions = this.getModelDimensions(this.model);
  }

  /**
   * Get embedding dimensions for a model
   */
  private getModelDimensions(model: string): number {
    const dimensionMap: Record<string, number> = {
      'text-embedding-3-small': 1536,
      'text-embedding-3-large': 3072,
      'text-embedding-ada-002': 1536,
    };
    return dimensionMap[model] || 1536;
  }

  /**
   * Generate embedding for a single text
   */
  async generate(text: string, options?: EmbedOptions): Promise<number[]> {
    const result = await this.generateBatch([text], options);
    const firstEmbedding = result.embeddings[0];
    if (!firstEmbedding) {
      throw new Error('No embedding returned from API');
    }
    return firstEmbedding.embedding;
  }

  /**
   * Generate embeddings for multiple texts in a batch
   */
  async generateBatch(texts: string[], options?: EmbedOptions): Promise<BatchEmbeddingResult> {
    if (texts.length === 0) {
      throw new Error('At least one text is required');
    }

    // Process in batches if needed
    if (texts.length > this.maxBatchSize) {
      return await this.processBatches(texts, options);
    }

    // Single batch
    return await this.processSingleBatch(texts, options);
  }

  /**
   * Process multiple batches
   */
  private async processBatches(
    texts: string[],
    options?: EmbedOptions,
  ): Promise<BatchEmbeddingResult> {
    const results: BatchEmbeddingResult[] = [];

    for (let i = 0; i < texts.length; i += this.maxBatchSize) {
      const batch = texts.slice(i, i + this.maxBatchSize);
      const result = await this.processSingleBatch(batch, options);
      results.push(result);
    }

    // Combine results
    const allEmbeddings = results.flatMap((r) => r.embeddings);
    const totalTokens = results.reduce((sum, r) => sum + r.totalTokens, 0);

    return {
      embeddings: allEmbeddings,
      totalTokens,
      model: this.model,
    };
  }

  /**
   * Process a single batch with retry logic
   */
  private async processSingleBatch(
    texts: string[],
    options?: EmbedOptions,
  ): Promise<BatchEmbeddingResult> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await this.client.embeddings.create({
          model: this.model,
          input: texts,
          user: options?.user,
          dimensions: options?.dimensions,
        });

        // Map response to our format
        const embeddings = response.data.map((item, index) => ({
          embedding: item.embedding,
          text: texts[index] || '',
          tokens: undefined, // OpenAI doesn't provide per-text token count
        }));

        return {
          embeddings,
          totalTokens: response.usage.total_tokens,
          model: this.model,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Check if error is retryable
        if (!this.isRetryableError(lastError)) {
          throw lastError;
        }

        // Don't retry on last attempt
        if (attempt === this.maxRetries) {
          break;
        }

        // Exponential backoff
        const delay = this.retryDelayMs * 2 ** attempt;
        await this.sleep(delay);
      }
    }

    throw new Error(
      `Failed to generate embeddings after ${this.maxRetries + 1} attempts: ${lastError?.message}`,
    );
  }

  /**
   * Check if an error is retryable
   */
  private isRetryableError(error: Error): boolean {
    const message = error.message.toLowerCase();

    // Rate limit errors
    if (message.includes('rate limit') || message.includes('429')) {
      return true;
    }

    // Timeout errors
    if (message.includes('timeout') || message.includes('timed out')) {
      return true;
    }

    // Network errors
    if (
      message.includes('network') ||
      message.includes('econnreset') ||
      message.includes('enotfound')
    ) {
      return true;
    }

    // Server errors (5xx)
    if (message.includes('500') || message.includes('503')) {
      return true;
    }

    return false;
  }

  /**
   * Sleep for a duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get the dimension of embeddings
   */
  getDimensions(): number {
    return this.dimensions;
  }

  /**
   * Get the model identifier
   */
  getModel(): string {
    return this.model;
  }
}
