/**
 * Knowledge Extractor
 *
 * Automatically extracts valuable knowledge from completed sessions.
 * Uses LLM to identify important insights, methodologies, and preferences
 * from conversation history, then stores them in the knowledge base.
 */

import type { MultiModelCaller } from '../llm/MultiModelCaller';
import type { Session, Step, StorageAdapter } from '../types';
import type { KnowledgeBaseManager } from './KnowledgeBaseManager';

/**
 * Extracted knowledge entity
 */
export interface ExtractedKnowledge {
  /** Knowledge content */
  content: string;

  /** Confidence score (0.0-1.0) */
  confidenceScore: number;

  /** Knowledge level */
  level: 'public' | 'organization' | 'individual';

  /** Knowledge type */
  type: 'methodology' | 'preference' | 'tool_selection' | 'error_lesson' | 'other';

  /** Source session ID */
  sessionId: string;
}

/**
 * Knowledge deduplication result
 */
export interface DeduplicationResult {
  /** Action taken */
  action: 'new' | 'existing' | 'merged';

  /** Reasoning for the action */
  reasoning: string;

  /** Merged content (if action is 'merged') */
  mergedContent?: string;

  /** ID of existing knowledge (if action is 'existing' or 'merged') */
  existingId?: string;
}

/**
 * Knowledge extraction options
 */
export interface ExtractionOptions {
  /** Minimum confidence score to store (default: 0.6) */
  minConfidence?: number;

  /** Maximum number of knowledge entities to extract (default: 10) */
  maxEntities?: number;

  /** Whether to skip deduplication (default: false) */
  skipDeduplication?: boolean;

  /** Minimum similarity score for deduplication (default: 0.8) */
  similarityThreshold?: number;
}

/**
 * Knowledge extraction statistics
 */
export interface ExtractionStats {
  /** Total entities extracted */
  totalExtracted: number;

  /** Entities stored as new */
  newEntities: number;

  /** Entities merged with existing */
  mergedEntities: number;

  /** Entities marked as duplicate */
  duplicateEntities: number;

  /** Entities below confidence threshold */
  lowConfidenceEntities: number;
}

/**
 * Knowledge Extractor
 *
 * Extracts knowledge from completed sessions and stores it in the knowledge base.
 */
export class KnowledgeExtractor {
  constructor(
    private readonly knowledgeBase: KnowledgeBaseManager,
    private readonly llm: MultiModelCaller,
    private readonly storage: StorageAdapter,
  ) {}

  /**
   * Extract knowledge from a completed session
   */
  async extractFromSession(
    sessionId: string,
    options: ExtractionOptions = {},
  ): Promise<ExtractionStats> {
    const {
      minConfidence = 0.6,
      maxEntities = 10,
      skipDeduplication = false,
      similarityThreshold = 0.8,
    } = options;

    // Initialize statistics
    const stats: ExtractionStats = {
      totalExtracted: 0,
      newEntities: 0,
      mergedEntities: 0,
      duplicateEntities: 0,
      lowConfidenceEntities: 0,
    };

    // 1. Get session and steps
    const session = await this.storage.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Only extract from completed or paused sessions
    if (session.status !== 'completed' && session.status !== 'paused') {
      throw new Error(`Cannot extract knowledge from session in status: ${session.status}`);
    }

    const steps = await this.storage.listSteps(sessionId);
    if (steps.length === 0) {
      return stats; // No steps to extract from
    }

    // 2. Format conversation history
    const conversationText = this.formatConversationHistory(session, steps);

    // 3. Use LLM to extract knowledge
    const extractedKnowledge = await this.extractKnowledgeWithLLM(
      conversationText,
      session,
      maxEntities,
    );

    stats.totalExtracted = extractedKnowledge.length;

    // 4. Filter by confidence
    const filteredKnowledge = extractedKnowledge.filter((k) => {
      if (k.confidenceScore < minConfidence) {
        stats.lowConfidenceEntities++;
        return false;
      }
      return true;
    });

    // 5. Deduplicate and store each knowledge entity
    for (const knowledge of filteredKnowledge) {
      try {
        if (skipDeduplication) {
          // Store directly without deduplication
          await this.storeKnowledge(knowledge, session);
          stats.newEntities++;
        } else {
          // Deduplicate before storing
          const deduplicationResult = await this.deduplicateAndStore(
            knowledge,
            session,
            similarityThreshold,
          );

          // Update statistics based on deduplication result
          switch (deduplicationResult.action) {
            case 'new':
              stats.newEntities++;
              break;
            case 'merged':
              stats.mergedEntities++;
              break;
            case 'existing':
              stats.duplicateEntities++;
              break;
          }
        }
      } catch (error) {
        // Log error but continue with other knowledge entities
        console.error('Error storing knowledge:', error);
      }
    }

    // 6. Update session's last extraction time
    await this.storage.updateSession(sessionId, {
      lastKnowledgeExtractionAt: new Date(),
    });

    return stats;
  }

