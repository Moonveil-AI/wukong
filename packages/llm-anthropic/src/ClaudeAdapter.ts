/**
 * Anthropic Claude LLM Adapter Implementation
 *
 * This adapter provides integration with Anthropic's Claude API, supporting:
 * - Standard text completion with messages API
 * - Chat message format
 * - Streaming responses
 * - Token counting
 * - Automatic retries with exponential backoff
 * - Rate limit handling
 * - Support for Claude Sonnet 4.5 and Haiku 4.5
 */

import Anthropic from '@anthropic-ai/sdk';
import type {
  LLMAdapter,
  LLMCallOptions,
  LLMCallResponse,
  LLMMessage,
  LLMStreamingOptions,
} from '@wukong/agent';

/**
 * Claude adapter configuration
 */
export interface ClaudeAdapterConfig {
  /** 
   * Anthropic API key 
   * If not provided, will read from ANTHROPIC_API_KEY environment variable
   */
  apiKey?: string;

  /** Default model to use */
  model?: string;

  /** Default temperature */
  temperature?: number;

  /** Default max tokens */
  maxTokens?: number;

  /** Maximum retry attempts */
  maxRetries?: number;

  /** Timeout in milliseconds */
  timeout?: number;

  /** Base URL (for custom endpoints) */
  baseURL?: string;
}

/**
 * Claude LLM Adapter
 *
 * Implements the LLMAdapter interface for Anthropic Claude models
 */
export class ClaudeAdapter implements LLMAdapter {
  private client: Anthropic;
  private config: Required<Omit<ClaudeAdapterConfig, 'baseURL'>> & {
    baseURL?: string;
  };

