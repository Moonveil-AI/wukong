import type { ExtractedDocument } from '../types';
import type { ChunkerOptions, DocumentChunk } from './types';

/**
 * Document chunker that splits documents into overlapping chunks
 * while preserving paragraph boundaries and structure
 */
export class DocumentChunker {
  private options: Required<ChunkerOptions>;

  constructor(options: ChunkerOptions = {}) {
    this.options = {
      chunkSize: options.chunkSize ?? 1000,
      overlap: options.overlap ?? 200,
      preserveParagraphs: options.preserveParagraphs ?? true,
      minChunkSize: options.minChunkSize ?? 100,
    };

    // Validate options
    if (this.options.overlap >= this.options.chunkSize) {
      throw new Error('Overlap must be less than chunk size');
    }

    if (this.options.minChunkSize > this.options.chunkSize) {
      throw new Error('Minimum chunk size must be less than or equal to chunk size');
    }
  }

  /**
   * Chunk an extracted document into smaller pieces
   */
  chunk(document: ExtractedDocument): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    const text = document.text;

    if (!text || text.trim().length === 0) {
      return chunks;
    }

    // Split into paragraphs if needed
    const paragraphs = this.options.preserveParagraphs ? this.splitIntoParagraphs(text) : [text];

    let currentChunk = '';
    let currentStartPosition = 0;
    let chunkStartPosition = 0;
    let currentSection: { heading: string; level: number } | undefined;

    // Track section context from document
    if (document.sections && document.sections.length > 0) {
      const firstSection = document.sections[0];
      if (firstSection) {
        currentSection = {
          heading: firstSection.heading,
          level: firstSection.level,
        };
      }
    }

    for (const paragraph of paragraphs) {
      // Skip if paragraph is undefined
      if (!paragraph) {
        continue;
      }

      // Update section context if this paragraph is a heading
      if (document.sections) {
        const section = this.findSectionForPosition(document.sections, currentStartPosition);
        if (section) {
          currentSection = {
            heading: section.heading,
            level: section.level,
          };
        }
      }

      // Check if paragraph itself is longer than chunk size
      if (paragraph.length > this.options.chunkSize) {
        // Save current chunk if not empty
        if (currentChunk.length > 0) {
          chunks.push(
            this.createChunk({
              text: currentChunk.trim(),
              index: chunks.length,
              startPosition: chunkStartPosition,
              endPosition: currentStartPosition,
              document,
              section: currentSection,
            }),
          );
          currentChunk = '';
        }

        // Split this long paragraph into multiple chunks
        const paragraphChunks = this.splitLongText(paragraph);
        for (let i = 0; i < paragraphChunks.length; i++) {
          const pChunk = paragraphChunks[i];
          if (!pChunk) continue;

          chunks.push(
            this.createChunk({
              text: pChunk,
              index: chunks.length,
              startPosition: currentStartPosition + (i > 0 ? this.options.chunkSize * i : 0),
              endPosition:
                currentStartPosition + (i > 0 ? this.options.chunkSize * i : 0) + pChunk.length,
              document,
              section: currentSection,
            }),
          );
        }

        chunkStartPosition = currentStartPosition + paragraph.length;
      } else if (
        currentChunk.length + paragraph.length > this.options.chunkSize &&
        currentChunk.length > 0
      ) {
        // Save current chunk
        chunks.push(
          this.createChunk({
            text: currentChunk.trim(),
            index: chunks.length,
            startPosition: chunkStartPosition,
            endPosition: currentStartPosition,
            document,
            section: currentSection,
          }),
        );

        // Start new chunk with overlap
        const overlapText = this.getOverlapText(currentChunk);
        currentChunk = overlapText + paragraph;
        chunkStartPosition = currentStartPosition - overlapText.length;
      } else {
        // Add paragraph to current chunk
        if (currentChunk.length > 0) {
          currentChunk += '\n\n';
        }
        currentChunk += paragraph;
      }

      currentStartPosition += paragraph.length + 2; // +2 for \n\n
    }

