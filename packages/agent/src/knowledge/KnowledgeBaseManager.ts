/**
 * @file KnowledgeBaseManager.ts
 * @input Depends on @wukong/documents (DocumentProcessor, DocumentChunker), @wukong/embeddings (EmbeddingGenerator), types/adapters (VectorAdapter, FilesAdapter)
 * @output Exports KnowledgeBaseManager class, KnowledgeBaseManagerOptions, IndexDocumentsOptions interfaces
 * @position Knowledge base orchestration - coordinates document processing, embedding, and vector storage. Consumed by WukongAgent.
 *
 * SYNC: When modified, update this header and /packages/agent/src/README.md
 *
 * Knowledge Base Manager
 *
 * High-level interface for indexing and searching knowledge.
 * Coordinates document processing, embedding generation, and vector storage.
 */

import type { DocumentChunker, DocumentProcessor } from '@wukong/documents';
import type { EmbeddingGenerator } from '@wukong/embeddings';
import type {
  EmbeddingAdapter,
  FilesAdapter,
  Vector,
  VectorAdapter,
  VectorMetadata,
  VectorSearchFilters,
  VectorSearchOptions,
  VectorSearchResult,
} from '../types/adapters';

/**
 * Knowledge base manager options
 */
export interface KnowledgeBaseManagerOptions {
  /** Files adapter for reading documents */
  filesAdapter: FilesAdapter;

  /** Vector adapter for storing and searching embeddings */
  vectorAdapter: VectorAdapter;

  /** Embedding generator */
  embeddingGenerator: EmbeddingGenerator;

  /** Document processor (optional, will create default if not provided) */
  documentProcessor?: DocumentProcessor;

  /** Document chunker (optional, will create default if not provided) */
  documentChunker?: DocumentChunker;

  /** Embedding adapter (optional, alternative to embedding generator) */
  embeddingAdapter?: EmbeddingAdapter;

  /** Batch size for embedding generation */
  batchSize?: number;

  /** Enable caching of search results */
  enableCache?: boolean;

  /** Cache TTL in seconds */
  cacheTTL?: number;
}

/**
 * Document indexing options
 */
export interface IndexDocumentsOptions {
  /** Path/prefix to scan for documents */
  path: string;

  /** File patterns to include (glob patterns) */
  includes?: string[];

  /** File patterns to exclude (glob patterns) */
  excludes?: string[];

  /** Knowledge level for indexed documents */
  level?: 'public' | 'organization' | 'individual';

  /** User ID (for individual knowledge) */
  userId?: string;

  /** Organization ID (for organization knowledge) */
  organizationId?: string;

  /** Session ID (if indexing from a session) */
  sessionId?: string;

  /** Whether to update existing documents */
  update?: boolean;

  /** Progress callback */
  onProgress?: (progress: IndexingProgress) => void;
}

/**
 * Indexing progress information
 */
export interface IndexingProgress {
  /** Total files found */
  totalFiles: number;

  /** Files processed so far */
  filesProcessed: number;

  /** Total chunks created */
  totalChunks: number;

  /** Chunks indexed so far */
  chunksIndexed: number;

  /** Current file being processed */
  currentFile?: string;

  /** Current status */
  status: 'scanning' | 'processing' | 'embedding' | 'storing' | 'complete' | 'error';

  /** Error message if status is 'error' */
  error?: string;
}

/**
 * Search options
 */
export interface SearchOptions {
  /** Search query text */
  query: string;

  /** Number of results to return */
  topK?: number;

  /** Minimum similarity score (0-1) */
  minScore?: number;

  /** Filters */
  filters?: VectorSearchFilters;
}

/**
 * Search result
 */
export interface SearchResult {
  /** Document ID */
  id: string;

  /** Content text */
  content: string;

  /** Similarity score (0-1) */
  score: number;

  /** Source document */
  source?: string;

  /** Document title */
  title?: string;

  /** Metadata */
  metadata: VectorMetadata;
}

/**
 * Update document options
 */
export interface UpdateDocumentOptions {
  /** Document path */
  path: string;

  /** Whether to reindex the document */
  reindex?: boolean;

