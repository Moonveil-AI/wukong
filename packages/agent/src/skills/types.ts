/**
 * Skills System Type Definitions
 *
 * Provides lazy-loading of skill documentation to reduce token usage.
 */

/**
 * Metadata for a skill
 * Lightweight structure loaded at startup
 */
export interface SkillMetadata {
  /** Unique identifier for the skill */
  name: string;

  /** Human-readable display name */
  displayName: string;

  /** Brief description of what the skill does */
  description: string;

  /** Keywords for matching (used in keyword-based search) */
  keywords: string[];

  /** Optional category for grouping */
  category?: string;

  /** List of capabilities this skill provides */
  capabilities?: string[];

  /** Version of the skill */
  version?: string;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * A skill that has been matched to a query
 * Includes matching score and type
 */
export interface MatchedSkill extends SkillMetadata {
  /** Relevance score (0-1) */
  score: number;

  /** How this skill was matched */
  matchType: 'keyword' | 'semantic' | 'both';
}

/**
 * Adapter interface for loading skills from different sources
 * Implementations can load from local filesystem, S3, HTTP, etc.
 */
export interface SkillsAdapter {
  /**
   * Initialize the adapter
   * E.g., connect to S3, verify paths, load indices
   */
  initialize(): Promise<void>;

  /**
   * List all available skills
   * Returns metadata for all skills (lightweight)
   */
  listSkills(): Promise<SkillMetadata[]>;

  /**
   * Load the full documentation content for a skill
   * This is the heavyweight operation that should be lazy-loaded
   *
   * @param skillName - Name of the skill to load
   * @returns Full content of the SKILL.md file
   */
  loadSkillContent(skillName: string): Promise<string>;

  /**
   * Optional: Batch load multiple skills at once (performance optimization)
   *
   * @param skillNames - Array of skill names to load
   * @returns Map of skill name to content
   */
  loadSkillsContent?(skillNames: string[]): Promise<Map<string, string>>;

  /**
   * Optional: Check if a skill exists
   *
   * @param skillName - Name of the skill to check
   * @returns True if the skill exists
   */
  hasSkill?(skillName: string): Promise<boolean>;

  /**
   * Optional: Clean up resources
   * E.g., close connections, clear caches
   */
  cleanup?(): Promise<void>;
}

/**
 * Options for matching skills to a query
 */
export interface MatchOptions {
  /** Maximum number of skills to return */
  maxResults?: number;

  /** Minimum score threshold (0-1) */
  minScore?: number;

  /** Enable semantic matching (requires embeddings) */
  enableSemantic?: boolean;

  /** Filter by category */
  category?: string;
}

/**
 * Configuration for SkillsRegistry
 */
export interface SkillsRegistryConfig {
  /** Adapter for loading skills */
  adapter: SkillsAdapter;

  /** Optional: Embedding provider for semantic matching */
  embeddings?: any; // EmbeddingProvider type will be imported from main types

  /** Optional: Default match options */
  matchOptions?: MatchOptions;

  /** Optional: Cache skill contents in memory */
  enableCache?: boolean;
}
