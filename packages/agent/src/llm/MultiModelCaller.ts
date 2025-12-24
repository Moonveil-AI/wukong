/**
 * Multi-Model LLM Caller
 *
 * This module provides a robust fallback mechanism for calling multiple LLM providers.
 * It tries models in order and falls back to the next on failure, with response validation
 * and JSON extraction utilities.
 *
 * Features:
 * - Try multiple LLM models in order
 * - Automatic fallback on failures
 * - Response validation
 * - JSON extraction from various formats (XML tags, code blocks, plain JSON)
 * - Retry logic with exponential backoff
 * - Error classification (retryable vs non-retryable)
 */

import type { LLMAdapter, LLMCallOptions, LLMCallResponse } from '../types/adapters';

/**
 * LLM adapter with optional instruction for intelligent model selection
 */
export interface LLMAdapterWithInstruction {
  /** Custom instruction describing when to use this model */
  instruction: string;
  /** The LLM adapter instance */
  adapter: LLMAdapter;
}

/**
 * Type for model input - supports both plain adapters and adapters with instructions
 */
export type LLMAdapterInput = LLMAdapter | LLMAdapterWithInstruction;

/**
 * Check if input is an adapter with instruction
 */
function isAdapterWithInstruction(input: LLMAdapterInput): input is LLMAdapterWithInstruction {
  return (
    typeof input === 'object' &&
    input !== null &&
    'instruction' in input &&
    'adapter' in input &&
    typeof (input as LLMAdapterWithInstruction).instruction === 'string'
  );
}

/**
 * Configuration for MultiModelCaller
 */
export interface MultiModelCallerConfig {
  /** Array of LLM adapters to try in order (supports both plain adapters and adapters with instructions) */
  models: LLMAdapterInput[];

  /** Whether to validate responses */
  validateResponse?: boolean;

  /** Maximum retries per model */
  maxRetriesPerModel?: number;

  /** Timeout per model in seconds */
  timeoutPerModel?: number;

  /** Whether to extract JSON from responses */
  autoExtractJson?: boolean;

  /** Enable intelligent model selection based on instructions (requires at least one adapter with instruction) */
  enableIntelligentSelection?: boolean;
}

/**
 * Error classification result
 */
interface ErrorClassification {
  /** Whether this error is retryable */
  isRetryable: boolean;

  /** Error category */
  category:
    | 'rate_limit'
    | 'timeout'
    | 'network'
    | 'auth'
    | 'invalid_request'
    | 'server_error'
    | 'unknown';

  /** Original error */
  error: Error;
}

/**
 * Model call result
 */
interface ModelCallResult {
  /** Whether the call succeeded */
  success: boolean;

  /** Response (if successful) */
  response?: LLMCallResponse;

  /** Error (if failed) */
  error?: Error;

  /** Error classification */
  errorClassification?: ErrorClassification;

  /** Model index that was used */
  modelIndex: number;

  /** Number of retries used */
  retriesUsed: number;
}

/**
 * Normalized model entry with adapter and optional instruction
 */
interface NormalizedModelEntry {
  adapter: LLMAdapter;
  instruction?: string;
}

/**
 * Multi-Model LLM Caller
 *
 * Provides fallback mechanism for calling multiple LLM providers with automatic
 * retry logic and response validation.
 */
export class MultiModelCaller {
  private readonly config: Required<MultiModelCallerConfig>;
  private readonly normalizedModels: NormalizedModelEntry[];

  constructor(config: MultiModelCallerConfig) {
    if (!config.models || config.models.length === 0) {
      throw new Error('MultiModelCaller requires at least one LLM adapter');
    }

    this.config = {
      models: config.models,
      validateResponse: config.validateResponse ?? true,
      maxRetriesPerModel: config.maxRetriesPerModel ?? 2,
      timeoutPerModel: config.timeoutPerModel ?? 120,
      autoExtractJson: config.autoExtractJson ?? false,
      enableIntelligentSelection: config.enableIntelligentSelection ?? true,
    };

    // Normalize models to a consistent format
    this.normalizedModels = config.models.map((model) => {
      if (isAdapterWithInstruction(model)) {
        return { adapter: model.adapter, instruction: model.instruction };
      }
      return { adapter: model };
    });
  }

  /**
   * Check if any model has instructions configured
   */
  private hasInstructionModels(): boolean {
    return this.normalizedModels.some((m) => m.instruction !== undefined);
  }

