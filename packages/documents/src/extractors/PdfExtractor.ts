import pdfParse from 'pdf-parse';
import type { DocumentMetadata, ExtractedDocument } from '../types';

export class PdfExtractor {
  /**
   * Extract text and metadata from PDF files
   */
  async extract(buffer: Buffer, filename: string): Promise<ExtractedDocument> {
    try {
      const data = await pdfParse(buffer);

      const metadata: DocumentMetadata = {
        filename,
        format: 'pdf',
        title: data.info?.Title || filename,
        author: data.info?.Author,
        pageCount: data.numpages,
        createdAt: data.info?.CreationDate ? new Date(data.info.CreationDate) : undefined,
      };

      return {
        text: data.text,
        metadata,
        pages: this.splitIntoPages(data.text, data.numpages),
      };
    } catch (error) {
      throw new Error(
        `Failed to extract PDF: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Split text into pages (approximate, since pdf-parse doesn't provide page boundaries)
   */
  private splitIntoPages(text: string, pageCount: number): string[] {
    if (pageCount <= 1) {
      return [text];
    }

    // Approximate page splitting by dividing text length
    const approxPageLength = Math.ceil(text.length / pageCount);
    const pages: string[] = [];

    let currentPos = 0;
    for (let i = 0; i < pageCount; i++) {
      const endPos = Math.min(currentPos + approxPageLength, text.length);
      // Try to find a paragraph break near the end
      const nearEndPos = text.lastIndexOf('\n\n', endPos);
      const actualEndPos = nearEndPos > currentPos ? nearEndPos : endPos;

      pages.push(text.slice(currentPos, actualEndPos).trim());
      currentPos = actualEndPos;
    }

    return pages.filter((page) => page.length > 0);
  }
}
