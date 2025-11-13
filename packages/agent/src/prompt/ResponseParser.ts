/**
 * Response Parser
 *
 * Extracts and validates LLM responses to ensure they conform to expected formats.
 */

import { z } from 'zod';
import type { AgentAction } from '../types/index.js';

// ==========================================
// Zod Schemas for Each Action Type
// ==========================================

/**
 * Base response schema with common fields
 */
const BaseResponseSchema = z.object({
  reasoning: z.string().min(1, 'Reasoning is required'),
  discardableSteps: z.array(z.number()).optional(),
  messageToUser: z.string().optional(),
});

/**
 * CallTool action schema
 */
const CallToolSchema = BaseResponseSchema.extend({
  action: z.literal('CallTool'),
  selectedTool: z.string().min(1, 'Tool name is required'),
  parameters: z.record(z.any()).default({}),
});

/**
 * CallToolsParallel action schema
 */
const CallToolsParallelSchema = BaseResponseSchema.extend({
  action: z.literal('CallToolsParallel'),
  parallelTools: z
    .array(
      z.object({
        toolId: z.string().min(1, 'Tool ID is required'),
        toolName: z.string().min(1, 'Tool name is required'),
        parameters: z.record(z.any()).default({}),
      }),
    )
    .min(1, 'At least one tool must be specified for parallel execution'),
  waitStrategy: z.enum(['all', 'any', 'majority']),
});

/**
 * ForkAutoAgent action schema
 */
const ForkAutoAgentSchema = BaseResponseSchema.extend({
  action: z.literal('ForkAutoAgent'),
  subGoal: z.string().min(1, 'Sub-goal is required'),
  contextSummary: z.string().min(1, 'Context summary is required'),
  maxDepth: z.number().positive().optional(),
  maxSteps: z.number().positive().optional(),
  timeout: z.number().positive().optional(),
});

/**
 * AskUser action schema
 */
const AskUserSchema = BaseResponseSchema.extend({
  action: z.literal('AskUser'),
  question: z.string().min(1, 'Question is required'),
  options: z.array(z.string()).optional(),
});

/**
 * Plan action schema
 */
const PlanSchema = BaseResponseSchema.extend({
  action: z.literal('Plan'),
  plan: z.object({
    steps: z.array(
      z.object({
        action: z.enum([
          'CallTool',
          'CallToolsParallel',
          'ForkAutoAgent',
          'AskUser',
          'Plan',
          'Finish',
        ]),
        description: z.string(),
        estimatedTime: z.number().optional(),
      }),
    ),
    totalEstimatedTime: z.number().optional(),
    estimatedTokens: z.number().optional(),
  }),
});

/**
 * Finish action schema
 */
const FinishSchema = BaseResponseSchema.extend({
  action: z.literal('Finish'),
  finalResult: z.any(),
  summary: z.string().optional(),
});

/**
 * Union schema for all action types
 */
const AgentActionSchema = z.discriminatedUnion('action', [
  CallToolSchema,
  CallToolsParallelSchema,
  ForkAutoAgentSchema,
  AskUserSchema,
  PlanSchema,
  FinishSchema,
]);

// ==========================================
// Response Parser Class
// ==========================================

/**
 * Parses and validates LLM responses
 */
export class ResponseParser {
  /**
   * Extract JSON from various wrapper formats
   */
  private extractJSON(response: string): string {
    // Try to extract from <final_output> tags
    const xmlMatch = response.match(/<final_output>\s*([\s\S]*?)\s*<\/final_output>/i);
    if (xmlMatch?.[1]) {
      return xmlMatch[1].trim();
    }

    // Try to extract from code blocks
    const codeBlockMatch = response.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch?.[1]) {
      return codeBlockMatch[1].trim();
    }