  /**
   * Select the best model based on the user's query and model instructions
   * Uses the first available model to compare the query against instructions
   */
  private async selectBestModel(query: string): Promise<number> {
    // If intelligent selection is disabled or no models have instructions, use the first model
    if (!this.config.enableIntelligentSelection || !this.hasInstructionModels()) {
      return 0;
    }

    // Get models with instructions
    const modelsWithInstructions = this.normalizedModels
      .map((m, index) => ({ ...m, index }))
      .filter((m): m is { adapter: LLMAdapter; instruction: string; index: number } =>
        m.instruction !== undefined
      );

    // If no models have instructions, return first model
    if (modelsWithInstructions.length === 0) {
      return 0;
    }

    // If only one model has instructions, use it
    if (modelsWithInstructions.length === 1) {
      const singleModel = modelsWithInstructions[0];
      return singleModel ? singleModel.index : 0;
    }

    // Use the first available model to select the best match
    const firstModel = this.normalizedModels[0];
    if (!firstModel) {
      return 0;
    }
    const selectorModel = firstModel.adapter;

    // Extract goal description from query if wrapped in tags
    const goalMatch = query.match(/<goal_description>([\s\S]*?)<\/goal_description>/);
    const goalText = goalMatch?.[1]?.trim() || query;

    const selectionPrompt = `You are a model selector. Based on the user's query, select the most appropriate model from the following options.
      User Query: "${goalText}"
      Available Models:
      ${modelsWithInstructions.map((m, i) => `${i + 1}. ${m.instruction}`).join('\n')}

      Respond with ONLY the number (1, 2, 3, etc.) of the most appropriate model. Do not include any other text.`;

    try {
      const response = await selectorModel.call(selectionPrompt, {
        //model: 'gemini-2.0-flash',
        maxTokens: 10,
        temperature: 0,
      });
      const selectedNumber = parseInt(response.text.trim(), 10);
      if (selectedNumber >= 1 && selectedNumber <= modelsWithInstructions.length) {
        const selected = modelsWithInstructions[selectedNumber - 1];
        if (selected) {
          return selected.index;
        }
      }
   } catch {
      // If selection fails, fall back to first model by going to the end to "return 0"
   }

    return 0;
  }

  /**
   * Call LLM with streaming support and automatic fallback
   */
  async callWithStreaming(
    prompt: string,
    options: LLMCallOptions & {
      streaming: {
        onChunk?: (chunk: string) => void;
        onComplete?: (fullText: string) => void;
        onError?: (error: Error) => void;
      };
    },
  ): Promise<LLMCallResponse> {
    const errors: Array<{ modelIndex: number; error: Error }> = [];

    // Try intelligent model selection first if enabled
    const startIndex = await this.selectBestModel(prompt);
    const modelOrder = this.getModelOrder(startIndex);

    for (const i of modelOrder) {
      const modelEntry = this.normalizedModels[i];
      if (!modelEntry) {
        continue;
      }

      const adapter = modelEntry.adapter;

      // Check if model supports streaming
      if (typeof adapter.callWithStreaming !== 'function') {
        // Fall back to regular call
        continue;
      }

      try {
        const response = await adapter.callWithStreaming(prompt, options);

        // Validate response if enabled
        if (this.config.validateResponse) {
          const isValid = this.validateResponse(response);
          if (!isValid) {
            throw new Error('Response validation failed');
          }
        }

        // Extract JSON if enabled
        if (this.config.autoExtractJson) {
          response.text = this.extractJson(response.text) || response.text;
        }

        return response;
      } catch (error) {
        errors.push({
          modelIndex: i,
          error: error instanceof Error ? error : new Error(String(error)),
        });
      }
    }

    // All models failed or don't support streaming
    // Fall back to regular call
    return await this.call(prompt, options);
  }

  /**
   * Get the order of models to try, starting from the given index
   */
  private getModelOrder(startIndex: number): number[] {
    const order: number[] = [];
    const length = this.normalizedModels.length;

    // Add startIndex first, then the rest in order
    for (let i = 0; i < length; i++) {
      const index = (startIndex + i) % length;
      order.push(index);
    }

    return order;
  }

