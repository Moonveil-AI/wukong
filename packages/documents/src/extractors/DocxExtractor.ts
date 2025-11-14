import mammoth from 'mammoth';
import type { DocumentMetadata, ExtractedDocument } from '../types';

export class DocxExtractor {
  /**
   * Extract text and metadata from DOCX files
   */
  async extract(buffer: Buffer, filename: string): Promise<ExtractedDocument> {
    try {
      const result = await mammoth.extractRawText({ buffer });

      const metadata: DocumentMetadata = {
        filename,
        format: 'docx',
        title: filename.replace(/\.docx$/i, ''),
      };

      return {
        text: result.value,
        metadata,
      };
    } catch (error) {
      throw new Error(
        `Failed to extract DOCX: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Extract text with HTML formatting preserved
   */
  async extractWithFormatting(buffer: Buffer, filename: string): Promise<ExtractedDocument> {
    try {
      const result = await mammoth.convertToHtml({ buffer });

      const metadata: DocumentMetadata = {
        filename,
        format: 'docx',
        title: filename.replace(/\.docx$/i, ''),
      };

      return {
        text: result.value,
        metadata,
      };
    } catch (error) {
      throw new Error(
        `Failed to extract DOCX with formatting: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}