    // Try to find raw JSON (look for first { to last })
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch?.[0]) {
      return jsonMatch[0].trim();
    }

    // If no wrappers found, assume the entire response is JSON
    return response.trim();
  }

  /**
   * Normalize field names from snake_case to camelCase
   */
  private normalizeFieldNames(obj: any): any {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.normalizeFieldNames(item));
    }

    const normalized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      // Convert snake_case to camelCase
      const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      normalized[camelKey] = this.normalizeFieldNames(value);
    }
    return normalized;
  }

  /**
   * Parse and validate LLM response
   *
   * @param response - Raw LLM response text
   * @returns Validated agent action
   * @throws Error if response is invalid
   */
  parse(response: string): AgentAction {
    try {
      // Extract JSON from response
      const jsonString = this.extractJSON(response);

      // Parse JSON
      let parsedData: any;
      try {
        parsedData = JSON.parse(jsonString);
      } catch (jsonError) {
        throw new Error(
          `Failed to parse JSON from LLM response: ${jsonError instanceof Error ? jsonError.message : 'Unknown error'}\n\nExtracted content:\n${jsonString.substring(0, 500)}`,
        );
      }

      // Normalize field names (snake_case to camelCase)
      const normalized = this.normalizeFieldNames(parsedData);

      // Validate with Zod
      const result = AgentActionSchema.safeParse(normalized);

      if (!result.success) {
        const errors = result.error.errors
          .map((err) => `${err.path.join('.')}: ${err.message}`)
          .join(', ');
        throw new Error(
          `Invalid LLM response format: ${errors}\n\nReceived data:\n${JSON.stringify(normalized, null, 2)}`,
        );
      }

      return result.data as AgentAction;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Unknown error while parsing LLM response: ${String(error)}`);
    }
  }

  /**
   * Validate an already-parsed action object
   *
   * @param action - Action object to validate
   * @returns Validated agent action
   * @throws Error if action is invalid
   */
  validate(action: unknown): AgentAction {
    const result = AgentActionSchema.safeParse(action);

    if (!result.success) {
      const errors = result.error.errors
        .map((err) => `${err.path.join('.')}: ${err.message}`)
        .join(', ');
      throw new Error(`Invalid action: ${errors}`);
    }

    return result.data as AgentAction;
  }

  /**
   * Check if a response string contains valid JSON
   *
   * @param response - Raw response text
   * @returns True if valid JSON can be extracted
   */
  hasValidJSON(response: string): boolean {
    try {
      const jsonString = this.extractJSON(response);
      JSON.parse(jsonString);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Extract reasoning without full parsing (useful for logging)
   *
   * @param response - Raw response text
   * @returns Reasoning string or null if not found
   */
  extractReasoning(response: string): string | null {
    try {
      const jsonString = this.extractJSON(response);
      const parsed = JSON.parse(jsonString);
      return parsed.reasoning || null;
    } catch {
      return null;
    }
  }

  /**
   * Extract action type without full parsing (useful for quick checks)
   *
   * @param response - Raw response text
   * @returns Action type or null if not found
   */
  extractActionType(response: string): string | null {
    try {
      const jsonString = this.extractJSON(response);
      const parsed = JSON.parse(jsonString);
      return parsed.action || null;
    } catch {
      return null;
    }
  }
}

/**
 * Export Zod schemas for external use if needed
 * Keys match action type names intentionally
 */
export const schemas = {
  // biome-ignore lint/style/useNamingConvention: Matches ActionType enum
  CallTool: CallToolSchema,
  // biome-ignore lint/style/useNamingConvention: Matches ActionType enum
  CallToolsParallel: CallToolsParallelSchema,
  // biome-ignore lint/style/useNamingConvention: Matches ActionType enum
  ForkAutoAgent: ForkAutoAgentSchema,
  // biome-ignore lint/style/useNamingConvention: Matches ActionType enum
  AskUser: AskUserSchema,
  // biome-ignore lint/style/useNamingConvention: Matches ActionType enum
  Plan: PlanSchema,
  // biome-ignore lint/style/useNamingConvention: Matches ActionType enum
  Finish: FinishSchema,
  // biome-ignore lint/style/useNamingConvention: Matches ActionType enum
  AgentAction: AgentActionSchema,
};