  /**
   * Call LLM with automatic fallback
   */
  async call(prompt: string, options?: LLMCallOptions): Promise<LLMCallResponse> {
    const errors: Array<{ modelIndex: number; error: Error }> = [];

    // Try intelligent model selection first if enabled
    const startIndex = await this.selectBestModel(prompt);
    const modelOrder = this.getModelOrder(startIndex);

    for (const i of modelOrder) {
      const modelEntry = this.normalizedModels[i];
      if (!modelEntry) {
        continue;
      }

      try {
        const result = await this.callWithRetry(modelEntry.adapter, prompt, options, i);

        if (result.success && result.response) {
          // Validate response if enabled
          if (this.config.validateResponse) {
            const isValid = this.validateResponse(result.response);
            if (!isValid) {
              throw new Error('Response validation failed');
            }
          }

          // Extract JSON if enabled
          if (this.config.autoExtractJson) {
            result.response.text = this.extractJson(result.response.text) || result.response.text;
          }

          return result.response;
        }

        // If we got here, the call failed
        if (result.error) {
          errors.push({ modelIndex: i, error: result.error });
        }
      } catch (error) {
        errors.push({
          modelIndex: i,
          error: error instanceof Error ? error : new Error(String(error)),
        });
      }
    }

    // All models failed
    const errorMessages = errors.map((e) => `Model ${e.modelIndex}: ${e.error.message}`).join('; ');
    throw new Error(`All LLM models failed. Errors: ${errorMessages}`);
  }

  /**
   * Call LLM with messages (chat format) with automatic fallback
   */
  async callWithMessages(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    options?: LLMCallOptions,
  ): Promise<LLMCallResponse> {
    const errors: Array<{ modelIndex: number; error: Error }> = [];

    // Extract user message for model selection
    const userMessage = messages.find((m) => m.role === 'user')?.content || '';

    // Try intelligent model selection first if enabled
    const startIndex = await this.selectBestModel(userMessage);
    const modelOrder = this.getModelOrder(startIndex);

    for (const i of modelOrder) {
      const modelEntry = this.normalizedModels[i];
      if (!modelEntry) {
        continue;
      }

      try {
        const result = await this.callWithMessagesRetry(modelEntry.adapter, messages, options, i);

        if (result.success && result.response) {
          // Validate response if enabled
          if (this.config.validateResponse) {
            const isValid = this.validateResponse(result.response);
            if (!isValid) {
              throw new Error('Response validation failed');
            }
          }

          // Extract JSON if enabled
          if (this.config.autoExtractJson) {
            result.response.text = this.extractJson(result.response.text) || result.response.text;
          }

          return result.response;
        }

        // If we got here, the call failed
        if (result.error) {
          errors.push({ modelIndex: i, error: result.error });
        }
      } catch (error) {
        errors.push({
          modelIndex: i,
          error: error instanceof Error ? error : new Error(String(error)),
        });
      }
    }

    // All models failed
    const errorMessages = errors.map((e) => `Model ${e.modelIndex}: ${e.error.message}`).join('; ');
    throw new Error(`All LLM models failed. Errors: ${errorMessages}`);
  }

