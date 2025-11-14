import type { DocumentMetadata, ExtractedDocument } from '../types';

export class TxtExtractor {
  /**
   * Extract text and metadata from plain text files
   */
  extract(content: string, filename: string): Promise<ExtractedDocument> {
    const metadata: DocumentMetadata = {
      filename,
      format: 'txt',
      title: filename.replace(/\.txt$/i, ''),
    };

    return Promise.resolve({
      text: content.trim(),
      metadata,
      paragraphs: this.extractParagraphs(content),
    });
  }

  /**
   * Extract paragraphs from text
   */
  private extractParagraphs(content: string): string[] {
    return content
      .split(/\n\s*\n/) // Split on double newlines
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
  }
}
