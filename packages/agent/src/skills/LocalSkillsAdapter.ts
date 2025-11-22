/**
 * Local Filesystem Skills Adapter
 *
 * Loads skills from a local directory structure:
 * skills/
 *   skill-name/
 *     metadata.json
 *     SKILL.md
 */

import type { SkillMetadata, SkillsAdapter } from './types';

export interface LocalSkillsAdapterConfig {
  /** Path to the skills directory */
  skillsPath: string;

  /** Enable content caching (default: true) */
  enableCache?: boolean;
}

/**
 * Loads skills from local filesystem
 */
export class LocalSkillsAdapter implements SkillsAdapter {
  private skillsPath: string;
  private enableCache: boolean;
  private contentCache: Map<string, string> = new Map();
  private metadata: SkillMetadata[] = [];

  constructor(config: LocalSkillsAdapterConfig) {
    this.skillsPath = config.skillsPath;
    this.enableCache = config.enableCache ?? true;
  }

  async initialize(): Promise<void> {
    try {
      const { readdir, readFile } = await import('node:fs/promises');
      const { join } = await import('node:path');

      // Scan skills directory
      const entries = await readdir(this.skillsPath, { withFileTypes: true });

      // Load metadata for each skill directory
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const metadataPath = join(this.skillsPath, entry.name, 'metadata.json');

        try {
          const content = await readFile(metadataPath, 'utf-8');
          const metadata = JSON.parse(content) as SkillMetadata;

          // Ensure name matches directory name
          if (!metadata.name) {
            metadata.name = entry.name;
          }

          this.metadata.push(metadata);
        } catch {
          // Silently skip skills with missing or invalid metadata
        }
      }
    } catch (error) {
      throw new Error(
        `Failed to initialize LocalSkillsAdapter: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  listSkills(): Promise<SkillMetadata[]> {
    return Promise.resolve(this.metadata);
  }

  async loadSkillContent(skillName: string): Promise<string> {
    // Check cache first
    if (this.enableCache && this.contentCache.has(skillName)) {
      const cached = this.contentCache.get(skillName);
      if (cached) {
        return cached;
      }
    }

    const { readFile } = await import('node:fs/promises');
    const { join } = await import('node:path');

    // Load SKILL.md
    const skillPath = join(this.skillsPath, skillName, 'SKILL.md');

    try {
      const content = await readFile(skillPath, 'utf-8');

      // Cache if enabled
      if (this.enableCache) {
        this.contentCache.set(skillName, content);
      }

      return content;
    } catch (error) {
      throw new Error(
        `Failed to load skill content for "${skillName}": ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async loadSkillsContent(skillNames: string[]): Promise<Map<string, string>> {
    const results = new Map<string, string>();

    // Load all skills in parallel
    await Promise.all(
      skillNames.map(async (name) => {
        try {
          const content = await this.loadSkillContent(name);
          results.set(name, content);
        } catch (error) {
          console.error(
            `[LocalSkillsAdapter] Failed to load skill "${name}":`,
            error instanceof Error ? error.message : error,
          );
        }
      }),
    );

    return results;
  }

  async hasSkill(skillName: string): Promise<boolean> {
    return this.metadata.some((m) => m.name === skillName);
  }

  cleanup(): Promise<void> {
    // Clear cache
    this.contentCache.clear();
    return Promise.resolve();
  }
}
