/**
 * @file OpenAIAdapter.ts
 * @input Depends on openai SDK, tiktoken for token counting, @wukong/agent (LLMAdapter interface, types)
 * @output Exports OpenAIAdapter class (implements LLMAdapter), OpenAIAdapterConfig interface
 * @position LLM provider integration - OpenAI GPT API implementation. Consumed by MultiModelCaller and WukongAgent.
 *
 * SYNC: When modified, update this header and /packages/llm-openai/src/README.md
 *
 * OpenAI LLM Adapter Implementation
 *
 * This adapter provides integration with OpenAI's Responses API for GPT-5 models:
 * - GPT-5 models (gpt-5-mini, gpt-5, etc.)
 * - Streaming responses (all calls use streaming internally)
 * - Token counting with tiktoken
 * - Automatic retries with exponential backoff
 * - Rate limit handling
 *
 * Note: Only GPT-5 models are supported. All API calls use the Responses API with streaming.
 */

import type {
  LLMAdapter,
  LLMCallOptions,
  LLMCallResponse,
  LLMMessage,
  LLMStreamingOptions,
} from '@wukong/agent';
import OpenAI from 'openai';
import { type TiktokenModel, encoding_for_model } from 'tiktoken';

/**
 * OpenAI adapter configuration
 */
export interface OpenAIAdapterConfig {
  /**
   * OpenAI API key
   * If not provided, will read from OPENAI_API_KEY environment variable
   */
  apiKey?: string;

  /** Default model to use */
  model?: string;

  /** Organization ID (optional) */
  organizationId?: string;

  /** Base URL (for custom endpoints) */
  baseURL?: string;

  /** Default temperature */
  temperature?: number;

  /** Default max tokens */
  maxTokens?: number;

  /** Maximum retry attempts */
  maxRetries?: number;

  /** Timeout in milliseconds */
  timeout?: number;
}

/**
 * OpenAI LLM Adapter
 *
 * Implements the LLMAdapter interface for OpenAI models
 */
export class OpenAIAdapter implements LLMAdapter {
  private client: OpenAI;
  private config: Required<Omit<OpenAIAdapterConfig, 'organizationId' | 'baseURL'>> & {
    organizationId?: string;
    baseURL?: string;
  };

  constructor(config: OpenAIAdapterConfig = {}) {
    // Try to get API key from config or environment variable
    const apiKey = config.apiKey || process.env['OPENAI_API_KEY'];

    if (!apiKey) {
      throw new Error(
        'OpenAI API key is required. Provide it via config.apiKey or OPENAI_API_KEY environment variable.',
      );
    }

    this.config = {
      apiKey,
      model: config.model || 'gpt-5-mini-2025-08-07', // Default to GPT-5 Mini (uses new Responses API)
      temperature: config.temperature ?? 0.7,
      maxTokens: config.maxTokens ?? 4096,
      maxRetries: config.maxRetries ?? 3,
      timeout: config.timeout ?? 60000,
      organizationId: config.organizationId,
      baseURL: config.baseURL,
    };

    this.client = new OpenAI({
      apiKey: this.config.apiKey,
      organization: this.config.organizationId,
      baseURL: this.config.baseURL,
      maxRetries: this.config.maxRetries,
      timeout: this.config.timeout,
    });
  }

  /**
   * Call the LLM with a simple prompt (uses streaming internally)
   */
  async call(prompt: string, options?: LLMCallOptions): Promise<LLMCallResponse> {
    // Use streaming internally but don't expose the chunks
    return this.callWithStreaming(prompt, {
      ...(options || {}),
      streaming: {
        onChunk: () => {
          /* No-op */
        },
        onComplete: () => {
          /* No-op */
        },
        onError: () => {
          /* No-op */
        },
      },
    } as LLMCallOptions & { streaming: LLMStreamingOptions });
  }

  /**
   * Call the LLM with messages (chat format) - uses streaming internally
   */
  async callWithMessages(
    messages: LLMMessage[],
    options?: LLMCallOptions,
  ): Promise<LLMCallResponse> {
    // Convert messages to a prompt and use streaming
    const prompt = messages.map((m) => `${m.role}: ${m.content}`).join('\n\n');
    return this.call(prompt, options);
  }

  /**
   * Call the LLM with streaming (only uses Responses API)
   */
  async callWithStreaming(
    prompt: string,
    options: LLMCallOptions & { streaming: LLMStreamingOptions },
  ): Promise<LLMCallResponse> {
    const startTime = Date.now();
    const model = options?.model || this.config.model;
    const messages: LLMMessage[] = [{ role: 'user', content: prompt }];

    try {
      // All models use Responses API with streaming
      return await this.callWithResponsesAPIStreaming(messages, model, options, startTime);
    } catch (error) {
      if (options.streaming.onError) {
        options.streaming.onError(error as Error);
      }

      if (error instanceof OpenAI.APIError) {
        throw new Error(`OpenAI API error (${error.status}): ${error.message}`);
      }

      throw error;
    }
  }