  /** New metadata (partial update) */
  metadata?: Partial<VectorMetadata>;
}

/**
 * Knowledge Base Manager
 *
 * Provides a unified interface for managing knowledge:
 * - Index documents from various sources
 * - Search for relevant knowledge
 * - Update and delete documents
 * - Handle permissions
 */
export class KnowledgeBaseManager {
  private filesAdapter: FilesAdapter;
  private vectorAdapter: VectorAdapter;
  private embeddingGenerator: EmbeddingGenerator;
  private embeddingAdapter?: EmbeddingAdapter;
  private documentProcessor?: DocumentProcessor;
  private documentChunker?: DocumentChunker;
  private batchSize: number;
  private enableCache: boolean;
  private cacheTTL: number;

  // Simple in-memory cache
  private searchCache: Map<string, { result: SearchResult[]; timestamp: number }> = new Map();

  constructor(options: KnowledgeBaseManagerOptions) {
    this.filesAdapter = options.filesAdapter;
    this.vectorAdapter = options.vectorAdapter;
    this.embeddingGenerator = options.embeddingGenerator;
    this.embeddingAdapter = options.embeddingAdapter;
    this.documentProcessor = options.documentProcessor;
    this.documentChunker = options.documentChunker;
    this.batchSize = options.batchSize ?? 10;
    this.enableCache = options.enableCache ?? true;
    this.cacheTTL = options.cacheTTL ?? 3600; // 1 hour default
  }

  /**
   * Index documents from a path
   */
  async indexDocuments(options: IndexDocumentsOptions): Promise<IndexingProgress> {
    const progress: IndexingProgress = {
      totalFiles: 0,
      filesProcessed: 0,
      totalChunks: 0,
      chunksIndexed: 0,
      status: 'scanning',
    };

    try {
      // 1. Scan for files
      progress.status = 'scanning';
      options.onProgress?.(progress);

      const files = await this.scanFiles(options.path, options.includes, options.excludes);
      progress.totalFiles = files.length;
      options.onProgress?.(progress);

      if (files.length === 0) {
        progress.status = 'complete';
        options.onProgress?.(progress);
        return progress;
      }

      // 2. Process each file
      progress.status = 'processing';

      for (const file of files) {
        try {
          progress.currentFile = file.path;
          options.onProgress?.(progress);

          // Download file
          const { content } = await this.filesAdapter.download(file.path);

          // Extract text using document processor if available
          let text: string;
          let documentMetadata: any = {};

          if (this.documentProcessor) {
            const extracted = await this.documentProcessor.extractFromBuffer(content, file.path);
            text = extracted.text;
            documentMetadata = extracted.metadata;
          } else {
            // Fallback to plain text
            text = content.toString('utf-8');
          }

          // Chunk the document
          let chunks: Array<{ id: string; text: string; metadata: any }>;

          if (this.documentChunker) {
            const documentChunks = this.documentChunker.chunkText(text, {
              filename: file.path,
              format: documentMetadata.format,
            });
            chunks = documentChunks.map((chunk: any) => ({
              id: chunk.id,
              text: chunk.text,
              metadata: {
                ...chunk.metadata,
                chunkIndex: chunk.index,
                totalChunks: chunk.totalChunks,
              },
            }));
          } else {
            // Simple chunking - split into 1000 char chunks
            chunks = this.simpleChunk(text, file.path);
          }

          progress.totalChunks += chunks.length;
          options.onProgress?.(progress);

          // 3. Generate embeddings
          progress.status = 'embedding';
          options.onProgress?.(progress);

          const embeddings = await this.generateEmbeddings(chunks.map((c) => c.text));

          // 4. Store in vector database
          progress.status = 'storing';
          options.onProgress?.(progress);

          const vectorsToUpsert = chunks.map((chunk, index) => {
            const embedding = embeddings[index];
            if (!embedding) {
              throw new Error(`Missing embedding for chunk ${index}`);
            }

            const metadata: VectorMetadata = {
              content: chunk.text,
              source: file.path,
              title: documentMetadata.title || file.path,
              level: options.level || 'public',
              userId: options.userId,
              organizationId: options.organizationId,
              sessionId: options.sessionId,
              createdAt: new Date(),
              ...chunk.metadata,
            };

            return {
              id: chunk.id,
              vector: embedding,
              options: {
                metadata,
                update: options.update ?? true,
              },
            };
          });

          // Batch upsert
          await this.vectorAdapter.batchUpsert(vectorsToUpsert);

          progress.chunksIndexed += chunks.length;
          progress.filesProcessed++;
          options.onProgress?.(progress);
        } catch (error) {
          // Log error but continue with other files
          console.error(`Error indexing file ${file.path}:`, error);
          progress.filesProcessed++;
        }
      }

      progress.status = 'complete';
      options.onProgress?.(progress);

      // Clear search cache after indexing
      this.clearCache();

      return progress;
    } catch (error) {
      progress.status = 'error';
      progress.error = error instanceof Error ? error.message : String(error);
      options.onProgress?.(progress);
      throw error;
    }
  }

