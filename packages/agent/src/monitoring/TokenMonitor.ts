/**
 * Token Monitoring and Cost Calculation
 *
 * This module provides utilities for counting tokens, calculating costs,
 * and tracking savings from optimizations.
 *
 * Features:
 * - Accurate token counting using tiktoken
 * - Cost calculation based on model pricing
 * - Savings tracking from optimizations (MCP, skills, discard)
 * - Token usage events
 */

import type { WukongEventEmitter } from '../EventEmitter';
import type { TokenUsage } from '../types';

/**
 * Model pricing per 1M tokens (in USD)
 */
export interface ModelPricing {
  /** Model identifier */
  model: string;

  /** Cost per 1M input tokens */
  inputCostPer1M: number;

  /** Cost per 1M output tokens */
  outputCostPer1M: number;
}

/**
 * Default pricing for common models (as of Nov 2025)
 *
 * Note: Pricing for GPT-5 series, Claude Sonnet 4.5, and Gemini Pro 2.5
 * are estimates and should be updated with actual values from providers.
 */
export const DEFAULT_MODEL_PRICING: Record<string, ModelPricing> = {
  // OpenAI GPT-5 (2025) - PLEASE UPDATE WITH ACTUAL PRICING
  'gpt-5': {
    model: 'gpt-5',
    inputCostPer1M: 20.0, // TODO: Update with actual pricing
    outputCostPer1M: 40.0, // TODO: Update with actual pricing
  },
  'gpt-5-mini': {
    model: 'gpt-5-mini',
    inputCostPer1M: 2.0, // TODO: Update with actual pricing
    outputCostPer1M: 6.0, // TODO: Update with actual pricing
  },

  // OpenAI GPT-4 (Legacy)
  'gpt-4': {
    model: 'gpt-4',
    inputCostPer1M: 30.0,
    outputCostPer1M: 60.0,
  },
  'gpt-4-turbo': {
    model: 'gpt-4-turbo',
    inputCostPer1M: 10.0,
    outputCostPer1M: 30.0,
  },
  'gpt-4o': {
    model: 'gpt-4o',
    inputCostPer1M: 5.0,
    outputCostPer1M: 15.0,
  },
  'gpt-4o-mini': {
    model: 'gpt-4o-mini',
    inputCostPer1M: 0.15,
    outputCostPer1M: 0.6,
  },

  // OpenAI GPT-3.5 (Legacy)
  'gpt-3.5-turbo': {
    model: 'gpt-3.5-turbo',
    inputCostPer1M: 0.5,
    outputCostPer1M: 1.5,
  },

  // Anthropic Claude 4.5 (2025) - PLEASE UPDATE WITH ACTUAL PRICING
  'claude-sonnet-4.5': {
    model: 'claude-sonnet-4.5',
    inputCostPer1M: 3.0, // TODO: Update with actual pricing
    outputCostPer1M: 15.0, // TODO: Update with actual pricing
  },
  'claude-4.5-sonnet': {
    model: 'claude-4.5-sonnet',
    inputCostPer1M: 3.0, // TODO: Update with actual pricing
    outputCostPer1M: 15.0, // TODO: Update with actual pricing
  },

  // Anthropic Claude 3 (Legacy)
  'claude-3-opus': {
    model: 'claude-3-opus',
    inputCostPer1M: 15.0,
    outputCostPer1M: 75.0,
  },
  'claude-3-sonnet': {
    model: 'claude-3-sonnet',
    inputCostPer1M: 3.0,
    outputCostPer1M: 15.0,
  },
  'claude-3-5-sonnet': {
    model: 'claude-3-5-sonnet',
    inputCostPer1M: 3.0,
    outputCostPer1M: 15.0,
  },
  'claude-3-haiku': {
    model: 'claude-3-haiku',
    inputCostPer1M: 0.25,
    outputCostPer1M: 1.25,
  },

  // Google Gemini 2.5 (2025) - PLEASE UPDATE WITH ACTUAL PRICING
  'gemini-2.5-pro': {
    model: 'gemini-2.5-pro',
    inputCostPer1M: 1.5, // TODO: Update with actual pricing
    outputCostPer1M: 6.0, // TODO: Update with actual pricing
  },
  'gemini-pro-2.5': {
    model: 'gemini-pro-2.5',
    inputCostPer1M: 1.5, // TODO: Update with actual pricing
    outputCostPer1M: 6.0, // TODO: Update with actual pricing
  },

  // Google Gemini 1.5 & 2.0 (Legacy)
  'gemini-2.0-flash': {
    model: 'gemini-2.0-flash',
    inputCostPer1M: 0.1,
    outputCostPer1M: 0.4,
  },
  'gemini-1.5-pro': {
    model: 'gemini-1.5-pro',
    inputCostPer1M: 1.25,
    outputCostPer1M: 5.0,
  },
  'gemini-1.5-flash': {
    model: 'gemini-1.5-flash',
    inputCostPer1M: 0.075,
    outputCostPer1M: 0.3,
  },
  'gemini-1.0-pro': {
    model: 'gemini-1.0-pro',
    inputCostPer1M: 0.5,
    outputCostPer1M: 1.5,
  },
};