  /**
   * Call GPT-5 using the Responses API with streaming
   */
  private async callWithResponsesAPIStreaming(
    messages: LLMMessage[],
    model: string,
    options: LLMCallOptions & { streaming: LLMStreamingOptions },
    startTime: number,
  ): Promise<LLMCallResponse> {
    // Validate that it's a GPT-5 model
    if (!model.startsWith('gpt-5')) {
      throw new Error(`This adapter only supports GPT-5 models. Received: ${model}`);
    }

    // Convert messages to a single input string for Responses API
    const input = messages.map((m) => `${m.role}: ${m.content}`).join('\n\n');

    // Responses API with streaming
    const stream = await (this.client as any).responses.create({
      model,
      input,
      stream: true,
    });

    let fullText = '';
    let inputTokens = 0;
    let outputTokens = 0;

    // Process stream events
    for await (const event of stream) {
      // Handle different event types for Responses API
      // The correct event types are:
      // - response.output_text.delta: Contains the text delta
      // - response.completed: Final event with usage info

      if (event.type === 'response.output_text.delta') {
        const delta = event.delta;

        if (delta) {
          fullText += delta;

          // Call the onChunk callback
          if (options.streaming.onChunk) {
            try {
              options.streaming.onChunk(delta);
            } catch (error) {
              console.error('Error in onChunk callback:', error);
            }
          }
        }
      } else if (event.type === 'response.completed' && event.response) {
        // Final event with usage info
        if (event.response.usage) {
          inputTokens = event.response.usage.input_tokens || 0;
          outputTokens = event.response.usage.output_tokens || 0;
        }
        if (event.response.output_text) {
          fullText = event.response.output_text;
        }
      }
    }

    const responseTimeMs = Date.now() - startTime;

    // Call the onComplete callback
    if (options.streaming.onComplete) {
      try {
        options.streaming.onComplete(fullText);
      } catch (error) {
        console.error('Error in onComplete callback:', error);
      }
    }

    return {
      text: fullText,
      tokensUsed: {
        prompt: inputTokens,
        completion: outputTokens,
        total: inputTokens + outputTokens,
      },
      model,
      responseTimeMs,
      finishReason: 'stop',
    };
  }

  /**
   * Count tokens in a text using tiktoken
   */
  countTokens(text: string): Promise<number> {
    try {
      // Map model names to tiktoken models
      const tiktokenModel = this.getTiktokenModel(this.config.model);
      const encoder = encoding_for_model(tiktokenModel);
      const tokens = encoder.encode(text);
      encoder.free();
      return Promise.resolve(tokens.length);
    } catch (error) {
      // Fallback: rough estimation (1 token ≈ 4 characters)
      console.warn('Token counting fallback, tiktoken error:', error);
      return Promise.resolve(Math.ceil(text.length / 4));
    }
  }

  /**
   * Get model capabilities
   */
  getCapabilities() {
    const capabilities = this.getModelCapabilities(this.config.model);
    return {
      maxTokens: capabilities.contextWindow,
      supportsStreaming: true,
      supportsFunctionCalling: capabilities.supportsFunctionCalling,
      supportsVision: capabilities.supportsVision,
    };
  }

  /**
   * Map OpenAI model to tiktoken model
   * GPT-5 models use gpt-4o tokenizer (tiktoken doesn't have GPT-5 yet)
   */
  private getTiktokenModel(_model: string): TiktokenModel {
    return 'gpt-4o';
  }

  /**
   * Get model-specific capabilities for GPT-5
   */
  private getModelCapabilities(_model: string) {
    // All GPT-5 models have similar capabilities
    return {
      contextWindow: 200000, // 200K context window for GPT-5
      supportsFunctionCalling: true,
      supportsVision: true,
    };
  }

  /**
   * Get the OpenAI client (for advanced usage)
   */
  getClient(): OpenAI {
    return this.client;
  }

  /**
   * Get the current configuration
   */
  getConfig() {
    return { ...this.config };
  }
}

/**
 * Create an OpenAI adapter instance for GPT-5 models
 *
 * @example
 * ```typescript
 * const adapter = createOpenAIAdapter({
 *   apiKey: process.env.OPENAI_API_KEY!,
 *   model: 'gpt-5-mini-2025-08-07' // Optional, defaults to 'gpt-5-mini-2025-08-07'
 * });
 *
 * const response = await adapter.call('Hello, world!');
 * console.log(response.text);
 * ```
 */
export function createOpenAIAdapter(config: OpenAIAdapterConfig): OpenAIAdapter {
  return new OpenAIAdapter(config);
}