  /**
   * Call a single model with retry logic
   */
  private async callWithRetry(
    model: LLMAdapter,
    prompt: string,
    options: LLMCallOptions | undefined,
    modelIndex: number,
  ): Promise<ModelCallResult> {
    let lastError: Error | undefined;
    let lastClassification: ErrorClassification | undefined;

    for (let retry = 0; retry <= this.config.maxRetriesPerModel; retry++) {
      try {
        // Merge options, ensuring timeout is set
        const callOptions = options
          ? {
              ...options,
              timeout: this.config.timeoutPerModel,
            }
          : {
              timeout: this.config.timeoutPerModel,
            };

        const response = await model.call(prompt, callOptions as LLMCallOptions);

        return {
          success: true,
          response,
          modelIndex,
          retriesUsed: retry,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        lastClassification = this.classifyError(lastError);

        // Don't retry on non-retryable errors
        if (!lastClassification.isRetryable) {
          break;
        }

        // Exponential backoff
        if (retry < this.config.maxRetriesPerModel) {
          const backoffMs = Math.min(1000 * 2 ** retry, 10000);
          await this.sleep(backoffMs);
        }
      }
    }

    return {
      success: false,
      error: lastError,
      errorClassification: lastClassification,
      modelIndex,
      retriesUsed: this.config.maxRetriesPerModel,
    };
  }

  /**
   * Call a single model with messages and retry logic
   */
  private async callWithMessagesRetry(
    model: LLMAdapter,
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    options: LLMCallOptions | undefined,
    modelIndex: number,
  ): Promise<ModelCallResult> {
    let lastError: Error | undefined;
    let lastClassification: ErrorClassification | undefined;

    for (let retry = 0; retry <= this.config.maxRetriesPerModel; retry++) {
      try {
        // Merge options, ensuring timeout is set
        const callOptions = options
          ? {
              ...options,
              timeout: this.config.timeoutPerModel,
            }
          : {
              timeout: this.config.timeoutPerModel,
            };

        const response = await model.callWithMessages(messages, callOptions as LLMCallOptions);

        return {
          success: true,
          response,
          modelIndex,
          retriesUsed: retry,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        lastClassification = this.classifyError(lastError);

        // Don't retry on non-retryable errors
        if (!lastClassification.isRetryable) {
          break;
        }

        // Exponential backoff
        if (retry < this.config.maxRetriesPerModel) {
          const backoffMs = Math.min(1000 * 2 ** retry, 10000);
          await this.sleep(backoffMs);
        }
      }
    }

    return {
      success: false,
      error: lastError,
      errorClassification: lastClassification,
      modelIndex,
      retriesUsed: this.config.maxRetriesPerModel,
    };
  }

  /**
   * Classify error to determine if it's retryable
   */
  private classifyError(error: Error): ErrorClassification {
    const message = error.message.toLowerCase();

    // Rate limit errors
    if (
      message.includes('rate limit') ||
      message.includes('too many requests') ||
      message.includes('429')
    ) {
      return {
        isRetryable: true,
        category: 'rate_limit',
        error,
      };
    }

    // Timeout errors
    if (
      message.includes('timeout') ||
      message.includes('timed out') ||
      message.includes('ETIMEDOUT')
    ) {
      return {
        isRetryable: true,
        category: 'timeout',
        error,
      };
    }

    // Network errors
    if (
      message.includes('network') ||
      message.includes('econnrefused') ||
      message.includes('enotfound') ||
      message.includes('socket')
    ) {
      return {
        isRetryable: true,
        category: 'network',
        error,
      };
    }

    // Authentication errors (not retryable)
    if (
      message.includes('unauthorized') ||
      message.includes('invalid api key') ||
      message.includes('authentication') ||
      message.includes('401')
    ) {
      return {
        isRetryable: false,
        category: 'auth',
        error,
      };
    }

    // Invalid request errors (not retryable)
    if (message.includes('invalid') || message.includes('bad request') || message.includes('400')) {
      return {
        isRetryable: false,
        category: 'invalid_request',
        error,
      };
    }

    // Server errors (retryable)
    if (
      message.includes('500') ||
      message.includes('502') ||
      message.includes('503') ||
      message.includes('504') ||
      message.includes('server error')
    ) {
      return {
        isRetryable: true,
        category: 'server_error',
        error,
      };
    }

    // Unknown errors (default to retryable)
    return {
      isRetryable: true,
      category: 'unknown',
      error,
    };
  }

  /**
   * Validate LLM response
   */
  private validateResponse(response: LLMCallResponse): boolean {
    // Check if response has text
    if (!response.text || response.text.trim().length === 0) {
      return false;
    }

    // Check if tokens are reasonable
    if (response.tokensUsed.total <= 0) {
      return false;
    }

    // Check if finish reason is valid
    if (response.finishReason === 'error') {
      return false;
    }

    return true;
  }

  /**
   * Extract JSON from various formats
   *
   * Supports:
   * - XML tags: <final_output>{...}</final_output>
   * - Code blocks: ```json {...} ```
   * - Plain JSON: {...}
   */
  extractJson(text: string): string | null {
    // Try XML tags first
    const xmlMatch = text.match(/<final_output>\s*(\{[\s\S]*?\})\s*<\/final_output>/);
    if (xmlMatch?.[1]) {
      return xmlMatch[1].trim();
    }

    // Try code blocks
    const codeBlockMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
    if (codeBlockMatch?.[1]) {
      return codeBlockMatch[1].trim();
    }

    // Try to find JSON object in text
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        // Validate it's actually JSON
        JSON.parse(jsonMatch[0]);
        return jsonMatch[0].trim();
      } catch {
        // Not valid JSON, return null
        return null;
      }
    }

    return null;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get number of available models
   */
  getModelCount(): number {
    return this.config.models.length;
  }

  /**
   * Get model capabilities
   */
  getCapabilities(modelIndex: number): ReturnType<LLMAdapter['getCapabilities']> | null {
    if (modelIndex < 0 || modelIndex >= this.normalizedModels.length) {
      return null;
    }

    const modelEntry = this.normalizedModels[modelIndex];
    if (!modelEntry) {
      return null;
    }

    return modelEntry.adapter.getCapabilities();
  }

  /**
   * Get the number of models that have instructions configured
   */
  getInstructionModelCount(): number {
    return this.normalizedModels.filter((m) => m.instruction !== undefined).length;
  }
}

/**
 * Create a multi-model caller with convenient defaults
 * Supports both plain adapters and adapters with instructions
 */
export function createMultiModelCaller(models: LLMAdapterInput[]): MultiModelCaller {
  return new MultiModelCaller({ models });
}
