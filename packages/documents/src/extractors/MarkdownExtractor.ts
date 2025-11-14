import { marked } from 'marked';
import type { DocumentMetadata, ExtractedDocument } from '../types';

export class MarkdownExtractor {
  /**
   * Extract text and metadata from Markdown files
   */
  extract(content: string, filename: string): Promise<ExtractedDocument> {
    try {
      const { frontmatter, content: markdownContent } = this.parseFrontmatter(content);

      const metadata: DocumentMetadata = {
        filename,
        format: 'markdown',
        title:
          // biome-ignore lint/complexity/useLiteralKeys: TypeScript requires bracket notation for index signatures
          (typeof frontmatter['title'] === 'string' ? frontmatter['title'] : undefined) ||
          this.extractTitle(markdownContent) ||
          filename,
        // biome-ignore lint/complexity/useLiteralKeys: TypeScript requires bracket notation for index signatures
        author: typeof frontmatter['author'] === 'string' ? frontmatter['author'] : undefined,
        // biome-ignore lint/complexity/useLiteralKeys: TypeScript requires bracket notation for index signatures
        tags: Array.isArray(frontmatter['tags']) ? (frontmatter['tags'] as string[]) : [],
        // biome-ignore lint/complexity/useLiteralKeys: TypeScript requires bracket notation for index signatures
        createdAt: frontmatter['date']
          ? // biome-ignore lint/complexity/useLiteralKeys: TypeScript requires bracket notation for index signatures
            new Date(frontmatter['date'] as string | number)
          : undefined,
      };

      return Promise.resolve({
        text: markdownContent,
        metadata,
        sections: this.extractSections(markdownContent),
      });
    } catch (error) {
      return Promise.reject(
        new Error(
          `Failed to extract Markdown: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ),
      );
    }
  }

  /**
   * Parse frontmatter from markdown content
   */
  private parseFrontmatter(content: string): {
    frontmatter: Record<string, unknown>;
    content: string;
  } {
    const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
    const match = content.match(frontmatterRegex);

    if (!match) {
      return { frontmatter: {}, content };
    }

    const frontmatterText = match[1];
    const markdownContent = match[2] || '';

    const frontmatter: Record<string, unknown> = {};
    if (!frontmatterText) {
      return { frontmatter, content: markdownContent };
    }

    const lines = frontmatterText.split('\n');

    for (const line of lines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) continue;

      const key = line.slice(0, colonIndex).trim();
      let value: unknown = line.slice(colonIndex + 1).trim();

      // Remove quotes
      if (
        typeof value === 'string' &&
        ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'")))
      ) {
        value = value.slice(1, -1);
      }

      // Parse arrays
      if (typeof value === 'string' && value.startsWith('[') && value.endsWith(']')) {
        value = value
          .slice(1, -1)
          .split(',')
          .map((v) => v.trim().replace(/^['"]|['"]$/g, ''));
      }

      frontmatter[key] = value;
    }

    return { frontmatter, content: markdownContent };
  }

  /**
   * Extract title from first heading
   */
  private extractTitle(content: string): string | undefined {
    const lines = content.split('\n');
    for (const line of lines) {
      const match = line.match(/^#\s+(.+)$/);
      if (match?.[1]) {
        return match[1].trim();
      }
    }
    return undefined;
  }

  /**
   * Extract sections based on headings
   */
  private extractSections(content: string): Array<{
    heading: string;
    level: number;
    content: string;
  }> {
    const sections: Array<{
      heading: string;
      level: number;
      content: string;
    }> = [];

    const lines = content.split('\n');
    let currentSection: {
      heading: string;
      level: number;
      content: string[];
    } | null = null;

    for (const line of lines) {
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);

      if (headingMatch?.[1] && headingMatch[2]) {
        // Save previous section
        if (currentSection?.content) {
          sections.push({
            ...currentSection,
            content: currentSection.content.join('\n').trim(),
          });
        }

        // Start new section
        currentSection = {
          heading: headingMatch[2].trim(),
          level: headingMatch[1].length,
          content: [],
        };
      } else if (currentSection) {
        currentSection.content.push(line);
      }
    }

    // Save last section
    if (currentSection?.content) {
      sections.push({
        ...currentSection,
        content: currentSection.content.join('\n').trim(),
      });
    }

    return sections;
  }

  /**
   * Convert markdown to plain text (strip formatting)
   */
  toPlainText(content: string): Promise<string> {
    const tokens = marked.lexer(content);
    const plainText: string[] = [];

    for (const token of tokens) {
      if (token.type === 'paragraph' || token.type === 'text') {
        plainText.push(token.raw);
      } else if (token.type === 'heading') {
        plainText.push(token.text);
      } else if (token.type === 'list') {
        // Extract text from list items
        const listText = this.extractListText(token as { items: Array<{ text: string }> });
        plainText.push(listText);
      }
    }

    return Promise.resolve(plainText.join('\n\n'));
  }

  private extractListText(token: { items: Array<{ text: string }> }): string {
    const items: string[] = [];
    for (const item of token.items) {
      items.push(item.text);
    }
    return items.join('\n');
  }
}
