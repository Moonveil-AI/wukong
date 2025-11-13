/**
 * Tests for MultiModelCaller
 */

import { describe, expect, it } from 'vitest';
import type { LLMAdapter, LLMCallResponse } from '../../types/adapters';
import { MultiModelCaller } from '../MultiModelCaller';

// Create mock LLM adapters
function createMockAdapter(
  name: string,
  shouldFail = false,
  failureType: 'rate_limit' | 'auth' | 'success' = 'success',
): LLMAdapter {
  return {
    call(_prompt: string): Promise<LLMCallResponse> {
      if (shouldFail) {
        if (failureType === 'rate_limit') {
          return Promise.reject(new Error('Rate limit exceeded (429)'));
        }
        if (failureType === 'auth') {
          return Promise.reject(new Error('Unauthorized: Invalid API key (401)'));
        }
        return Promise.reject(new Error(`${name} failed`));
      }

      return Promise.resolve({
        text: JSON.stringify({ success: true, model: name }),
        tokensUsed: {
          prompt: 10,
          completion: 20,
          total: 30,
        },
        model: name,
        responseTimeMs: 100,
        finishReason: 'stop',
      });
    },

    callWithMessages(messages): Promise<LLMCallResponse> {
      if (shouldFail) {
        if (failureType === 'rate_limit') {
          return Promise.reject(new Error('Rate limit exceeded (429)'));
        }
        if (failureType === 'auth') {
          return Promise.reject(new Error('Unauthorized: Invalid API key (401)'));
        }
        return Promise.reject(new Error(`${name} failed`));
      }

      return Promise.resolve({
        text: JSON.stringify({ success: true, model: name, messages: messages.length }),
        tokensUsed: {
          prompt: 10,
          completion: 20,
          total: 30,
        },
        model: name,
        responseTimeMs: 100,
        finishReason: 'stop',
      });
    },

    callWithStreaming(): Promise<LLMCallResponse> {
      return Promise.reject(new Error('Not implemented'));
    },

    countTokens(text: string): Promise<number> {
      return Promise.resolve(text.length / 4);
    },

    getCapabilities() {
      return {
        maxTokens: 128000,
        supportsStreaming: true,
        supportsFunctionCalling: true,
        supportsVision: false,
      };
    },
  };
}

