/**
 * Local Skills Adapter Tests
 */

import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LocalSkillsAdapter } from '../LocalSkillsAdapter';

describe('LocalSkillsAdapter', () => {
  let testDir: string;
  let adapter: LocalSkillsAdapter;

  beforeEach(async () => {
    // Create temporary test directory
    testDir = join(tmpdir(), `wukong-skills-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });

    // Create test skills
    await createTestSkill(testDir, 'test-skill-1', {
      name: 'test-skill-1',
      displayName: 'Test Skill 1',
      description: 'A test skill for unit testing',
      keywords: ['test', 'unit', 'mock'],
      category: 'testing',
    });

    await createTestSkill(testDir, 'test-skill-2', {
      name: 'test-skill-2',
      displayName: 'Test Skill 2',
      description: 'Another test skill',
      keywords: ['test', 'integration'],
      category: 'testing',
    });

    adapter = new LocalSkillsAdapter({ skillsPath: testDir });
  });

  afterEach(async () => {
    // Clean up
    await adapter.cleanup();
    await rm(testDir, { recursive: true, force: true });
  });

  describe('initialization', () => {
    it('should initialize and load metadata', async () => {
      await adapter.initialize();

      const skills = await adapter.listSkills();
      expect(skills).toHaveLength(2);
      expect(skills.map((s) => s.name)).toContain('test-skill-1');
      expect(skills.map((s) => s.name)).toContain('test-skill-2');
    });

    it('should handle missing metadata gracefully', async () => {
      // Create a skill without metadata.json
      const badSkillDir = join(testDir, 'bad-skill');
      await mkdir(badSkillDir);
      await writeFile(join(badSkillDir, 'SKILL.md'), '# Bad Skill');

      await adapter.initialize();

      // Should still load valid skills
      const skills = await adapter.listSkills();
      expect(skills).toHaveLength(2); // Only the 2 valid skills
    });

    it('should throw error if directory does not exist', async () => {
      const badAdapter = new LocalSkillsAdapter({
        skillsPath: '/nonexistent/path',
      });

      await expect(badAdapter.initialize()).rejects.toThrow();
    });
  });

  describe('content loading', () => {
    beforeEach(async () => {
      await adapter.initialize();
    });

    it('should load skill content', async () => {
      const content = await adapter.loadSkillContent('test-skill-1');

      expect(content).toContain('Test Skill 1');
      expect(content).toContain('This is a test skill');
    });

    it('should cache content when enabled', async () => {
      const content1 = await adapter.loadSkillContent('test-skill-1');
      const content2 = await adapter.loadSkillContent('test-skill-1');

      // Should return same content (from cache)
      expect(content1).toBe(content2);
    });

    it('should not cache when disabled', async () => {
      const noCacheAdapter = new LocalSkillsAdapter({
        skillsPath: testDir,
        enableCache: false,
      });
      await noCacheAdapter.initialize();

      const content1 = await noCacheAdapter.loadSkillContent('test-skill-1');
      const content2 = await noCacheAdapter.loadSkillContent('test-skill-1');

      // Should still return same content
      expect(content1).toBe(content2);

      await noCacheAdapter.cleanup();
    });

    it('should throw error for non-existent skill', async () => {
      await expect(adapter.loadSkillContent('nonexistent')).rejects.toThrow();
    });

    it('should batch load multiple skills', async () => {
      const contents = await adapter.loadSkillsContent(['test-skill-1', 'test-skill-2']);

      expect(contents.size).toBe(2);
      expect(contents.get('test-skill-1')).toContain('Test Skill 1');
      expect(contents.get('test-skill-2')).toContain('Test Skill 2');
    });
  });

  describe('skill existence check', () => {
    beforeEach(async () => {
      await adapter.initialize();
    });

    it('should check if skill exists', async () => {
      const exists = await adapter.hasSkill('test-skill-1');
      expect(exists).toBe(true);
    });

    it('should return false for non-existent skill', async () => {
      const exists = await adapter.hasSkill('nonexistent');
      expect(exists).toBe(false);
    });
  });
});

/**
 * Helper function to create a test skill
 */
async function createTestSkill(
  baseDir: string,
  name: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  const skillDir = join(baseDir, name);
  await mkdir(skillDir, { recursive: true });

  // Create metadata.json
  await writeFile(join(skillDir, 'metadata.json'), JSON.stringify(metadata, null, 2));

  // Create SKILL.md
  await writeFile(
    join(skillDir, 'SKILL.md'),
    `# ${metadata.displayName}\n\nThis is a test skill for unit testing.\n\n## Usage\n\nUse this skill for testing purposes.`,
  );
}
