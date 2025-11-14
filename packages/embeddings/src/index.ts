/**
 * @wukong/embeddings - Embedding Generation
 * @description Vector embedding generation utilities for Wukong
 */

export const version = '0.1.0';

// Export types
export type {
  EmbeddingConfig,
  EmbeddingGenerator,
  EmbedOptions,
  EmbeddingResult,
  BatchEmbeddingResult,
} from './types';

// Export OpenAI implementation
export { OpenAIEmbeddings } from './OpenAIEmbeddings';
export type { OpenAIEmbeddingConfig } from './OpenAIEmbeddings';