describe('MultiModelCaller', () => {
  describe('constructor', () => {
    it('should throw error if no models provided', () => {
      expect(() => new MultiModelCaller({ models: [] })).toThrow(
        'MultiModelCaller requires at least one LLM adapter',
      );
    });

    it('should accept array of models', () => {
      const model1 = createMockAdapter('model1');
      const caller = new MultiModelCaller({ models: [model1] });

      expect(caller.getModelCount()).toBe(1);
    });
  });

  describe('call', () => {
    it('should call first model successfully', async () => {
      const model1 = createMockAdapter('model1');
      const caller = new MultiModelCaller({ models: [model1] });

      const response = await caller.call('Test prompt');

      expect(response).toBeDefined();
      expect(response.text).toContain('model1');
      expect(response.finishReason).toBe('stop');
    });

    it('should fallback to second model if first fails', async () => {
      const model1 = createMockAdapter('model1', true);
      const model2 = createMockAdapter('model2');
      const caller = new MultiModelCaller({
        models: [model1, model2],
        maxRetriesPerModel: 1,
      });

      const response = await caller.call('Test prompt');

      expect(response).toBeDefined();
      expect(response.text).toContain('model2');
    });

    it('should fallback through multiple models', async () => {
      const model1 = createMockAdapter('model1', true);
      const model2 = createMockAdapter('model2', true);
      const model3 = createMockAdapter('model3');
      const caller = new MultiModelCaller({
        models: [model1, model2, model3],
        maxRetriesPerModel: 1,
      });

      const response = await caller.call('Test prompt');

      expect(response).toBeDefined();
      expect(response.text).toContain('model3');
    });

    it('should throw error if all models fail', async () => {
      const model1 = createMockAdapter('model1', true);
      const model2 = createMockAdapter('model2', true);
      const caller = new MultiModelCaller({
        models: [model1, model2],
        maxRetriesPerModel: 1,
      });

      await expect(caller.call('Test prompt')).rejects.toThrow('All LLM models failed');
    });

    it('should not retry on authentication errors', async () => {
      const model1 = createMockAdapter('model1', true, 'auth');
      const model2 = createMockAdapter('model2');
      const caller = new MultiModelCaller({
        models: [model1, model2],
        maxRetriesPerModel: 3,
      });

      const response = await caller.call('Test prompt');

      // Should fallback to model2 without retrying model1
      expect(response).toBeDefined();
      expect(response.text).toContain('model2');
    });
  });

  describe('callWithMessages', () => {
    it('should call first model successfully with messages', async () => {
      const model1 = createMockAdapter('model1');
      const caller = new MultiModelCaller({ models: [model1] });

      const messages = [
        { role: 'system' as const, content: 'You are a helpful assistant' },
        { role: 'user' as const, content: 'Hello' },
      ];

      const response = await caller.callWithMessages(messages);

      expect(response).toBeDefined();
      expect(response.text).toContain('model1');
      expect(response.text).toContain('"messages":2');
    });

    it('should fallback on messages call', async () => {
      const model1 = createMockAdapter('model1', true);
      const model2 = createMockAdapter('model2');
      const caller = new MultiModelCaller({
        models: [model1, model2],
        maxRetriesPerModel: 1,
      });

      const messages = [{ role: 'user' as const, content: 'Hello' }];

      const response = await caller.callWithMessages(messages);

      expect(response).toBeDefined();
      expect(response.text).toContain('model2');
    });
  });

  describe('response validation', () => {
    it('should validate response by default', async () => {
      const model1 = createMockAdapter('model1');
      const caller = new MultiModelCaller({
        models: [model1],
        validateResponse: true,
      });

      const response = await caller.call('Test prompt');

      expect(response).toBeDefined();
    });

    it('should handle empty responses', async () => {
      const model1: LLMAdapter = {
        ...createMockAdapter('model1'),
        call(): Promise<LLMCallResponse> {
          return Promise.resolve({
            text: '',
            tokensUsed: { prompt: 10, completion: 0, total: 10 },
            model: 'model1',
            responseTimeMs: 100,
            finishReason: 'stop',
          });
        },
      };

      const model2 = createMockAdapter('model2');

      const caller = new MultiModelCaller({
        models: [model1, model2],
        validateResponse: true,
      });

      // Should fallback to model2 due to validation failure
      const response = await caller.call('Test prompt');
      expect(response.text).toContain('model2');
    });
  });

  describe('JSON extraction', () => {
    it('should extract JSON from XML tags', () => {
      const model1 = createMockAdapter('model1');
      const caller = new MultiModelCaller({
        models: [model1],
        autoExtractJson: true,
      });

      const json = caller.extractJson('<final_output>{"test": true}</final_output>');
      expect(json).toBe('{"test": true}');
    });

    it('should extract JSON from code blocks', () => {
      const model1 = createMockAdapter('model1');
      const caller = new MultiModelCaller({
        models: [model1],
        autoExtractJson: true,
      });

      const json = caller.extractJson('```json\n{"test": true}\n```');
      expect(json).toBe('{"test": true}');
    });

    it('should extract plain JSON', () => {
      const model1 = createMockAdapter('model1');
      const caller = new MultiModelCaller({
        models: [model1],
        autoExtractJson: true,
      });

      const json = caller.extractJson('Some text {"test": true} more text');
      expect(json).toBe('{"test": true}');
    });

    it('should return null if no JSON found', () => {
      const model1 = createMockAdapter('model1');
      const caller = new MultiModelCaller({
        models: [model1],
        autoExtractJson: true,
      });

      const json = caller.extractJson('No JSON here');
      expect(json).toBeNull();
    });
  });

  describe('error classification', () => {
    it('should classify rate limit errors as retryable', async () => {
      const callCount = { count: 0 };
      const model1: LLMAdapter = {
        ...createMockAdapter('model1'),
        call(): Promise<LLMCallResponse> {
          callCount.count++;
          if (callCount.count < 2) {
            return Promise.reject(new Error('Rate limit exceeded (429)'));
          }
          return Promise.resolve({
            text: 'Success',
            tokensUsed: { prompt: 10, completion: 20, total: 30 },
            model: 'model1',
            responseTimeMs: 100,
            finishReason: 'stop',
          });
        },
      };

      const caller = new MultiModelCaller({
        models: [model1],
        maxRetriesPerModel: 2,
      });

      const response = await caller.call('Test prompt');
      expect(response.text).toBe('Success');
      expect(callCount.count).toBe(2); // Should have retried once
    });
  });

  describe('capabilities', () => {
    it('should return model capabilities', () => {
      const model1 = createMockAdapter('model1');
      const caller = new MultiModelCaller({ models: [model1] });

      const capabilities = caller.getCapabilities(0);

      expect(capabilities).toBeDefined();
      expect(capabilities?.maxTokens).toBe(128000);
      expect(capabilities?.supportsStreaming).toBe(true);
    });

    it('should return null for invalid model index', () => {
      const model1 = createMockAdapter('model1');
      const caller = new MultiModelCaller({ models: [model1] });

      const capabilities = caller.getCapabilities(999);

      expect(capabilities).toBeNull();
    });
  });
});
