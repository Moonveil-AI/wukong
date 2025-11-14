/**
 * Document metadata extracted from various formats
 */
export interface DocumentMetadata {
  filename: string;
  format: 'pdf' | 'docx' | 'markdown' | 'html' | 'txt';
  title: string;
  author?: string;
  description?: string;
  tags?: string[];
  pageCount?: number;
  createdAt?: Date;
  modifiedAt?: Date;
}

/**
 * Extracted document with text content and metadata
 */
export interface ExtractedDocument {
  text: string;
  metadata: DocumentMetadata;
  pages?: string[];
  sections?: Array<{
    heading: string;
    level: number;
    content: string;
  }>;
  paragraphs?: string[];
}

/**
 * Options for document processing
 */
export interface ProcessorOptions {
  /**
   * Maximum file size in bytes (default: 50MB)
   */
  maxFileSize?: number;

  /**
   * Whether to preserve formatting (where applicable)
   */
  preserveFormatting?: boolean;
}
