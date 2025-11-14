import { JSDOM } from 'jsdom';
import type { DocumentMetadata, ExtractedDocument } from '../types';

export class HtmlExtractor {
  /**
   * Extract text and metadata from HTML files
   */
  extract(content: string, filename: string): Promise<ExtractedDocument> {
    try {
      const dom = new JSDOM(content);
      const document = dom.window.document;

      // Extract metadata from HTML
      const title =
        document.querySelector('title')?.textContent ||
        document.querySelector('h1')?.textContent ||
        filename;

      const metaAuthor = document.querySelector('meta[name="author"]');
      const author = metaAuthor?.getAttribute('content') || undefined;

      const metaDescription = document.querySelector('meta[name="description"]');
      const description = metaDescription?.getAttribute('content') || undefined;

      const metadata: DocumentMetadata = {
        filename,
        format: 'html',
        title: title.trim(),
        author,
        description,
      };

      // Extract text content
      const text = this.extractText(document.body);

      return Promise.resolve({
        text,
        metadata,
      });
    } catch (error) {
      return Promise.reject(
        new Error(
          `Failed to extract HTML: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ),
      );
    }
  }

  /**
   * Extract text from HTML element, preserving structure
   */
  private extractText(element: Element): string {
    const textParts: string[] = [];

    const walk = (node: Node) => {
      if (node.nodeType === node.TEXT_NODE) {
        const text = node.textContent?.trim();
        if (text) {
          textParts.push(text);
        }
      } else if (node.nodeType === node.ELEMENT_NODE) {
        const el = node as Element;

        // Skip script and style tags
        if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE') {
          return;
        }

        // Add line breaks for block elements
        const isBlockElement = this.isBlockElement(el.tagName);
        if (isBlockElement && textParts.length > 0) {
          textParts.push('\n');
        }

        // Process children
        for (const child of Array.from(el.childNodes)) {
          walk(child);
        }

        // Add line break after block element
        if (isBlockElement) {
          textParts.push('\n');
        }
      }
    };

    walk(element);

    // Clean up text
    return textParts
      .join('')
      .replace(/\n{3,}/g, '\n\n') // Max 2 consecutive newlines
      .trim();
  }

  /**
   * Check if element is a block-level element
   */
  private isBlockElement(tagName: string): boolean {
    const blockElements = new Set([
      'DIV',
      'P',
      'H1',
      'H2',
      'H3',
      'H4',
      'H5',
      'H6',
      'UL',
      'OL',
      'LI',
      'BLOCKQUOTE',
      'PRE',
      'HR',
      'TABLE',
      'TR',
      'TD',
      'TH',
      'SECTION',
      'ARTICLE',
      'ASIDE',
      'HEADER',
      'FOOTER',
      'NAV',
    ]);

    return blockElements.has(tagName);
  }
}
