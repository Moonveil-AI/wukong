/**
 * Options for chunking documents
 */
export interface ChunkerOptions {
  /**
   * Target chunk size in characters (default: 1000)
   */
  chunkSize?: number;

  /**
   * Overlap between chunks in characters (default: 200)
   */
  overlap?: number;

  /**
   * Whether to preserve paragraph boundaries (default: true)
   */
  preserveParagraphs?: boolean;

  /**
   * Minimum chunk size in characters (default: 100)
   */
  minChunkSize?: number;
}

/**
 * A chunk of text with metadata
 */
export interface DocumentChunk {
  /**
   * Unique identifier for the chunk
   */
  id: string;

  /**
   * The text content of the chunk
   */
  text: string;

  /**
   * Chunk index in the document (0-based)
   */
  index: number;

  /**
   * Total number of chunks in the document
   */
  totalChunks: number;

  /**
   * Start position in the original document
   */
  startPosition: number;

  /**
   * End position in the original document
   */
  endPosition: number;

  /**
   * Metadata from the original document
   */
  metadata: {
    filename: string;
    format?: string;
    title?: string;
    author?: string;
    [key: string]: unknown;
  };

  /**
   * Section information if available
   */
  section?: {
    heading: string;
    level: number;
  };
}
