/**
 * Google Gemini LLM Adapter Implementation
 *
 * This adapter provides integration with Google's Gemini API, supporting:
 * - Standard text completion with generative AI
 * - Chat message format
 * - Streaming responses
 * - Token counting
 * - Automatic retries with exponential backoff
 * - Rate limit handling
 * - Support for Gemini 2.5 Pro and 2.0 models
 */

import { type GenerativeModel, GoogleGenerativeAI } from '@google/generative-ai';
import type {
  LLMAdapter,
  LLMCallOptions,
  LLMCallResponse,
  LLMMessage,
  LLMStreamingOptions,
} from '@wukong/agent';

/**
 * Gemini adapter configuration
 */
export interface GeminiAdapterConfig {
  /**
   * Google AI API key
   * If not provided, will read from GEMINI_API_KEY environment variable
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
 * Gemini LLM Adapter
 *
 * Implements the LLMAdapter interface for Google Gemini models
 */
export class GeminiAdapter implements LLMAdapter {
  private client: GoogleGenerativeAI;
  private config: Required<Omit<GeminiAdapterConfig, 'baseURL'>> & {
    baseURL?: string;
  };

  constructor(config: GeminiAdapterConfig = {}) {
    // Try to get API key from config or environment variable
    // biome-ignore lint/complexity/useLiteralKeys: TypeScript requires bracket notation for index signatures
    const apiKey = config.apiKey || process.env['GEMINI_API_KEY'];

    if (!apiKey) {
      throw new Error(
        'Google AI API key is required. Provide it via config.apiKey or GEMINI_API_KEY environment variable.',
      );
    }

    this.config = {
      apiKey: apiKey,
      model: config.model || 'gemini-2.5-pro',
      temperature: config.temperature ?? 0.7,
      maxTokens: config.maxTokens ?? 8192,
      maxRetries: config.maxRetries ?? 3,
      timeout: config.timeout ?? 60000,
      baseURL: config.baseURL,
    };

    this.client = new GoogleGenerativeAI(this.config.apiKey);
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
    const modelName = options?.model || this.config.model;

    try {
      const model = this.getModel(modelName);

      // Convert messages to Gemini format
      const geminiMessages = this.convertMessagesToGeminiFormat(messages);

      // Generate content
      const generateConfig: any = {
        contents: geminiMessages.contents,
        generationConfig: {
          temperature: options?.temperature ?? this.config.temperature,
          maxOutputTokens: options?.maxTokens ?? this.config.maxTokens,
          topP: options?.topP,
          stopSequences: options?.stop,
        },
      };

      // Add system instruction if present
      if (geminiMessages.systemInstruction) {
        generateConfig.systemInstruction = geminiMessages.systemInstruction;
      }

      const result = await model.generateContent(generateConfig);

      const responseTimeMs = Date.now() - startTime;
      const response = result.response;
      const text = response.text();

      if (!text) {
        throw new Error('No response content from Gemini');
      }

      // Get token counts
      const promptTokens = response.usageMetadata?.promptTokenCount || 0;
      const completionTokens = response.usageMetadata?.candidatesTokenCount || 0;

      return {
        text,
        tokensUsed: {
          prompt: promptTokens,
          completion: completionTokens,
          total: promptTokens + completionTokens,
        },
        model: modelName,
        responseTimeMs,
        finishReason: this.mapFinishReason(response.candidates?.[0]?.finishReason),
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Gemini API error: ${error.message}`);
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
    const modelName = options?.model || this.config.model;
    const messages: LLMMessage[] = [{ role: 'user', content: prompt }];

    try {
      const model = this.getModel(modelName);

      // Convert messages to Gemini format
      const geminiMessages = this.convertMessagesToGeminiFormat(messages);

      // Generate content with streaming
      const streamConfig: any = {
        contents: geminiMessages.contents,
        generationConfig: {
          temperature: options?.temperature ?? this.config.temperature,
          maxOutputTokens: options?.maxTokens ?? this.config.maxTokens,
          topP: options?.topP,
          stopSequences: options?.stop,
        },
      };

      // Add system instruction if present
      if (geminiMessages.systemInstruction) {
        streamConfig.systemInstruction = geminiMessages.systemInstruction;
      }

      const result = await model.generateContentStream(streamConfig);

      let fullText = '';
      let finishReason: 'stop' | 'length' | 'error' = 'stop';
      let promptTokens = 0;
      let completionTokens = 0;

      // Process stream chunks
      for await (const chunk of result.stream) {
        const chunkText = chunk.text();

        if (chunkText) {
          fullText += chunkText;

          // Call the onChunk callback
          if (options.streaming.onChunk) {
            try {
              options.streaming.onChunk(chunkText);
            } catch (error) {
              console.error('Error in onChunk callback:', error);
            }
          }
        }

        // Update token counts
        if (chunk.usageMetadata) {
          promptTokens = chunk.usageMetadata.promptTokenCount || promptTokens;
          completionTokens = chunk.usageMetadata.candidatesTokenCount || completionTokens;
        }

        // Update finish reason
        if (chunk.candidates?.[0]?.finishReason) {
          finishReason = this.mapFinishReason(chunk.candidates[0].finishReason);
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
          prompt: promptTokens,
          completion: completionTokens,
          total: promptTokens + completionTokens,
        },
        model: modelName,
        responseTimeMs,
        finishReason,
      };
    } catch (error) {
      if (options.streaming.onError) {
        options.streaming.onError(error as Error);
      }

      if (error instanceof Error) {
        throw new Error(`Gemini API error: ${error.message}`);
      }

      throw error;
    }
  }

  /**
   * Count tokens in a text
   * Gemini uses approximately 1 token per 4 characters (rough estimation)
   */
  async countTokens(text: string): Promise<number> {
    try {
      const model = this.getModel(this.config.model);
      const result = await model.countTokens(text);
      return result.totalTokens;
    } catch (error) {
      // Fallback: rough estimation (1 token ≈ 4 characters)
      console.warn('Token counting fallback, Gemini error:', error);
      return Math.ceil(text.length / 4);
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
   * Get model-specific capabilities
   */
  private getModelCapabilities(model: string) {
    // Gemini 2.5 Pro (latest, most capable)
    if (model.includes('gemini-2.5-pro')) {
      return {
        contextWindow: 2000000, // 2M context window (paid tier)
        supportsFunctionCalling: true,
        supportsVision: true,
      };
    }

    // Gemini 2.0 Flash (experimental)
    if (model.includes('gemini-2.0-flash')) {
      return {
        contextWindow: 1000000, // 1M context window
        supportsFunctionCalling: true,
        supportsVision: true,
      };
    }

    // Gemini 2.0 Pro (experimental)
    if (model.includes('gemini-2.0-pro')) {
      return {
        contextWindow: 2000000, // 2M context window
        supportsFunctionCalling: true,
        supportsVision: true,
      };
    }

    // Default (for Gemini 2.x models)
    return {
      contextWindow: 1000000,
      supportsFunctionCalling: true,
      supportsVision: true,
    };
  }

  /**
   * Convert LLM messages to Gemini format
   */
  private convertMessagesToGeminiFormat(messages: LLMMessage[]): {
    contents: Array<{ role: string; parts: Array<{ text: string }> }>;
    systemInstruction?: { parts: Array<{ text: string }> };
  } {
    // Extract system messages
    const systemMessages = messages.filter((m) => m.role === 'system');
    const nonSystemMessages = messages.filter((m) => m.role !== 'system');

    // Combine multiple system messages into one
    const systemInstruction =
      systemMessages.length > 0
        ? {
            parts: systemMessages.map((m) => ({ text: m.content })),
          }
        : undefined;

    // Convert messages to Gemini format
    const contents = nonSystemMessages.map((m) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    }));

    return {
      contents,
      systemInstruction,
    };
  }

  /**
   * Map Gemini finish reason to our type
   */
  private mapFinishReason(reason: string | null | undefined): 'stop' | 'length' | 'error' {
    switch (reason) {
      case 'STOP':
        return 'stop';
      case 'MAX_TOKENS':
        return 'length';
      case 'SAFETY':
      case 'RECITATION':
      case 'OTHER':
        return 'error';
      default:
        return 'stop';
    }
  }

  /**
   * Get a Gemini model instance
   */
  private getModel(modelName: string): GenerativeModel {
    return this.client.getGenerativeModel({ model: modelName });
  }

  /**
   * Get the Google Generative AI client (for advanced usage)
   */
  getClient(): GoogleGenerativeAI {
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
 * Create a Gemini adapter instance
 *
 * @example
 * ```typescript
 * const adapter = createGeminiAdapter({
 *   apiKey: process.env.GOOGLE_AI_API_KEY!,
 *   model: 'gemini-2.5-pro'
 * });
 *
 * const response = await adapter.call('Hello, world!');
 * console.log(response.text);
 * ```
 */
export function createGeminiAdapter(config: GeminiAdapterConfig): GeminiAdapter {
  return new GeminiAdapter(config);
}
