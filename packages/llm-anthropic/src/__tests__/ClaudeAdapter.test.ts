/**
 * Tests for ClaudeAdapter
 *
 * Note: These tests require an ANTHROPIC_API_KEY environment variable.
 * They are skipped if the key is not present to avoid CI failures.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { ClaudeAdapter } from '../ClaudeAdapter';

const API_KEY = process.env.ANTHROPIC_API_KEY;
const shouldSkip = !API_KEY;

describe('ClaudeAdapter', () => {
  let adapter: ClaudeAdapter;

  beforeEach(() => {
    if (API_KEY) {
      adapter = new ClaudeAdapter({
        apiKey: API_KEY,
        model: 'claude-sonnet-4.5-20241022',
      });
    }
  });

  it('should throw error if API key is not provided', () => {
    expect(() => new ClaudeAdapter({ apiKey: '' })).toThrow('Anthropic API key is required');
  });

  it.skipIf(shouldSkip)(
    'should call Claude API successfully',
    async () => {
      const response = await adapter.call('Say hello in 3 words');

      expect(response).toBeDefined();
      expect(response.text).toBeDefined();
      expect(response.text.length).toBeGreaterThan(0);
      expect(response.tokensUsed).toBeDefined();
      expect(response.tokensUsed.total).toBeGreaterThan(0);
      expect(response.model).toContain('claude');
      expect(response.responseTimeMs).toBeGreaterThan(0);
    },
    30000,
  );

  it.skipIf(shouldSkip)(
    'should handle streaming correctly',
    async () => {
      const chunks: string[] = [];
      let completedText = '';

      const response = await adapter.callWithStreaming('Count from 1 to 5', {
        streaming: {
          onChunk: (chunk) => {
            chunks.push(chunk);
          },
          onComplete: (fullText) => {
            completedText = fullText;
          },
        },
      });

      expect(chunks.length).toBeGreaterThan(0);
      expect(completedText).toBeDefined();
      expect(response.text).toBe(completedText);
      expect(response.tokensUsed.total).toBeGreaterThan(0);
    },
    30000,
  );

  it.skipIf(shouldSkip)(
    'should work with Haiku model',
    async () => {
      const haikuAdapter = new ClaudeAdapter({
        apiKey: API_KEY as string,
        model: 'claude-haiku-4.5-20241022',
      });

      const response = await haikuAdapter.call('Say hello');

      expect(response).toBeDefined();
      expect(response.text).toBeDefined();
      expect(response.model).toContain('haiku');
    },
    30000,
  );

  it('should count tokens (estimation)', async () => {
    const text = 'Hello, world!';
    const tokens = await adapter.countTokens(text);

    expect(tokens).toBeGreaterThan(0);
    expect(tokens).toBeLessThan(100); // Should be a small number for short text
  });

  it('should return correct capabilities for Sonnet', () => {
    const capabilities = adapter.getCapabilities();

    expect(capabilities.maxTokens).toBe(200000);
    expect(capabilities.supportsStreaming).toBe(true);
    expect(capabilities.supportsFunctionCalling).toBe(true);
    expect(capabilities.supportsVision).toBe(true);
  });

  it('should return correct capabilities for Haiku', () => {
    const haikuAdapter = new ClaudeAdapter({
      apiKey: API_KEY || 'test-key',
      model: 'claude-haiku-4.5-20241022',
    });

    const capabilities = haikuAdapter.getCapabilities();

    expect(capabilities.maxTokens).toBe(200000);
    expect(capabilities.supportsStreaming).toBe(true);
    expect(capabilities.supportsFunctionCalling).toBe(true);
    expect(capabilities.supportsVision).toBe(false); // Haiku doesn't support vision
  });

  it.skipIf(shouldSkip)(
    'should handle system messages correctly',
    async () => {
      const response = await adapter.callWithMessages([
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Say hello' },
      ]);

      expect(response).toBeDefined();
      expect(response.text).toBeDefined();
    },
    30000,
  );

  it.skipIf(shouldSkip)(
    'should handle temperature parameter',
    async () => {
      const response = await adapter.call('Generate a random number', {
        temperature: 1.0,
      });

      expect(response).toBeDefined();
      expect(response.text).toBeDefined();
    },
    30000,
  );

  it.skipIf(shouldSkip)(
    'should handle maxTokens parameter',
    async () => {
      const response = await adapter.call('Tell me a long story', {
        maxTokens: 50,
      });

      expect(response).toBeDefined();
      expect(response.text).toBeDefined();
      expect(response.finishReason).toBe('length'); // Should stop due to length
    },
    30000,
  );

  it.skipIf(shouldSkip)(
    'should handle errors gracefully',
    async () => {
      const badAdapter = new ClaudeAdapter({
        apiKey: 'invalid-key',
        model: 'claude-sonnet-4.5-20241022',
      });

      await expect(badAdapter.call('test')).rejects.toThrow();
    },
    30000,
  );
});
