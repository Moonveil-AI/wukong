/**
 * Tests for Google Gemini LLM Adapter
 *
 * Note: These tests require a valid GOOGLE_AI_API_KEY environment variable.
 * Some tests are skipped by default to avoid API costs during regular test runs.
 */

import { describe, expect, it } from 'vitest';
import { GeminiAdapter, createGeminiAdapter } from '../GeminiAdapter';

describe('GeminiAdapter', () => {
  describe('Constructor', () => {
    it('should create an adapter with API key', () => {
      const adapter = new GeminiAdapter({
        apiKey: 'test-api-key',
      });

      expect(adapter).toBeDefined();
      expect(adapter.getConfig().apiKey).toBe('test-api-key');
    });

    it('should throw error without API key', () => {
      expect(() => {
        new GeminiAdapter({
          apiKey: '',
        });
      }).toThrow('Google AI API key is required');
    });

    it('should use default model if not specified', () => {
      const adapter = new GeminiAdapter({
        apiKey: 'test-api-key',
      });

      expect(adapter.getConfig().model).toBe('gemini-2.5-pro');
    });

    it('should use custom model if specified', () => {
      const adapter = new GeminiAdapter({
        apiKey: 'test-api-key',
        model: 'gemini-2.0-pro-exp',
      });

      expect(adapter.getConfig().model).toBe('gemini-2.0-pro-exp');
    });
  });

  describe('createGeminiAdapter', () => {
    it('should create an adapter using factory function', () => {
      const adapter = createGeminiAdapter({
        apiKey: 'test-api-key',
      });

      expect(adapter).toBeInstanceOf(GeminiAdapter);
    });
  });

  describe('getCapabilities', () => {
    it('should return capabilities for Gemini 2.5 Pro', () => {
      const adapter = new GeminiAdapter({
        apiKey: 'test-api-key',
        model: 'gemini-2.5-pro',
      });

      const capabilities = adapter.getCapabilities();

      expect(capabilities).toEqual({
        maxTokens: 2000000,
        supportsStreaming: true,
        supportsFunctionCalling: true,
        supportsVision: true,
      });
    });

    it('should return capabilities for Gemini 2.0 Flash', () => {
      const adapter = new GeminiAdapter({
        apiKey: 'test-api-key',
        model: 'gemini-2.0-flash-exp',
      });

      const capabilities = adapter.getCapabilities();

      expect(capabilities).toEqual({
        maxTokens: 1000000,
        supportsStreaming: true,
        supportsFunctionCalling: true,
        supportsVision: true,
      });
    });

    it('should return capabilities for Gemini 2.0 Pro', () => {
      const adapter = new GeminiAdapter({
        apiKey: 'test-api-key',
        model: 'gemini-2.0-pro-exp',
      });

      const capabilities = adapter.getCapabilities();

      expect(capabilities).toEqual({
        maxTokens: 2000000,
        supportsStreaming: true,
        supportsFunctionCalling: true,
        supportsVision: true,
      });
    });
  });

  // Skip API tests by default to avoid costs
  describe.skip('API Integration Tests', () => {
    const apiKey = process.env.GOOGLE_AI_API_KEY;

    it('should call Gemini API successfully', async () => {
      if (!apiKey) {
        throw new Error('GOOGLE_AI_API_KEY environment variable is required');
      }

      const adapter = new GeminiAdapter({
        apiKey,
        model: 'gemini-2.5-pro',
      });

      const response = await adapter.call('Say "Hello" in one word');

      expect(response).toBeDefined();
      expect(response.text).toBeDefined();
      expect(response.text.length).toBeGreaterThan(0);
      expect(response.tokensUsed).toBeDefined();
      expect(response.tokensUsed.total).toBeGreaterThan(0);
      expect(response.finishReason).toBe('stop');
    });

    it('should call with messages', async () => {
      if (!apiKey) {
        throw new Error('GOOGLE_AI_API_KEY environment variable is required');
      }

      const adapter = new GeminiAdapter({
        apiKey,
        model: 'gemini-2.5-pro',
      });

      const response = await adapter.callWithMessages([{ role: 'user', content: 'What is 2+2?' }]);

      expect(response).toBeDefined();
      expect(response.text).toBeDefined();
      expect(response.text.toLowerCase()).toContain('4');
    });

    it('should stream responses', async () => {
      if (!apiKey) {
        throw new Error('GOOGLE_AI_API_KEY environment variable is required');
      }

      const adapter = new GeminiAdapter({
        apiKey,
        model: 'gemini-2.5-pro',
      });

      const chunks: string[] = [];
      let fullText = '';

      const response = await adapter.callWithStreaming('Count from 1 to 5', {
        streaming: {
          onChunk: (chunk) => {
            chunks.push(chunk);
          },
          onComplete: (text) => {
            fullText = text;
          },
        },
      });

      expect(response).toBeDefined();
      expect(chunks.length).toBeGreaterThan(0);
      expect(fullText).toBe(response.text);
      expect(response.tokensUsed.total).toBeGreaterThan(0);
    });

    it('should count tokens', async () => {
      if (!apiKey) {
        throw new Error('GOOGLE_AI_API_KEY environment variable is required');
      }

      const adapter = new GeminiAdapter({
        apiKey,
        model: 'gemini-2.5-pro',
      });

      const text = 'This is a test message for token counting.';
      const tokenCount = await adapter.countTokens(text);

      expect(tokenCount).toBeGreaterThan(0);
      expect(tokenCount).toBeLessThan(50); // Should be reasonable for short text
    });
  });
});
