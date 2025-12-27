/**
 * @file DocumentProcessor.ts
 * @input Depends on extractors/* (PdfExtractor, DocxExtractor, etc.), types.ts (ExtractedDocument, ProcessorOptions)
 * @output Exports DocumentProcessor class
 * @position Document processing orchestrator - extracts text from various formats. Consumed by KnowledgeBaseManager.
 *
 * SYNC: When modified, update this header and /packages/documents/src/README.md
 */

import { DocxExtractor } from './extractors/DocxExtractor';
import { HtmlExtractor } from './extractors/HtmlExtractor';
import { MarkdownExtractor } from './extractors/MarkdownExtractor';
import { PdfExtractor } from './extractors/PdfExtractor';
import { TxtExtractor } from './extractors/TxtExtractor';
import type { ExtractedDocument, ProcessorOptions } from './types';

/**
 * Unified document processor for extracting text from various formats
 */
export class DocumentProcessor {
  private pdfExtractor: PdfExtractor;
  private docxExtractor: DocxExtractor;
  private markdownExtractor: MarkdownExtractor;
  private htmlExtractor: HtmlExtractor;
  private txtExtractor: TxtExtractor;

  private options: Required<ProcessorOptions>;

  constructor(options: ProcessorOptions = {}) {
    this.pdfExtractor = new PdfExtractor();
    this.docxExtractor = new DocxExtractor();
    this.markdownExtractor = new MarkdownExtractor();
    this.htmlExtractor = new HtmlExtractor();
    this.txtExtractor = new TxtExtractor();

    this.options = {
      maxFileSize: options.maxFileSize || 50 * 1024 * 1024, // 50MB
      preserveFormatting: options.preserveFormatting ?? false,
    };
  }

  /**
   * Extract text from a buffer based on file extension
   */
  extractFromBuffer(buffer: Buffer, filename: string): Promise<ExtractedDocument> {
    // Check file size
    if (buffer.length > this.options.maxFileSize) {
      return Promise.reject(
        new Error(
          `File size (${buffer.length} bytes) exceeds maximum allowed size (${this.options.maxFileSize} bytes)`,
        ),
      );
    }

    const extension = this.getFileExtension(filename);

    switch (extension) {
      case 'pdf':
        return this.pdfExtractor.extract(buffer, filename);

      case 'docx':
        return this.docxExtractor.extract(buffer, filename);

      case 'md':
      case 'markdown':
        return this.markdownExtractor.extract(buffer.toString('utf-8'), filename);

      case 'html':
      case 'htm':
        return this.htmlExtractor.extract(buffer.toString('utf-8'), filename);

      case 'txt':
        return this.txtExtractor.extract(buffer.toString('utf-8'), filename);

      default:
        return Promise.reject(new Error(`Unsupported file format: ${extension}`));
    }
  }

  /**
   * Extract text from a string (for text-based formats)
   */
  extractFromString(content: string, filename: string): Promise<ExtractedDocument> {
    const extension = this.getFileExtension(filename);

    switch (extension) {
      case 'md':
      case 'markdown':
        return this.markdownExtractor.extract(content, filename);

      case 'html':
      case 'htm':
        return this.htmlExtractor.extract(content, filename);

      case 'txt':
        return this.txtExtractor.extract(content, filename);

      default:
        return Promise.reject(
          new Error(
            `Cannot extract from string for format: ${extension}. Use extractFromBuffer instead.`,
          ),
        );
    }
  }

  /**
   * Get file extension from filename
   */
  private getFileExtension(filename: string): string {
    const parts = filename.split('.');
    if (parts.length === 1) {
      throw new Error(`No file extension found: ${filename}`);
    }
    const extension = parts[parts.length - 1];
    if (!extension) {
      throw new Error(`No file extension found: ${filename}`);
    }
    return extension.toLowerCase();
  }

  /**
   * Check if a file format is supported
   */
  isSupported(filename: string): boolean {
    try {
      const extension = this.getFileExtension(filename);
      return ['pdf', 'docx', 'md', 'markdown', 'html', 'htm', 'txt'].includes(extension);
    } catch {
      return false;
    }
  }

  /**
   * Get list of supported file extensions
   */
  getSupportedExtensions(): string[] {
    return ['pdf', 'docx', 'md', 'markdown', 'html', 'htm', 'txt'];
  }
}
