/**
 * @wukong/embeddings - OpenAI Embeddings Tests
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OpenAIEmbeddings } from '../OpenAIEmbeddings';

// Create a mock function outside
const mockCreate = vi.fn();

// Mock OpenAI
vi.mock('openai', () => {
  return {
    default: class MockOpenAI {
      embeddings = {
        create: mockCreate,
      };
    },
  };
});

describe('OpenAIEmbeddings', () => {
  let embeddings: OpenAIEmbeddings;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Create embeddings instance
    embeddings = new OpenAIEmbeddings({
      apiKey: 'test-api-key',
    });
  });

  describe('constructor', () => {
    it('should throw error if API key is missing', () => {
      expect(() => {
        new OpenAIEmbeddings({ apiKey: '' });
      }).toThrow('OpenAI API key is required');
    });

    it('should use default model', () => {
      const emb = new OpenAIEmbeddings({ apiKey: 'test' });
      expect(emb.getModel()).toBe('text-embedding-3-small');
    });

    it('should use custom model', () => {
      const emb = new OpenAIEmbeddings({
        apiKey: 'test',
        model: 'text-embedding-3-large',
      });
      expect(emb.getModel()).toBe('text-embedding-3-large');
    });

    it('should set correct dimensions for known models', () => {
      const small = new OpenAIEmbeddings({
        apiKey: 'test',
        model: 'text-embedding-3-small',
      });
      expect(small.getDimensions()).toBe(1536);

      const large = new OpenAIEmbeddings({
        apiKey: 'test',
        model: 'text-embedding-3-large',
      });
      expect(large.getDimensions()).toBe(3072);

      const ada = new OpenAIEmbeddings({
        apiKey: 'test',
        model: 'text-embedding-ada-002',
      });
      expect(ada.getDimensions()).toBe(1536);
    });
  });

  describe('generate', () => {
    it('should generate embedding for single text', async () => {
      const mockEmbedding = Array(1536).fill(0.1);

      mockCreate.mockResolvedValue({
        data: [{ embedding: mockEmbedding }],
        // biome-ignore lint/style/useNamingConvention: OpenAI API uses snake_case
        usage: { total_tokens: 10 },
      });

      const result = await embeddings.generate('test text');

      expect(result).toEqual(mockEmbedding);
      expect(mockCreate).toHaveBeenCalledWith({
        model: 'text-embedding-3-small',
        input: ['test text'],
        user: undefined,
        dimensions: undefined,
      });
    });

    it('should pass options to OpenAI', async () => {
      mockCreate.mockResolvedValue({
        data: [{ embedding: Array(1536).fill(0.1) }],
        // biome-ignore lint/style/useNamingConvention: OpenAI API uses snake_case
        usage: { total_tokens: 10 },
      });

      await embeddings.generate('test', {
        user: 'user-123',
        dimensions: 1024,
      });

      expect(mockCreate).toHaveBeenCalledWith({
        model: 'text-embedding-3-small',
        input: ['test'],
        user: 'user-123',
        dimensions: 1024,
      });
    });
  });

  describe('generateBatch', () => {
    it('should generate embeddings for multiple texts', async () => {
      const mockEmbeddings = [Array(1536).fill(0.1), Array(1536).fill(0.2), Array(1536).fill(0.3)];

      mockCreate.mockResolvedValue({
        data: mockEmbeddings.map((embedding) => ({ embedding })),
        // biome-ignore lint/style/useNamingConvention: OpenAI API uses snake_case
        usage: { total_tokens: 30 },
      });

      const result = await embeddings.generateBatch(['text 1', 'text 2', 'text 3']);

      expect(result.embeddings).toHaveLength(3);
      expect(result.embeddings[0].embedding).toEqual(mockEmbeddings[0]);
      expect(result.embeddings[1].embedding).toEqual(mockEmbeddings[1]);
      expect(result.embeddings[2].embedding).toEqual(mockEmbeddings[2]);
      expect(result.totalTokens).toBe(30);
      expect(result.model).toBe('text-embedding-3-small');
    });

    it('should throw error for empty array', async () => {
      await expect(embeddings.generateBatch([])).rejects.toThrow('At least one text is required');
    });

    it('should handle large batches by splitting', async () => {
      const texts = Array(250)
        .fill(null)
        .map((_, i) => `text ${i}`);

      // Mock returns different sizes for each batch
      mockCreate
        .mockResolvedValueOnce({
          data: Array(100)
            .fill(null)
            .map(() => ({ embedding: Array(1536).fill(0.1) })),
          // biome-ignore lint/style/useNamingConvention: OpenAI API uses snake_case
          usage: { total_tokens: 100 },
        })
        .mockResolvedValueOnce({
          data: Array(100)
            .fill(null)
            .map(() => ({ embedding: Array(1536).fill(0.1) })),
          // biome-ignore lint/style/useNamingConvention: OpenAI API uses snake_case
          usage: { total_tokens: 100 },
        })
        .mockResolvedValueOnce({
          data: Array(50)
            .fill(null)
            .map(() => ({ embedding: Array(1536).fill(0.1) })),
          // biome-ignore lint/style/useNamingConvention: OpenAI API uses snake_case
          usage: { total_tokens: 50 },
        });

      const result = await embeddings.generateBatch(texts);

      // Should split into 3 batches (100, 100, 50)
      expect(mockCreate).toHaveBeenCalledTimes(3);
      expect(result.embeddings).toHaveLength(250);
      expect(result.totalTokens).toBe(250); // 100 + 100 + 50
    });
  });

  describe('retry logic', () => {
    it('should retry on rate limit error', async () => {
      const mockEmbedding = Array(1536).fill(0.1);

      // Fail first two times, succeed on third
      mockCreate
        .mockRejectedValueOnce(new Error('Rate limit exceeded (429)'))
        .mockRejectedValueOnce(new Error('Rate limit exceeded (429)'))
        .mockResolvedValue({
          data: [{ embedding: mockEmbedding }],
          // biome-ignore lint/style/useNamingConvention: OpenAI API uses snake_case
          usage: { total_tokens: 10 },
        });

      const emb = new OpenAIEmbeddings({
        apiKey: 'test',
        maxRetries: 3,
        retryDelayMs: 10, // Short delay for testing
      });

      const result = await emb.generate('test');

      expect(result).toEqual(mockEmbedding);
      expect(mockCreate).toHaveBeenCalledTimes(3);
    });

    it('should retry on timeout error', async () => {
      const mockEmbedding = Array(1536).fill(0.1);

      mockCreate.mockRejectedValueOnce(new Error('Request timeout')).mockResolvedValue({
        data: [{ embedding: mockEmbedding }],
        // biome-ignore lint/style/useNamingConvention: OpenAI API uses snake_case
        usage: { total_tokens: 10 },
      });

      const emb = new OpenAIEmbeddings({
        apiKey: 'test',
        maxRetries: 1,
        retryDelayMs: 10,
      });

      const result = await emb.generate('test');

      expect(result).toEqual(mockEmbedding);
      expect(mockCreate).toHaveBeenCalledTimes(2);
    });

    it('should not retry on invalid API key error', async () => {
      mockCreate.mockRejectedValue(new Error('Invalid API key'));

      const emb = new OpenAIEmbeddings({
        apiKey: 'test',
        maxRetries: 3,
        retryDelayMs: 10,
      });

      await expect(emb.generate('test')).rejects.toThrow('Invalid API key');

      // Should not retry on non-retryable error
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it('should fail after max retries', async () => {
      mockCreate.mockRejectedValue(new Error('Rate limit exceeded (429)'));

      const emb = new OpenAIEmbeddings({
        apiKey: 'test',
        maxRetries: 2,
        retryDelayMs: 10,
      });

      await expect(emb.generate('test')).rejects.toThrow(
        /Failed to generate embeddings after 3 attempts/,
      );

      expect(mockCreate).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });
  });

  describe('getDimensions', () => {
    it('should return correct dimensions', () => {
      expect(embeddings.getDimensions()).toBe(1536);
    });
  });

  describe('getModel', () => {
    it('should return model name', () => {
      expect(embeddings.getModel()).toBe('text-embedding-3-small');
    });
  });
});
