/**
 * @wukong/documents - Document Processing
 * @description Document extraction and processing utilities for Wukong
 */

export { DocumentProcessor } from './DocumentProcessor';

export { PdfExtractor } from './extractors/PdfExtractor';
export { DocxExtractor } from './extractors/DocxExtractor';
export { MarkdownExtractor } from './extractors/MarkdownExtractor';
export { HtmlExtractor } from './extractors/HtmlExtractor';
export { TxtExtractor } from './extractors/TxtExtractor';

export { DocumentChunker } from './chunking/DocumentChunker';

export type {
  DocumentMetadata,
  ExtractedDocument,
  ProcessorOptions,
} from './types';

export type {
  ChunkerOptions,
  DocumentChunk,
} from './chunking/types';

export const version = '0.1.0';