  constructor(config: ClaudeAdapterConfig = {}) {
    // Try to get API key from config or environment variable
    const apiKey = config.apiKey || process.env['ANTHROPIC_API_KEY'];
    
    if (!apiKey) {
      throw new Error(
        'Anthropic API key is required. Provide it via config.apiKey or ANTHROPIC_API_KEY environment variable.'
      );
    }

    this.config = {
      apiKey,
      model: config.model || 'claude-sonnet-4.5-20241022',
      temperature: config.temperature ?? 0.7,
      maxTokens: config.maxTokens ?? 8192,
      maxRetries: config.maxRetries ?? 3,
      timeout: config.timeout ?? 60000,
      baseURL: config.baseURL,
    };

    this.client = new Anthropic({
      apiKey: this.config.apiKey,
      maxRetries: this.config.maxRetries,
      timeout: this.config.timeout,
      baseURL: this.config.baseURL,
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
      // Anthropic's API requires system messages to be passed separately
      const systemMessages = messages.filter((m) => m.role === 'system');
      const nonSystemMessages = messages.filter((m) => m.role !== 'system');

      // Combine multiple system messages into one
      const systemPrompt =
        systemMessages.length > 0 ? systemMessages.map((m) => m.content).join('\n\n') : undefined;

      const response = await this.client.messages.create({
        model,
        messages: nonSystemMessages.map((m) => ({
          role: m.role === 'user' ? ('user' as const) : ('assistant' as const),
          content: m.content,
        })),
        system: systemPrompt,
        temperature: options?.temperature ?? this.config.temperature,
        // biome-ignore lint/style/useNamingConvention: Anthropic API requires snake_case
        max_tokens: options?.maxTokens ?? this.config.maxTokens,
        // biome-ignore lint/style/useNamingConvention: Anthropic API requires snake_case
        top_p: options?.topP,
        // biome-ignore lint/style/useNamingConvention: Anthropic API requires snake_case
        stop_sequences: options?.stop,
      });

      const responseTimeMs = Date.now() - startTime;

      // Extract text from response content
      const textContent = response.content
        .filter((block) => block.type === 'text')
        .map((block) => (block.type === 'text' ? block.text : ''))
        .join('');

      if (!textContent) {
        throw new Error('No response content from Claude');
      }

      return {
        text: textContent,
        tokensUsed: {
          prompt: response.usage.input_tokens,
          completion: response.usage.output_tokens,
          total: response.usage.input_tokens + response.usage.output_tokens,
        },
        model: response.model,
        responseTimeMs,
        finishReason: this.mapStopReason(response.stop_reason),
      };
    } catch (error) {
      if (error instanceof Anthropic.APIError) {
        throw new Error(`Claude API error (${error.status}): ${error.message}`);
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
      // Anthropic's API requires system messages to be passed separately
      const systemMessages = messages.filter((m) => m.role === 'system');
      const nonSystemMessages = messages.filter((m) => m.role !== 'system');

      // Combine multiple system messages into one
      const systemPrompt =
        systemMessages.length > 0 ? systemMessages.map((m) => m.content).join('\n\n') : undefined;

      const stream = await this.client.messages.stream({
        model,
        messages: nonSystemMessages.map((m) => ({
          role: m.role === 'user' ? ('user' as const) : ('assistant' as const),
          content: m.content,
        })),
        system: systemPrompt,
        temperature: options?.temperature ?? this.config.temperature,
        // biome-ignore lint/style/useNamingConvention: Anthropic API requires snake_case
        max_tokens: options?.maxTokens ?? this.config.maxTokens,
        // biome-ignore lint/style/useNamingConvention: Anthropic API requires snake_case
        top_p: options?.topP,
        // biome-ignore lint/style/useNamingConvention: Anthropic API requires snake_case
        stop_sequences: options?.stop,
      });

      let fullText = '';
      let stopReason: string | null = null;
      let inputTokens = 0;
      let outputTokens = 0;

      // Listen to stream events
      stream.on('text', (text) => {
        fullText += text;

        // Call the onChunk callback
        if (options.streaming.onChunk) {
          try {
            options.streaming.onChunk(text);
          } catch (error) {
            console.error('Error in onChunk callback:', error);
          }
        }
      });

      // Wait for the stream to complete
      const finalMessage = await stream.finalMessage();

      stopReason = finalMessage.stop_reason;
      inputTokens = finalMessage.usage.input_tokens;
      outputTokens = finalMessage.usage.output_tokens;

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
        finishReason: this.mapStopReason(stopReason),
      };
    } catch (error) {
      if (options.streaming.onError) {
        options.streaming.onError(error as Error);
      }

      if (error instanceof Anthropic.APIError) {
        throw new Error(`Claude API error (${error.status}): ${error.message}`);
      }

      throw error;
    }
  }

  /**
   * Count tokens in a text
   * Claude uses approximately 1 token per 4 characters (rough estimation)
   * For more accurate counting, use Anthropic's token counting API
   */
  countTokens(text: string): Promise<number> {
    // Anthropic provides a token counting API, but for now we'll use estimation
    // 1 token ≈ 3.5 characters for Claude (slightly better than GPT)
    const estimatedTokens = Math.ceil(text.length / 3.5);
    return Promise.resolve(estimatedTokens);
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
   * Get model-specific capabilities
   */
  private getModelCapabilities(model: string) {
    // Claude Sonnet 4.5 (latest flagship model)
    if (model.includes('claude-sonnet-4')) {
      return {
        contextWindow: 200000, // 200K context window
        supportsFunctionCalling: true,
        supportsVision: true,
      };
    }

    // Claude Haiku 4.5 (faster, cheaper)
    if (model.includes('claude-haiku-4')) {
      return {
        contextWindow: 200000, // 200K context window
        supportsFunctionCalling: true,
        supportsVision: false,
      };
    }

    // Claude 3.5 Sonnet (previous generation)
    if (model.includes('claude-3-5-sonnet')) {
      return {
        contextWindow: 200000,
        supportsFunctionCalling: true,
        supportsVision: true,
      };
    }

    // Claude 3 Opus (previous generation, most capable)
    if (model.includes('claude-3-opus')) {
      return {
        contextWindow: 200000,
        supportsFunctionCalling: true,
        supportsVision: true,
      };
    }

    // Claude 3 Sonnet (previous generation)
    if (model.includes('claude-3-sonnet')) {
      return {
        contextWindow: 200000,
        supportsFunctionCalling: true,
        supportsVision: true,
      };
    }

    // Claude 3 Haiku (previous generation)
    if (model.includes('claude-3-haiku')) {
      return {
        contextWindow: 200000,
        supportsFunctionCalling: true,
        supportsVision: false,
      };
    }

    // Default (conservative estimates)
    return {
      contextWindow: 200000,
      supportsFunctionCalling: false,
      supportsVision: false,
    };
  }

  /**
   * Map Claude stop reason to our type
   */
  private mapStopReason(reason: string | null): 'stop' | 'length' | 'error' {
    switch (reason) {
      case 'end_turn':
      case 'stop_sequence':
        return 'stop';
      case 'max_tokens':
        return 'length';
      default:
        return 'error';
    }
  }

  /**
   * Get the Anthropic client (for advanced usage)
   */
  getClient(): Anthropic {
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
 * Create a Claude adapter instance
 *
 * @example
 * ```typescript
 * const adapter = createClaudeAdapter({
 *   apiKey: process.env.ANTHROPIC_API_KEY!,
 *   model: 'claude-sonnet-4.5-20241022'
 * });
 *
 * const response = await adapter.call('Hello, world!');
 * console.log(response.text);
 * ```
 */
export function createClaudeAdapter(config: ClaudeAdapterConfig): ClaudeAdapter {
  return new ClaudeAdapter(config);
}