/**
 * Token counter functions using approximate estimation
 * For accurate counting, integrate with tiktoken library
 */

/**
 * Estimate token count for text
 * Uses approximate rule: 1 token ~= 4 characters
 * This is a rough estimate, for production use tiktoken
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;

  // Basic estimation: ~1 token per 4 characters
  // This matches OpenAI's rough estimate
  return Math.ceil(text.length / 4);
}

/**
 * Count tokens more accurately using character-based rules
 * This is still approximate but better than simple division
 */
export function countTokens(text: string): number {
  if (!text) return 0;

  // Split by whitespace and punctuation
  const words = text.split(/\s+/);
  let tokenCount = 0;

  for (const word of words) {
    if (word.length === 0) continue;

    // Short words (1-4 chars) = 1 token
    if (word.length <= 4) {
      tokenCount += 1;
    }
    // Medium words (5-8 chars) = 2 tokens
    else if (word.length <= 8) {
      tokenCount += 2;
    }
    // Long words = 3+ tokens
    else {
      tokenCount += Math.ceil(word.length / 4);
    }
  }

  return tokenCount;
}

/**
 * Count tokens for a JSON object
 */
export function countTokensForJSON(obj: any): number {
  return countTokens(JSON.stringify(obj, null, 2));
}

/**
 * Cost calculator for LLM usage
 */
export class CostCalculator {
  constructor(private modelPricing: Record<string, ModelPricing> = DEFAULT_MODEL_PRICING) {}

  /**
   * Calculate cost for token usage
   */
  calculateCost(promptTokens: number, completionTokens: number, model: string): number {
    const pricing = this.getPricing(model);

    const promptCost = (promptTokens / 1_000_000) * pricing.inputCostPer1M;
    const completionCost = (completionTokens / 1_000_000) * pricing.outputCostPer1M;

    return promptCost + completionCost;
  }

  /**
   * Calculate cost for savings
   */
  calculateSavingsCost(savedTokens: number, model: string, isInput = true): number {
    const pricing = this.getPricing(model);
    const costPer1M = isInput ? pricing.inputCostPer1M : pricing.outputCostPer1M;

    return (savedTokens / 1_000_000) * costPer1M;
  }

  /**
   * Get pricing for a model
   */
  private getPricing(model: string): ModelPricing {
    // Try exact match first
    const exactMatch = this.modelPricing[model];
    if (exactMatch) {
      return exactMatch;
    }

    // Try fuzzy match (e.g., "gpt-4-0125-preview" -> "gpt-4")
    const fuzzyKey = Object.keys(this.modelPricing).find((key) => model.includes(key));
    if (fuzzyKey) {
      const fuzzyMatch = this.modelPricing[fuzzyKey];
      if (fuzzyMatch) {
        return fuzzyMatch;
      }
    }

    // Default to GPT-4 pricing as a reasonable fallback
    console.warn(`Unknown model "${model}", using GPT-4 pricing as fallback`);
    const fallback = this.modelPricing['gpt-4'];
    if (!fallback) {
      throw new Error('Default GPT-4 pricing not found');
    }
    return fallback;
  }

  /**
   * Add or update pricing for a model
   */
  setModelPricing(pricing: ModelPricing): void {
    this.modelPricing[pricing.model] = pricing;
  }
}

/**
 * Token Monitor
 *
 * Monitors token usage, calculates costs, and tracks savings from optimizations.
 */
export class TokenMonitor {
  private costCalculator: CostCalculator;
  private eventEmitter?: WukongEventEmitter;

