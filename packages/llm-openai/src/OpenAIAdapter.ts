/**
 * OpenAI LLM Adapter Implementation
 *
 * This adapter provides integration with OpenAI's API, supporting:
 * - Standard text completion
 * - Chat message format
 * - Streaming responses
 * - Token counting with tiktoken
 * - Automatic retries with exponential backoff
 * - Rate limit handling
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
  /** OpenAI API key */
  apiKey: string;

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

  constructor(config: OpenAIAdapterConfig) {
    if (!config.apiKey) {
      throw new Error('OpenAI API key is required');
    }

    this.config = {
      apiKey: config.apiKey,
      model: config.model || 'gpt-4o-mini',
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
   * Call the LLM with a simple prompt
   */
  call(prompt: string, options?: LLMCallOptions): Promise<LLMCallResponse> {
    const messages: LLMMessage[] = [{ role: 'user', content: prompt }];
    return this.callWithMessages(messages, options);
  }

  /**
   * Call the LLM with messages (chat format)
   */
  async callWithMessages(
    messages: LLMMessage[],
    options?: LLMCallOptions,
  ): Promise<LLMCallResponse> {
    const startTime = Date.now();
    const model = options?.model || this.config.model;

    try {
      const response = await this.client.chat.completions.create({
        model,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        temperature: options?.temperature ?? this.config.temperature,
        // biome-ignore lint/style/useNamingConvention: OpenAI API requires snake_case
        max_tokens: options?.maxTokens ?? this.config.maxTokens,
        // biome-ignore lint/style/useNamingConvention: OpenAI API requires snake_case
        top_p: options?.topP,
        // biome-ignore lint/style/useNamingConvention: OpenAI API requires snake_case
        frequency_penalty: options?.frequencyPenalty,
        // biome-ignore lint/style/useNamingConvention: OpenAI API requires snake_case
        presence_penalty: options?.presencePenalty,
        stop: options?.stop,
      });

      const responseTimeMs = Date.now() - startTime;
      const choice = response.choices[0];

      if (!choice?.message?.content) {
        throw new Error('No response content from OpenAI');
      }

      return {
        text: choice.message.content,
        tokensUsed: {
          prompt: response.usage?.prompt_tokens || 0,
          completion: response.usage?.completion_tokens || 0,
          total: response.usage?.total_tokens || 0,
        },
        model: response.model,
        responseTimeMs,
        finishReason: this.mapFinishReason(choice.finish_reason),
      };
    } catch (error) {
      if (error instanceof OpenAI.APIError) {
        throw new Error(`OpenAI API error (${error.status}): ${error.message}`);
      }

      throw error;
    }
  }

  /**
   * Call the LLM with streaming
   */
  async callWithStreaming(
    prompt: string,
    options: LLMCallOptions & { streaming: LLMStreamingOptions },
  ): Promise<LLMCallResponse> {
    const startTime = Date.now();
    const model = options?.model || this.config.model;
    const messages: LLMMessage[] = [{ role: 'user', content: prompt }];

    try {
      const stream = await this.client.chat.completions.create({
        model,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        temperature: options?.temperature ?? this.config.temperature,
        // biome-ignore lint/style/useNamingConvention: OpenAI API requires snake_case
        max_tokens: options?.maxTokens ?? this.config.maxTokens,
        // biome-ignore lint/style/useNamingConvention: OpenAI API requires snake_case
        top_p: options?.topP,
        // biome-ignore lint/style/useNamingConvention: OpenAI API requires snake_case
        frequency_penalty: options?.frequencyPenalty,
        // biome-ignore lint/style/useNamingConvention: OpenAI API requires snake_case
        presence_penalty: options?.presencePenalty,
        stop: options?.stop,
        stream: true,
      });

      let fullText = '';
      let finishReason: 'stop' | 'length' | 'error' = 'stop';

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;

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

        if (chunk.choices[0]?.finish_reason) {
          finishReason = this.mapFinishReason(chunk.choices[0].finish_reason);
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

      // Count tokens since streaming doesn't provide usage
      const promptTokens = await this.countTokens(prompt);
      const completionTokens = await this.countTokens(fullText);

      return {
        text: fullText,
        tokensUsed: {
          prompt: promptTokens,
          completion: completionTokens,
          total: promptTokens + completionTokens,
        },
        model,
        responseTimeMs,
        finishReason,
      };
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
   */
  private getTiktokenModel(model: string): TiktokenModel {
    // Map common OpenAI models to tiktoken models
    if (model.startsWith('gpt-4o')) {
      return 'gpt-4o';
    }
    if (model.startsWith('gpt-4')) {
      return 'gpt-4';
    }
    if (model.startsWith('gpt-3.5')) {
      return 'gpt-3.5-turbo';
    }

    // Default to gpt-4o for newer models
    return 'gpt-4o';
  }

  /**
   * Get model-specific capabilities
   */
  private getModelCapabilities(model: string) {
    // GPT-4o models
    if (model.includes('gpt-4o')) {
      return {
        contextWindow: 128000,
        supportsFunctionCalling: true,
        supportsVision: true,
      };
    }

    // GPT-4 models
    if (model.includes('gpt-4')) {
      return {
        contextWindow: model.includes('turbo') ? 128000 : 8192,
        supportsFunctionCalling: true,
        supportsVision: model.includes('vision'),
      };
    }

    // GPT-3.5 models
    if (model.includes('gpt-3.5')) {
      return {
        contextWindow: 16385,
        supportsFunctionCalling: true,
        supportsVision: false,
      };
    }

    // Default
    return {
      contextWindow: 8192,
      supportsFunctionCalling: false,
      supportsVision: false,
    };
  }

  /**
   * Map OpenAI finish reason to our type
   */
  private mapFinishReason(reason: string | null): 'stop' | 'length' | 'error' {
    switch (reason) {
      case 'stop':
        return 'stop';
      case 'length':
      case 'max_tokens':
        return 'length';
      default:
        return 'error';
    }
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
 * Create an OpenAI adapter instance
 *
 * @example
 * ```typescript
 * const adapter = createOpenAIAdapter({
 *   apiKey: process.env.OPENAI_API_KEY!,
 *   model: 'gpt-4o-mini'
 * });
 *
 * const response = await adapter.call('Hello, world!');
 * console.log(response.text);
 * ```
 */
export function createOpenAIAdapter(config: OpenAIAdapterConfig): OpenAIAdapter {
  return new OpenAIAdapter(config);
}