  /**
   * Format conversation history for LLM
   */
  private formatConversationHistory(session: Session, steps: Step[]): string {
    const lines: string[] = [];

    lines.push('# Session Information');
    lines.push(`Goal: ${session.goal}`);
    lines.push(`Agent Type: ${session.agentType}`);
    lines.push(`Status: ${session.status}`);
    lines.push('');

    lines.push('# Conversation History');
    lines.push('');

    for (const step of steps) {
      // Skip discarded steps
      if (step.discarded) {
        continue;
      }

      lines.push(`## Step ${step.stepNumber}`);

      // Include reasoning if available
      if (step.reasoning) {
        lines.push(`**Reasoning:** ${step.reasoning}`);
      }

      // Include action and details
      lines.push(`**Action:** ${step.action}`);

      if (step.selectedTool) {
        lines.push(`**Tool:** ${step.selectedTool}`);
      }

      if (step.parameters) {
        lines.push(`**Parameters:** ${JSON.stringify(step.parameters, null, 2)}`);
      }

      // Include result or error
      if (step.stepResult) {
        lines.push(`**Result:** ${step.stepResult}`);
      } else if (step.errorMessage) {
        lines.push(`**Error:** ${step.errorMessage}`);
      }

      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Extract knowledge using LLM
   */
  private async extractKnowledgeWithLLM(
    conversationText: string,
    session: Session,
    maxEntities: number,
  ): Promise<ExtractedKnowledge[]> {
    const prompt = `# Task
Extract important knowledge entities from the given conversation session.

# Instructions for Knowledge Extraction
- Extract methodology that could be useful in the future for creating similar content
- Extract knowledge for 3 levels (public, organization, or individual):
  * public: Methodology that can be useful for similar tasks, publicly available knowledge
  * organization: Knowledge specific to the organization, not sharable outside
  * individual: Personal information and preferences, especially with privacy concerns
- For each level, combine related information into meaningful entities
- Assign a confidence score (0.0-1.0) for each knowledge piece
- Classify each knowledge by type: methodology, preference, tool_selection, error_lesson, or other
- Extract up to ${maxEntities} most valuable knowledge entities
- Only extract knowledge that would be valuable for future reference

# Knowledge Types
- **methodology**: Steps and techniques for completing tasks
- **preference**: User's style preferences and choices
- **tool_selection**: Tool choices and recommendations for specific scenarios
- **error_lesson**: Past errors and their solutions
- **other**: Other valuable insights

# Conversation
${conversationText}

# Output Format
Respond with a JSON object containing an array of knowledge entities:
{
  "knowledges": [
    {
      "content": "extracted knowledge description",
      "confidence_score": 0.8,
      "level": "public" | "organization" | "individual",
      "type": "methodology" | "preference" | "tool_selection" | "error_lesson" | "other"
    }
  ]
}

Only extract knowledge that is genuinely valuable and would be useful in future sessions.`;

    try {
      const response = await this.llm.callWithMessages(
        [
          {
            role: 'user',
            content: prompt,
          },
        ],
        {
          model: 'gpt-4', // MultiModelCaller will use configured models
          temperature: 0.3, // Lower temperature for more consistent extraction
          maxTokens: 2000,
        },
      );

      // Parse JSON response
      const jsonMatch = this.extractJSON(response.text);
      if (!jsonMatch) {
        console.warn('Failed to extract JSON from LLM response');
        return [];
      }

      const parsed = JSON.parse(jsonMatch);
      const knowledges = parsed.knowledges || [];

      // Map to ExtractedKnowledge format
      return knowledges.map(
        (k: any): ExtractedKnowledge => ({
          content: k.content,
          confidenceScore: k.confidence_score,
          level: k.level,
          type: k.type,
          sessionId: session.id,
        }),
      );
    } catch (error) {
      console.error('Error extracting knowledge with LLM:', error);
      return [];
    }
  }

  /**
   * Extract JSON from LLM response (handles various formats)
   */
  private extractJSON(text: string): string | null {
    // Try to parse the entire text as JSON first
    try {
      JSON.parse(text);
      return text;
    } catch {
      // Not direct JSON, continue with pattern matching
    }

    // Try to find JSON in code blocks
    const codeBlockMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
    if (codeBlockMatch?.[1]) {
      try {
        JSON.parse(codeBlockMatch[1]);
        return codeBlockMatch[1];
      } catch {
        // Not valid JSON
      }
    }

    // Try to find JSON in XML tags
    const xmlMatch = text.match(/<json>([\s\S]*?)<\/json>/);
    if (xmlMatch?.[1]) {
      try {
        JSON.parse(xmlMatch[1]);
        return xmlMatch[1];
      } catch {
        // Not valid JSON
      }
    }

    // Try to find plain JSON object
    const jsonMatch = text.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/);
    if (jsonMatch?.[0]) {
      try {
        JSON.parse(jsonMatch[0]);
        return jsonMatch[0];
      } catch {
        // Not valid JSON
      }
    }

    return null;
  }

  /**
   * Deduplicate and store knowledge
   */
  private async deduplicateAndStore(
    knowledge: ExtractedKnowledge,
    session: Session,
    similarityThreshold: number,
  ): Promise<DeduplicationResult> {
    // 1. Build filters based on knowledge level
    const filters = this.buildPermissionFilter(knowledge.level, session);

    // 2. Search for similar knowledge
    const similarResults = await this.knowledgeBase.search({
      query: knowledge.content,
      topK: 5,
      minScore: similarityThreshold,
      filters,
    });

    // 3. No similar knowledge found - store as new
    if (similarResults.length === 0) {
      await this.storeKnowledge(knowledge, session);
      return {
        action: 'new',
        reasoning: 'No similar knowledge found',
      };
    }

    // 4. Similar knowledge found - use LLM to compare
    const comparisonResult = await this.compareWithExisting(knowledge, similarResults);

    // 5. Handle based on comparison result
    if (comparisonResult.action === 'new') {
      await this.storeKnowledge(knowledge, session);
    } else if (
      comparisonResult.action === 'merged' &&
      comparisonResult.mergedContent &&
      comparisonResult.existingId
    ) {
      // Update existing knowledge with merged content
      this.updateKnowledge(comparisonResult.existingId, comparisonResult.mergedContent);
    }
    // If 'existing', do nothing - knowledge already exists

    return comparisonResult;
  }

  /**
   * Compare new knowledge with existing similar knowledge
   */
  private async compareWithExisting(
    newKnowledge: ExtractedKnowledge,
    similarResults: Array<{ id: string; content: string; score: number }>,
  ): Promise<DeduplicationResult> {
    const prompt = `# Task
Compare new knowledge with existing similar knowledge and decide:
1. Is the new knowledge truly new and should be stored separately?
2. Is it essentially the same as existing knowledge?
3. Should it be merged with existing knowledge to create a more comprehensive entry?

# New Knowledge
${newKnowledge.content}

# Existing Similar Knowledge
${similarResults.map((k, i) => `${i + 1}. (Score: ${k.score.toFixed(2)}) ${k.content}`).join('\n')}

# Output Format
{
  "result": "new" | "existing" | "merged",
  "reasoning": "brief explanation of the decision",
  "existing_id": "id of the most relevant existing knowledge (if result is 'existing' or 'merged')",
  "merged_content": "merged knowledge content (only if result is 'merged')"
}`;

    try {
      const response = await this.llm.callWithMessages(
        [
          {
            role: 'user',
            content: prompt,
          },
        ],
        {
          model: 'gpt-4', // MultiModelCaller will use configured models
          temperature: 0.2,
          maxTokens: 1000,
        },
      );

      const jsonMatch = this.extractJSON(response.text);
      if (!jsonMatch) {
        // Default to storing as new if we can't parse the response
        return {
          action: 'new',
          reasoning: 'Failed to parse comparison result',
        };
      }

      const parsed = JSON.parse(jsonMatch);

      return {
        action: parsed.result,
        reasoning: parsed.reasoning,
        mergedContent: parsed.merged_content,
        existingId: parsed.existing_id || (similarResults[0]?.id ?? ''),
      };
    } catch (error) {
      console.error('Error comparing knowledge:', error);
      // Default to storing as new on error
      return {
        action: 'new',
        reasoning: 'Error during comparison',
      };
    }
  }

  /**
   * Store knowledge in the knowledge base
   */
  private async storeKnowledge(knowledge: ExtractedKnowledge, session: Session): Promise<void> {
    // Use knowledge base manager to index this as a "document"
    // We'll create a synthetic document path for the extracted knowledge
    await this.knowledgeBase.indexDocuments({
      path: `knowledge/${knowledge.sessionId}/${Date.now()}.txt`,
      level: knowledge.level,
      userId: session.userId,
      organizationId: session.organizationId,
      sessionId: session.id,
      update: true,
    });

    // Note: The above approach would normally require creating actual files.
    // For extracted knowledge, a production implementation should use the
    // vector adapter directly to store embeddings without requiring file creation.
  }

  /**
   * Update existing knowledge
   */
  private updateKnowledge(knowledgeId: string, _newContent: string): void {
    // Update the knowledge content
    // This would typically involve updating the vector and metadata
    console.log(`Updating knowledge ${knowledgeId} with new content`);
    // Implementation depends on vector adapter capabilities
    // For now, we log this operation as it requires vector adapter updates
  }

  /**
   * Build permission filter based on knowledge level
   */
  private buildPermissionFilter(
    level: 'public' | 'organization' | 'individual',
    session: Session,
  ): any {
    const filter: any = {
      metadata: {
        level,
      },
    };

    if (level === 'organization' && session.organizationId) {
      filter.metadata.organizationId = session.organizationId;
    }

    if (level === 'individual' && session.userId) {
      filter.metadata.userId = session.userId;
    }

    return filter;
  }
}

/**
 * Create a knowledge extractor
 */
export function createKnowledgeExtractor(
  knowledgeBase: KnowledgeBaseManager,
  llm: MultiModelCaller,
  storage: StorageAdapter,
): KnowledgeExtractor {
  return new KnowledgeExtractor(knowledgeBase, llm, storage);
}