  /**
   * Search for relevant knowledge
   */
  async search(options: SearchOptions): Promise<SearchResult[]> {
    // Check cache first
    if (this.enableCache) {
      const cached = this.getFromCache(options.query, options.filters);
      if (cached) {
        return cached;
      }
    }

    // Generate query embedding
    let queryEmbedding: Vector;

    if (this.embeddingAdapter) {
      const result = await this.embeddingAdapter.generate(options.query);
      queryEmbedding = result.embedding;
    } else {
      queryEmbedding = await this.embeddingGenerator.generate(options.query);
    }

    // Search vector database
    const searchOptions: VectorSearchOptions = {
      topK: options.topK ?? 5,
      minScore: options.minScore ?? 0.7,
      filters: options.filters,
      includeVectors: false,
    };

    const results = await this.vectorAdapter.search(queryEmbedding, searchOptions);

    // Map to SearchResult format
    const searchResults = results.map((result) => ({
      id: result.id,
      content: result.metadata.content,
      score: result.score,
      source: result.metadata.source,
      title: result.metadata.title,
      metadata: result.metadata,
    }));

    // Cache results
    if (this.enableCache) {
      this.addToCache(options.query, options.filters, searchResults);
    }

    return searchResults;
  }

  /**
   * Update a document
   */
  async updateDocument(options: UpdateDocumentOptions): Promise<void> {
    if (options.reindex) {
      // Delete existing chunks for this document
      await this.deleteDocument(options.path);

      // Reindex the document
      await this.indexDocuments({
        path: options.path,
        update: true,
      });
    } else if (options.metadata) {
      // Update metadata only
      // Note: We need to find all chunks for this document
      const chunks = await this.findChunksBySource(options.path);

      for (const chunk of chunks) {
        await this.vectorAdapter.updateMetadata(chunk.id, options.metadata);
      }
    }

    // Clear cache
    this.clearCache();
  }

  /**
   * Delete a document and all its chunks
   */
  async deleteDocument(path: string): Promise<number> {
    const deleted = await this.vectorAdapter.deleteByFilter({
      metadata: { source: path },
    });

    // Clear cache
    this.clearCache();

    return deleted;
  }

  /**
   * Clear the search cache
   */
  clearCache(): void {
    this.searchCache.clear();
  }

  /**
   * Get vector adapter statistics
   */
  getStats() {
    return this.vectorAdapter.getStats();
  }

  // ==========================================
  // Private helper methods
  // ==========================================

  /**
   * Scan files in a path
   */
  private async scanFiles(
    path: string,
    includes?: string[],
    excludes?: string[],
  ): Promise<Array<{ path: string; metadata: any }>> {
    const allFiles = await this.filesAdapter.list(path);

    // Filter by includes/excludes
    let filtered = allFiles;

    if (includes && includes.length > 0) {
      filtered = filtered.filter((file) =>
        includes.some((pattern) => this.matchPattern(file.path, pattern)),
      );
    }

    if (excludes && excludes.length > 0) {
      filtered = filtered.filter(
        (file) => !excludes.some((pattern) => this.matchPattern(file.path, pattern)),
      );
    }

    // Filter by supported file types if using document processor
    if (this.documentProcessor) {
      filtered = filtered.filter((file) => this.documentProcessor?.isSupported(file.path));
    }

    return filtered;
  }

