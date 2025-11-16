/**
 * Skills System
 *
 * Provides lazy-loading of skill documentation to reduce token usage.
 *
 * @example
 * ```typescript
 * // Local filesystem
 * const adapter = new LocalSkillsAdapter({ skillsPath: './skills' });
 * const registry = new SkillsRegistry({ adapter });
 * await registry.initialize();
 *
 * // Match skills
 * const matched = await registry.match('analyze Excel data');
 *
 * // Load skill contents
 * const contents = await registry.loadSkillsContent(
 *   matched.map(m => m.name)
 * );
 * ```
 */

export * from './types';
export * from './SkillsRegistry';
export * from './LocalSkillsAdapter';
