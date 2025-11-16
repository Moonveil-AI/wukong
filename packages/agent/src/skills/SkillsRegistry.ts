/**
 * Skills Registry
 *
 * Manages skill discovery, matching, and lazy loading.
 * Uses adapters to support different storage backends.
 */

import type { EmbeddingAdapter } from '../types/adapters';
import type {
  MatchOptions,
  MatchedSkill,
  SkillMetadata,
  SkillsAdapter,
  SkillsRegistryConfig,
} from './types';

/**
 * Central registry for managing skills
 */
export class SkillsRegistry {
  private adapter: SkillsAdapter;
  private embeddings?: EmbeddingAdapter;
  private metadata: SkillMetadata[] = [];
  private matchOptions: Required<Omit<MatchOptions, 'category'>>;
  private initialized = false;

  constructor(config: SkillsRegistryConfig) {
    this.adapter = config.adapter;
    this.embeddings = config.embeddings;

    // Set default match options
    this.matchOptions = {
      maxResults: config.matchOptions?.maxResults ?? 5,
      minScore: config.matchOptions?.minScore ?? 0.3,
      enableSemantic: config.matchOptions?.enableSemantic ?? false,
    };
  }

  /**
   * Initialize the registry
   * Must be called before using the registry
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    await this.adapter.initialize();
    this.metadata = await this.adapter.listSkills();
    this.initialized = true;
  }

  /**
   * Match relevant skills based on a query
   * Uses keyword matching and optionally semantic matching
   *
   * @param query - User query or goal
   * @param options - Override default match options
   * @returns Array of matched skills sorted by relevance
   */
  async match(query: string, options?: MatchOptions): Promise<MatchedSkill[]> {
    if (!this.initialized) {
      throw new Error('SkillsRegistry not initialized. Call initialize() first.');
    }

    const matchOpts = {
      ...this.matchOptions,
      ...options,
    };

    const matches: MatchedSkill[] = [];

    // 1. Keyword matching (fast, exact)
    const keywordMatches = this.matchByKeywords(query, matchOpts.category);
    matches.push(...keywordMatches);

    // 2. Semantic matching (slow, fuzzy) - optional
    if (matchOpts.enableSemantic && this.embeddings) {
      const semanticMatches = await this.matchBySemantic(query, matchOpts.category);
      matches.push(...semanticMatches);
    }

    // 3. Merge and deduplicate
    const uniqueMatches = this.deduplicateMatches(matches);

    // 4. Filter, sort, and limit
    return uniqueMatches
      .filter((m) => m.score >= matchOpts.minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, matchOpts.maxResults);
  }

  /**
   * Load the full content for a specific skill
   * Content is lazy-loaded only when needed
   *
   * @param skillName - Name of the skill
   * @returns Full SKILL.md content
   */
  async loadSkillContent(skillName: string): Promise<string> {
    if (!this.initialized) {
      throw new Error('SkillsRegistry not initialized. Call initialize() first.');
    }

    return await this.adapter.loadSkillContent(skillName);
  }

  /**
   * Load content for multiple skills at once
   * More efficient than loading one by one
   *
   * @param skillNames - Array of skill names
   * @returns Map of skill name to content
   */
  async loadSkillsContent(skillNames: string[]): Promise<Map<string, string>> {
    if (!this.initialized) {
      throw new Error('SkillsRegistry not initialized. Call initialize() first.');
    }

    // Use adapter's batch method if available
    if (this.adapter.loadSkillsContent) {
      return await this.adapter.loadSkillsContent(skillNames);
    }

    // Fallback: Load one by one
    const results = new Map<string, string>();

    await Promise.all(
      skillNames.map(async (name) => {
        try {
          const content = await this.loadSkillContent(name);
          results.set(name, content);
        } catch (error) {
          console.error(
            `[SkillsRegistry] Failed to load skill "${name}":`,
            error instanceof Error ? error.message : error,
          );
        }
      }),
    );

    return results;
  }

  /**
   * Get all skill metadata
   * @returns Array of all skill metadata
   */
  getAllMetadata(): SkillMetadata[] {
    return this.metadata;
  }

