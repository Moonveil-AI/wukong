/**
 * Skills Registry Tests
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SkillsRegistry } from '../SkillsRegistry';
import type { SkillMetadata, SkillsAdapter } from '../types';

// Mock adapter for testing
class MockSkillsAdapter implements SkillsAdapter {
  private metadata: SkillMetadata[] = [
    {
      name: 'excel-handler',
      displayName: 'Excel Handler',
      description: 'Read, edit, analyze Excel files',
      keywords: ['excel', 'spreadsheet', 'table', 'data'],
      category: 'data',
      capabilities: ['Read Excel', 'Edit cells', 'Generate charts'],
    },
    {
      name: 'pdf-reader',
      displayName: 'PDF Reader',
      description: 'Extract text and data from PDF documents',
      keywords: ['pdf', 'document', 'text', 'extract'],
      category: 'document',
      capabilities: ['Extract text', 'Parse tables', 'Get metadata'],
    },
    {
      name: 'image-generator',
      displayName: 'Image Generator',
      description: 'Generate images using AI',
      keywords: ['image', 'generate', 'ai', 'picture'],
      category: 'creative',
      capabilities: ['Generate images', 'Edit images'],
    },
  ];

  private contents: Map<string, string> = new Map([
    ['excel-handler', '# Excel Handler\n\nDetailed documentation for Excel handling...'],
    ['pdf-reader', '# PDF Reader\n\nDetailed documentation for PDF reading...'],
    ['image-generator', '# Image Generator\n\nDetailed documentation for image generation...'],
  ]);

  async initialize(): Promise<void> {
    // Mock initialization
  }

  async listSkills(): Promise<SkillMetadata[]> {
    return this.metadata;
  }

  async loadSkillContent(skillName: string): Promise<string> {
    const content = this.contents.get(skillName);
    if (!content) {
      throw new Error(`Skill not found: ${skillName}`);
    }
    return content;
  }

  async loadSkillsContent(skillNames: string[]): Promise<Map<string, string>> {
    const results = new Map<string, string>();
    for (const name of skillNames) {
      const content = this.contents.get(name);
      if (content) {
        results.set(name, content);
      }
    }
    return results;
  }

  async hasSkill(skillName: string): Promise<boolean> {
    return this.contents.has(skillName);
  }
}

describe('SkillsRegistry', () => {
  let registry: SkillsRegistry;
  let adapter: MockSkillsAdapter;

  beforeEach(async () => {
    adapter = new MockSkillsAdapter();
    registry = new SkillsRegistry({ adapter });
    await registry.initialize();
  });

  afterEach(async () => {
    await registry.cleanup();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      const newAdapter = new MockSkillsAdapter();
      const newRegistry = new SkillsRegistry({ adapter: newAdapter });

      await expect(newRegistry.initialize()).resolves.not.toThrow();
    });

    it('should load all skill metadata', async () => {
      const metadata = registry.getAllMetadata();

      expect(metadata).toHaveLength(3);
      expect(metadata.map((m) => m.name)).toEqual([
        'excel-handler',
        'pdf-reader',
        'image-generator',
      ]);
    });

    it('should throw error if used before initialization', async () => {
      const newAdapter = new MockSkillsAdapter();
      const newRegistry = new SkillsRegistry({ adapter: newAdapter });

      await expect(newRegistry.match('test')).rejects.toThrow('SkillsRegistry not initialized');
    });
  });

  describe('keyword matching', () => {
    it('should match skills by keywords', async () => {
      const matches = await registry.match('excel spreadsheet');

      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].name).toBe('excel-handler');
      expect(matches[0].matchType).toBe('keyword');
      expect(matches[0].score).toBeGreaterThan(0);
    });

    it('should match skills by name', async () => {
      const matches = await registry.match('pdf');

      expect(matches.length).toBeGreaterThan(0);
      expect(matches.some((m) => m.name === 'pdf-reader')).toBe(true);
    });

    it('should match skills by description', async () => {
      const matches = await registry.match('generate images');

      expect(matches.length).toBeGreaterThan(0);
      expect(matches.some((m) => m.name === 'image-generator')).toBe(true);
    });

    it('should return empty array if no matches', async () => {
      const matches = await registry.match('nonexistent skill xyz');

      expect(matches).toHaveLength(0);
    });

    it('should respect maxResults option', async () => {
      const matches = await registry.match('data', { maxResults: 1 });

      expect(matches.length).toBeLessThanOrEqual(1);
    });

    it('should respect minScore option', async () => {
      const matches = await registry.match('data', { minScore: 0.9 });

      expect(matches.every((m) => m.score >= 0.9)).toBe(true);
    });

    it('should filter by category', async () => {
      const matches = await registry.match('data', { category: 'data' });

      expect(matches.every((m) => m.category === 'data')).toBe(true);
    });

    it('should sort by relevance score', async () => {
      const matches = await registry.match('excel data');

      // Check that scores are in descending order
      for (let i = 0; i < matches.length - 1; i++) {
        expect(matches[i].score).toBeGreaterThanOrEqual(matches[i + 1].score);
      }
    });
  });

  describe('content loading', () => {
    it('should load skill content', async () => {
      const content = await registry.loadSkillContent('excel-handler');

      expect(content).toContain('Excel Handler');
      expect(content).toContain('Detailed documentation');
    });

    it('should throw error for non-existent skill', async () => {
      await expect(registry.loadSkillContent('nonexistent')).rejects.toThrow();
    });

    it('should batch load multiple skills', async () => {
      const contents = await registry.loadSkillsContent(['excel-handler', 'pdf-reader']);

      expect(contents.size).toBe(2);
      expect(contents.has('excel-handler')).toBe(true);
      expect(contents.has('pdf-reader')).toBe(true);
    });

    it('should handle errors in batch loading gracefully', async () => {
      // Mock console.error to avoid noise in test output
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {
        // Intentionally empty to suppress console output
      });

      const contents = await registry.loadSkillsContent([
        'excel-handler',
        'nonexistent',
        'pdf-reader',
      ]);

      // Should still load valid skills
      expect(contents.size).toBe(2);
      expect(contents.has('excel-handler')).toBe(true);
      expect(contents.has('pdf-reader')).toBe(true);
      expect(contents.has('nonexistent')).toBe(false);

      consoleError.mockRestore();
    });
  });

  describe('skill existence check', () => {
    it('should check if skill exists', async () => {
      const exists = await registry.hasSkill('excel-handler');
      expect(exists).toBe(true);
    });

    it('should return false for non-existent skill', async () => {
      const exists = await registry.hasSkill('nonexistent');
      expect(exists).toBe(false);
    });
  });

  describe('token optimization', () => {
    it('should reduce token count by loading only matched skills', async () => {
      // Simulate a query that matches only 1 skill
      const matches = await registry.match('excel', { maxResults: 1 });
      const contents = await registry.loadSkillsContent(matches.map((m) => m.name));

      // Calculate approximate token count
      const totalSize = Array.from(contents.values()).reduce(
        (sum, content) => sum + content.length,
        0,
      );

      // Should be much less than loading all skills
      const allMetadata = registry.getAllMetadata();
      expect(contents.size).toBeLessThan(allMetadata.length);

      console.log(`Loaded ${contents.size}/${allMetadata.length} skills`);
      console.log(`Total content size: ~${totalSize} chars`);
    });
  });
});