    // Add the last chunk if it's not empty
    if (currentChunk.trim().length >= this.options.minChunkSize) {
      chunks.push(
        this.createChunk({
          text: currentChunk.trim(),
          index: chunks.length,
          startPosition: chunkStartPosition,
          endPosition: text.length,
          document,
          section: currentSection,
        }),
      );
    } else if (currentChunk.trim().length > 0 && chunks.length > 0) {
      // If last chunk is too small, append to previous chunk
      const lastChunk = chunks[chunks.length - 1];
      if (lastChunk) {
        lastChunk.text += `\n\n${currentChunk.trim()}`;
        lastChunk.endPosition = text.length;
      }
    } else if (chunks.length === 0 && currentChunk.trim().length > 0) {
      // If this is the only chunk, add it regardless of size
      chunks.push(
        this.createChunk({
          text: currentChunk.trim(),
          index: 0,
          startPosition: 0,
          endPosition: text.length,
          document,
          section: currentSection,
        }),
      );
    }

    // Update total chunks count
    for (const chunk of chunks) {
      chunk.totalChunks = chunks.length;
    }

    return chunks;
  }

  /**
   * Chunk plain text (without document metadata)
   */
  chunkText(
    text: string,
    metadata: {
      filename: string;
      format?: string;
      [key: string]: unknown;
    } = { filename: 'unknown' },
  ): DocumentChunk[] {
    const document: ExtractedDocument = {
      text,
      metadata: {
        filename: metadata.filename,
        format: (metadata.format as 'txt') || 'txt',
        title: metadata.filename,
      },
    };

    return this.chunk(document);
  }

  /**
   * Split text into paragraphs
   */
  private splitIntoParagraphs(text: string): string[] {
    // Split by double newlines (paragraph breaks)
    const paragraphs = text
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    return paragraphs;
  }

  /**
   * Split a long text into chunks by character count with overlap
   */
  private splitLongText(text: string): string[] {
    const chunks: string[] = [];
    let position = 0;

    while (position < text.length) {
      // Extract chunk
      let chunkEnd = Math.min(position + this.options.chunkSize, text.length);

      // Try to break at word boundary if not at the end
      if (chunkEnd < text.length) {
        const remainingText = text.slice(position, chunkEnd);
        const lastSpace = remainingText.lastIndexOf(' ');
        if (lastSpace > 0) {
          chunkEnd = position + lastSpace;
        }
      }

      const chunkText = text.slice(position, chunkEnd).trim();
      if (chunkText.length > 0) {
        chunks.push(chunkText);
      }

      // Calculate next position with overlap, but ensure we always move forward
      const nextPosition = chunkEnd - this.options.overlap;

      // If next position is not moving forward, force it to move at least 1 character
      if (nextPosition <= position) {
        position = chunkEnd;
      } else {
        position = nextPosition;
      }

      // Prevent infinite loop - if we're at or past the end, break
      if (position >= text.length || chunkEnd >= text.length) break;
    }

    return chunks;
  }

  /**
   * Get overlap text from the end of current chunk
   */
  private getOverlapText(text: string): string {
    if (text.length <= this.options.overlap) {
      return text;
    }

    // Try to break at sentence boundary
    const overlapText = text.slice(-this.options.overlap);
    const sentenceEnd = overlapText.search(/[.!?]\s+/);

    if (sentenceEnd !== -1) {
      return overlapText.slice(sentenceEnd + 2); // +2 to skip the punctuation and space
    }

    // Try to break at word boundary
    const firstSpace = overlapText.indexOf(' ');
    if (firstSpace !== -1) {
      return overlapText.slice(firstSpace + 1);
    }

    return overlapText;
  }

  /**
   * Find the section that contains the given position
   */
  private findSectionForPosition(
    sections: Array<{ heading: string; level: number; content: string }>,
    position: number,
  ): { heading: string; level: number } | undefined {
    let currentPos = 0;

    for (const section of sections) {
      const sectionLength = section.heading.length + section.content.length;

      if (position >= currentPos && position < currentPos + sectionLength) {
        return {
          heading: section.heading,
          level: section.level,
        };
      }

      currentPos += sectionLength;
    }

    return undefined;
  }

  /**
   * Create a document chunk object
   */
  private createChunk(params: {
    text: string;
    index: number;
    startPosition: number;
    endPosition: number;
    document: ExtractedDocument;
    section?: { heading: string; level: number };
  }): DocumentChunk {
    const { text, index, startPosition, endPosition, document, section } = params;

    // Generate unique ID
    const id = `${document.metadata.filename}-chunk-${index}`;

    return {
      id,
      text,
      index,
      totalChunks: 0, // Will be updated later
      startPosition,
      endPosition,
      metadata: {
        ...document.metadata,
      },
      section,
    };
  }

  /**
   * Get chunker options
   */
  getOptions(): Required<ChunkerOptions> {
    return { ...this.options };
  }
}