  /**
   * Simple pattern matching (supports * wildcard)
   */
  private matchPattern(path: string, pattern: string): boolean {
    // Convert glob pattern to regex
    const regexPattern = pattern.replace(/\./g, '\\.').replace(/\*/g, '.*').replace(/\?/g, '.');

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(path);
  }

  /**
   * Simple text chunking (fallback when no chunker is provided)
   */
  private simpleChunk(
    text: string,
    filename: string,
  ): Array<{ id: string; text: string; metadata: any }> {
    const chunkSize = 1000;
    const overlap = 200;
    const chunks: Array<{ id: string; text: string; metadata: any }> = [];

    let position = 0;
    let chunkIndex = 0;

    while (position < text.length) {
      const end = Math.min(position + chunkSize, text.length);
      const chunkText = text.slice(position, end);

      chunks.push({
        id: `${filename}-chunk-${chunkIndex}`,
        text: chunkText,
        metadata: {
          chunkIndex,
          totalChunks: 0, // Will be updated later
        },
      });

      position = end - overlap;
      chunkIndex++;

      // Prevent infinite loop
      if (position >= text.length) break;
    }

    // Update total chunks
    for (const chunk of chunks) {
      chunk.metadata.totalChunks = chunks.length;
    }

    return chunks;
  }

  /**
   * Generate embeddings for texts (with batching)
   */
  private async generateEmbeddings(texts: string[]): Promise<Vector[]> {
    if (this.embeddingAdapter) {
      const results = await this.embeddingAdapter.batchGenerate(texts, {
        batchSize: this.batchSize,
      });
      return results.map((r) => r.embedding);
    }

    // Use embedding generator
    const embeddings: Vector[] = [];

    for (let i = 0; i < texts.length; i += this.batchSize) {
      const batch = texts.slice(i, i + this.batchSize);
      const result = await this.embeddingGenerator.generateBatch(batch);

      for (const item of result.embeddings) {
        embeddings.push(item.embedding);
      }
    }

    return embeddings;
  }

  /**
   * Find chunks by source document
   */
  private async findChunksBySource(source: string): Promise<VectorSearchResult[]> {
    // Get all vectors and filter by source
    // This is inefficient but necessary without a dedicated query method
    // In production, you'd want to add a proper query method to VectorAdapter

    // For now, we'll use a workaround: search with an empty vector (all zeros)
    // and filter by metadata
    const dimensions = this.embeddingGenerator.getDimensions();
    const emptyVector = new Array(dimensions).fill(0);

    const results = await this.vectorAdapter.search(emptyVector, {
      topK: 1000, // Get a large number
      minScore: 0,
      filters: {
        metadata: { source },
      },
    });

    return results;
  }

  /**
   * Get from cache
   */
  private getFromCache(query: string, filters?: VectorSearchFilters): SearchResult[] | null {
    const cacheKey = this.getCacheKey(query, filters);
    const cached = this.searchCache.get(cacheKey);

    if (!cached) {
      return null;
    }

    // Check if expired
    const now = Date.now();
    if (now - cached.timestamp > this.cacheTTL * 1000) {
      this.searchCache.delete(cacheKey);
      return null;
    }

    return cached.result;
  }

  /**
   * Add to cache
   */
  private addToCache(
    query: string,
    filters: VectorSearchFilters | undefined,
    result: SearchResult[],
  ): void {
    const cacheKey = this.getCacheKey(query, filters);
    this.searchCache.set(cacheKey, {
      result,
      timestamp: Date.now(),
    });
  }

  /**
   * Generate cache key
   */
  private getCacheKey(query: string, filters?: VectorSearchFilters): string {
    return `${query}:${JSON.stringify(filters || {})}`;
  }
}

/**
 * Create a knowledge base manager
 */
export function createKnowledgeBaseManager(
  options: KnowledgeBaseManagerOptions,
): KnowledgeBaseManager {
  return new KnowledgeBaseManager(options);
}