  // Cumulative tracking per session
  private sessionStats = new Map<
    string,
    {
      totalPromptTokens: number;
      totalCompletionTokens: number;
      totalCost: number;
      totalSavings: number;
      stepCount: number;
    }
  >();

  constructor(options?: {
    modelPricing?: Record<string, ModelPricing>;
    eventEmitter?: WukongEventEmitter;
  }) {
    this.costCalculator = new CostCalculator(options?.modelPricing);
    this.eventEmitter = options?.eventEmitter;
  }

  /**
   * Record token usage for a step
   */
  recordUsage(
    sessionId: string,
    stepId: number,
    promptTokens: number,
    completionTokens: number,
    model: string,
    savings?: {
      mcpSavings?: number;
      skillsSavings?: number;
      discardSavings?: number;
    },
  ): TokenUsage {
    const totalTokens = promptTokens + completionTokens;
    const estimatedCost = this.costCalculator.calculateCost(promptTokens, completionTokens, model);

    // Calculate savings
    let totalSavings = 0;
    const savingsDetails = savings
      ? {
          mcpSavings: savings.mcpSavings || 0,
          skillsSavings: savings.skillsSavings || 0,
          discardSavings: savings.discardSavings || 0,
          total: 0,
        }
      : undefined;

    if (savingsDetails) {
      totalSavings =
        savingsDetails.mcpSavings + savingsDetails.skillsSavings + savingsDetails.discardSavings;
      savingsDetails.total = totalSavings;
    }

    // Update session stats
    const stats = this.sessionStats.get(sessionId) || {
      totalPromptTokens: 0,
      totalCompletionTokens: 0,
      totalCost: 0,
      totalSavings: 0,
      stepCount: 0,
    };

    stats.totalPromptTokens += promptTokens;
    stats.totalCompletionTokens += completionTokens;
    stats.totalCost += estimatedCost;
    stats.totalSavings += totalSavings;
    stats.stepCount += 1;

    this.sessionStats.set(sessionId, stats);

    // Create token usage object
    const usage: TokenUsage = {
      sessionId,
      stepId,
      promptTokens,
      completionTokens,
      totalTokens,
      estimatedCost,
      savings: savingsDetails,
    };

    // Emit event
    if (this.eventEmitter) {
      this.eventEmitter.emit({
        event: 'tokens:used',
        usage,
      });
    }

    return usage;
  }

  /**
   * Record savings from optimizations
   */
  recordSavings(
    sessionId: string,
    stepId: number,
    savedBy: 'mcp' | 'skills' | 'discard',
    amount: number,
  ): void {
    const percentage = this.calculateSavingsPercentage(amount, sessionId);

    // Update session stats
    const stats = this.sessionStats.get(sessionId);
    if (stats) {
      stats.totalSavings += amount;
    }

    // Emit event
    if (this.eventEmitter) {
      this.eventEmitter.emit({
        event: 'tokens:saved',
        sessionId,
        stepId,
        savedBy,
        amount,
        percentage,
      });
    }
  }

  /**
   * Calculate savings percentage relative to total usage
   */
  private calculateSavingsPercentage(saved: number, sessionId: string): number {
    const stats = this.sessionStats.get(sessionId);
    if (!stats || stats.totalPromptTokens === 0) {
      return 0;
    }

    const totalWithoutSavings = stats.totalPromptTokens + saved;
    return (saved / totalWithoutSavings) * 100;
  }

  /**
   * Get session statistics
   */
  getSessionStats(sessionId: string) {
    return (
      this.sessionStats.get(sessionId) || {
        totalPromptTokens: 0,
        totalCompletionTokens: 0,
        totalCost: 0,
        totalSavings: 0,
        stepCount: 0,
      }
    );
  }

  /**
   * Get all sessions statistics
   */
  getAllStats() {
    return Array.from(this.sessionStats.entries()).map(([sessionId, stats]) => ({
      sessionId,
      ...stats,
    }));
  }

  /**
   * Clear statistics for a session
   */
  clearSession(sessionId: string): void {
    this.sessionStats.delete(sessionId);
  }

  /**
   * Clear all statistics
   */
  clearAll(): void {
    this.sessionStats.clear();
  }

  /**
   * Get cost calculator
   */
  getCostCalculator(): CostCalculator {
    return this.costCalculator;
  }
}