  /**
   * Check if a skill exists
   * @param skillName - Name of the skill
   * @returns True if the skill exists
   */
  async hasSkill(skillName: string): Promise<boolean> {
    if (this.adapter.hasSkill) {
      return await this.adapter.hasSkill(skillName);
    }

    // Fallback: Check metadata
    return this.metadata.some((m) => m.name === skillName);
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    if (this.adapter.cleanup) {
      await this.adapter.cleanup();
    }
  }

  /**
   * Match skills by keywords
   * Fast, exact matching based on skill keywords
   */
  private matchByKeywords(query: string, category?: string): MatchedSkill[] {
    const lowerQuery = query.toLowerCase();
    const matches: MatchedSkill[] = [];

    // Filter by category if specified
    const skills = category ? this.metadata.filter((s) => s.category === category) : this.metadata;

    for (const skill of skills) {
      let matchCount = 0;

      // Check keywords
      for (const keyword of skill.keywords) {
        if (lowerQuery.includes(keyword.toLowerCase())) {
          matchCount++;
        }
      }

      // Also check if query appears in name or description
      if (
        lowerQuery.includes(skill.name.toLowerCase()) ||
        skill.displayName.toLowerCase().includes(lowerQuery) ||
        skill.description.toLowerCase().includes(lowerQuery)
      ) {
        matchCount += 2; // Boost for name/description matches
      }

      if (matchCount > 0) {
        // Calculate score based on match count and total keywords
        const score = Math.min(matchCount / (skill.keywords.length + 2), 1.0);

        matches.push({
          ...skill,
          score,
          matchType: 'keyword',
        });
      }
    }

    return matches;
  }

  /**
   * Match skills using semantic similarity
   * Requires embeddings provider
   */
  private async matchBySemantic(query: string, category?: string): Promise<MatchedSkill[]> {
    if (!this.embeddings) {
      return [];
    }

    try {
      // Generate embedding for query
      const queryResult = await this.embeddings.generate(query);
      const queryEmbedding = queryResult.embedding;

      // Filter by category if specified
      const skills = category
        ? this.metadata.filter((s) => s.category === category)
        : this.metadata;

      // For each skill, generate embedding and calculate similarity
      const matches: MatchedSkill[] = [];

      for (const skill of skills) {
        // Create a text representation of the skill for embedding
        const skillText = `${skill.displayName}. ${skill.description}. ${skill.keywords.join(', ')}`;
        const skillResult = await this.embeddings.generate(skillText);
        const skillEmbedding = skillResult.embedding;

        // Calculate cosine similarity
        const similarity = this.cosineSimilarity(queryEmbedding, skillEmbedding);

        if (similarity > 0) {
          matches.push({
            ...skill,
            score: similarity,
            matchType: 'semantic',
          });
        }
      }

      return matches;
    } catch (error) {
      console.error(
        '[SkillsRegistry] Semantic matching failed:',
        error instanceof Error ? error.message : error,
      );
      return [];
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      const aVal = a[i];
      const bVal = b[i];
      if (aVal === undefined || bVal === undefined) {
        continue;
      }
      dotProduct += aVal * bVal;
      normA += aVal * aVal;
      normB += bVal * bVal;
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);

    if (magnitude === 0) {
      return 0;
    }

    return dotProduct / magnitude;
  }

  /**
   * Deduplicate matches and merge scores
   * If a skill is matched by both keyword and semantic, use the higher score
   */
  private deduplicateMatches(matches: MatchedSkill[]): MatchedSkill[] {
    const map = new Map<string, MatchedSkill>();

    for (const match of matches) {
      const existing = map.get(match.name);

      if (existing) {
        // Use the match with higher score
        if (match.score > existing.score) {
          // Update match type if matched by both methods
          const matchType = match.matchType !== existing.matchType ? 'both' : match.matchType;

          map.set(match.name, {
            ...match,
            matchType,
          });
        } else if (match.matchType !== existing.matchType) {
          // Same score but different match types
          map.set(match.name, {
            ...existing,
            matchType: 'both',
          });
        }
      } else {
        map.set(match.name, match);
      }
    }

    return Array.from(map.values());
  }
}
