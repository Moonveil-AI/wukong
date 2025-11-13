/**
 * OpenAI Adapter Tests
 */

import type { LLMMessage } from '@wukong/agent';
import { describe, expect, it } from 'vitest';
import { OpenAIAdapter } from '../OpenAIAdapter';

describe('OpenAIAdapter', () => {
  describe('constructor', () => {
    it('should throw error if API key is missing', () => {
      expect(() => {
        new OpenAIAdapter({ apiKey: '' });
      }).toThrow('OpenAI API key is required');
    });

    it('should initialize with default values', () => {
      const adapter = new OpenAIAdapter({
        apiKey: 'test-key',
      });

      const config = adapter.getConfig();
      expect(config.model).toBe('gpt-5.1-instant');
      expect(config.temperature).toBe(0.7);
      expect(config.maxTokens).toBe(4096);
      expect(config.maxRetries).toBe(3);
    });

    it('should initialize with custom values', () => {
      const adapter = new OpenAIAdapter({
        apiKey: 'test-key',
        model: 'gpt-4',
        temperature: 0.5,
        maxTokens: 2000,
      });

      const config = adapter.getConfig();
      expect(config.model).toBe('gpt-4');
      expect(config.temperature).toBe(0.5);
      expect(config.maxTokens).toBe(2000);
    });
  });

  describe('getCapabilities', () => {
    it('should return correct capabilities for gpt-5.1', () => {
      const adapter = new OpenAIAdapter({
        apiKey: 'test-key',
        model: 'gpt-5.1-instant',
      });

      const capabilities = adapter.getCapabilities();
      expect(capabilities.maxTokens).toBe(200000);
      expect(capabilities.supportsStreaming).toBe(true);
      expect(capabilities.supportsFunctionCalling).toBe(true);
      expect(capabilities.supportsVision).toBe(true);
    });

    it('should return correct capabilities for gpt-4o', () => {
      const adapter = new OpenAIAdapter({
        apiKey: 'test-key',
        model: 'gpt-4o',
      });

      const capabilities = adapter.getCapabilities();
      expect(capabilities.maxTokens).toBe(128000);
      expect(capabilities.supportsStreaming).toBe(true);
      expect(capabilities.supportsFunctionCalling).toBe(true);
      expect(capabilities.supportsVision).toBe(true);
    });

    it('should return correct capabilities for gpt-4', () => {
      const adapter = new OpenAIAdapter({
        apiKey: 'test-key',
        model: 'gpt-4-turbo',
      });

      const capabilities = adapter.getCapabilities();
      expect(capabilities.maxTokens).toBe(128000);
      expect(capabilities.supportsStreaming).toBe(true);
      expect(capabilities.supportsFunctionCalling).toBe(true);
    });

    it('should return correct capabilities for gpt-3.5-turbo', () => {
      const adapter = new OpenAIAdapter({
        apiKey: 'test-key',
        model: 'gpt-3.5-turbo',
      });

      const capabilities = adapter.getCapabilities();
      expect(capabilities.maxTokens).toBe(16385);
      expect(capabilities.supportsStreaming).toBe(true);
      expect(capabilities.supportsFunctionCalling).toBe(true);
      expect(capabilities.supportsVision).toBe(false);
    });
  });

  describe('countTokens', () => {
    it('should count tokens approximately', async () => {
      const adapter = new OpenAIAdapter({
        apiKey: 'test-key',
      });

      const text = 'Hello, world! This is a test.';
      const count = await adapter.countTokens(text);

      // Should return a positive number
      expect(count).toBeGreaterThan(0);
      // Rough check: should be reasonable
      expect(count).toBeLessThan(100);
    });

    it('should handle empty string', async () => {
      const adapter = new OpenAIAdapter({
        apiKey: 'test-key',
      });

      const count = await adapter.countTokens('');
      expect(count).toBe(0);
    });

    it('should handle long text', async () => {
      const adapter = new OpenAIAdapter({
        apiKey: 'test-key',
      });

      const longText = 'word '.repeat(1000);
      const count = await adapter.countTokens(longText);

      // Should be significantly more tokens
      expect(count).toBeGreaterThan(500);
    });
  });

  describe('call (integration test - requires API key)', () => {
    // Skip these tests in CI unless API key is provided
    const apiKey = process.env.OPENAI_API_KEY;
    const testCondition = apiKey ? it : it.skip;

    testCondition(
      'should make a simple call',
      async () => {
        if (!apiKey) throw new Error('API key required');
        const adapter = new OpenAIAdapter({
          apiKey: apiKey,
          model: 'gpt-5.1-instant',
        });

        const response = await adapter.call('Say "Hello, test!"', {
          maxTokens: 50,
          temperature: 0,
        });

        expect(response.text).toBeDefined();
        expect(response.text.length).toBeGreaterThan(0);
        expect(response.tokensUsed.total).toBeGreaterThan(0);
        expect(response.model).toContain('gpt');
        expect(response.finishReason).toBe('stop');
      },
      30000,
    );

    testCondition(
      'should handle messages format',
      async () => {
        if (!apiKey) throw new Error('API key required');
        const adapter = new OpenAIAdapter({
          apiKey: apiKey,
          model: 'gpt-5.1-instant',
        });

        const messages: LLMMessage[] = [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'What is 2+2?' },
        ];

        const response = await adapter.callWithMessages(messages, {
          maxTokens: 50,
          temperature: 0,
        });

        expect(response.text).toBeDefined();
        expect(response.text).toContain('4');
        expect(response.tokensUsed.total).toBeGreaterThan(0);
      },
      30000,
    );
  });

  describe('callWithStreaming (integration test - requires API key)', () => {
    const apiKey = process.env.OPENAI_API_KEY;
    const testCondition = apiKey ? it : it.skip;

    testCondition(
      'should stream response',
      async () => {
        if (!apiKey) throw new Error('API key required');
        const adapter = new OpenAIAdapter({
          apiKey: apiKey,
          model: 'gpt-5.1-instant',
        });

        const chunks: string[] = [];
        let completed = false;

        const response = await adapter.callWithStreaming('Count from 1 to 5 slowly', {
          maxTokens: 50,
          temperature: 0,
          streaming: {
            onChunk: (chunk) => {
              chunks.push(chunk);
            },
            onComplete: (fullText) => {
              completed = true;
              expect(fullText).toBeDefined();
            },
          },
        });

        expect(chunks.length).toBeGreaterThan(0);
        expect(completed).toBe(true);
        expect(response.text).toBeDefined();
        expect(response.tokensUsed.total).toBeGreaterThan(0);
      },
      30000,
    );
  });

  describe('error handling', () => {
    it('should handle invalid API key gracefully', async () => {
      const adapter = new OpenAIAdapter({
        apiKey: 'invalid-key',
        model: 'gpt-5.1-instant',
      });

      await expect(adapter.call('Test prompt')).rejects.toThrow();
    }, 30000);
  });
});
