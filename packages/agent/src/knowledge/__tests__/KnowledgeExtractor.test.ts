/**
 * Knowledge Extractor Tests
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MultiModelCaller } from '../../llm/MultiModelCaller';
import type { Session, Step } from '../../types';
import type { StorageAdapter } from '../../types/adapters';
import type { KnowledgeBaseManager } from '../KnowledgeBaseManager';
import { KnowledgeExtractor } from '../KnowledgeExtractor';

describe('KnowledgeExtractor', () => {
  let extractor: KnowledgeExtractor;
  let mockKnowledgeBase: KnowledgeBaseManager;
  let mockLLM: MultiModelCaller;
  let mockStorage: StorageAdapter;

  beforeEach(() => {
    // Create mock knowledge base
    mockKnowledgeBase = {
      search: vi.fn(),
      indexDocuments: vi.fn(),
      updateDocument: vi.fn(),
      deleteDocument: vi.fn(),
      clearCache: vi.fn(),
      getStats: vi.fn(),
    } as any;

    // Create mock LLM
    mockLLM = {
      call: vi.fn(),
      callWithMessages: vi.fn(),
    } as any;

    // Create mock storage
    mockStorage = {
      getSession: vi.fn(),
      listSteps: vi.fn(),
      updateSession: vi.fn(),
    } as any;

    extractor = new KnowledgeExtractor(mockKnowledgeBase, mockLLM, mockStorage);
  });

  describe('extractFromSession', () => {
    it('should extract knowledge from a completed session', async () => {
      // Setup mock session
      const session: Session = {
        id: 'session-1',
        goal: 'Create a vertical video',
        status: 'completed',
        userId: 'user-1',
        organizationId: 'org-1',
        agentType: 'AutoAgent',
        autoRun: true,
        depth: 0,
        isSubAgent: false,
        lastCompressedStepId: 0,
        isCompressing: false,
        isRunning: false,
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Setup mock steps
      const steps: Step[] = [
        {
          id: 1,
          sessionId: 'session-1',
          stepNumber: 1,
          action: 'CallTool',
          reasoning: 'Need to generate image',
          selectedTool: 'image_generator',
          parameters: { prompt: 'Test image' },
          stepResult: 'Image generated successfully',
          status: 'completed',
          discarded: false,
          isParallel: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      // Setup mock LLM response
      const mockLLMResponse = {
        text: JSON.stringify({
          knowledges: [
            {
              content: 'Use image_generator tool for creating images',
              // biome-ignore lint/style/useNamingConvention: LLM response format uses snake_case
              confidence_score: 0.8,
              level: 'public',
              type: 'methodology',
            },
          ],
        }),
        tokensUsed: { prompt: 100, completion: 50, total: 150 },
        model: 'gpt-4',
        responseTimeMs: 1000,
        finishReason: 'stop' as const,
      };

      vi.mocked(mockStorage.getSession).mockResolvedValue(session);
      vi.mocked(mockStorage.listSteps).mockResolvedValue(steps);
      vi.mocked(mockLLM.callWithMessages).mockResolvedValue(mockLLMResponse);
      vi.mocked(mockKnowledgeBase.search).mockResolvedValue([]);
      vi.mocked(mockKnowledgeBase.indexDocuments).mockResolvedValue({
        totalFiles: 1,
        filesProcessed: 1,
        totalChunks: 1,
        chunksIndexed: 1,
        status: 'complete',
      });
      vi.mocked(mockStorage.updateSession).mockResolvedValue(undefined);

      // Execute extraction
      const stats = await extractor.extractFromSession('session-1');

      // Verify results
      expect(stats.totalExtracted).toBe(1);
      expect(stats.newEntities).toBe(1);
      expect(stats.mergedEntities).toBe(0);
      expect(stats.duplicateEntities).toBe(0);
      expect(stats.lowConfidenceEntities).toBe(0);

      // Verify LLM was called with conversation history
      expect(mockLLM.callWithMessages).toHaveBeenCalled();

      // Verify session was updated
      expect(mockStorage.updateSession).toHaveBeenCalledWith('session-1', {
        lastKnowledgeExtractionAt: expect.any(Date),
      });
    });

    it('should filter out low confidence knowledge', async () => {
      const session: Session = {
        id: 'session-2',
        goal: 'Test goal',
        status: 'completed',
        agentType: 'AutoAgent',
        autoRun: true,
        depth: 0,
        isSubAgent: false,
        lastCompressedStepId: 0,
        isCompressing: false,
        isRunning: false,
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const steps: Step[] = [
        {
          id: 1,
          sessionId: 'session-2',
          stepNumber: 1,
          action: 'CallTool',
          status: 'completed',
          discarded: false,
          isParallel: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const mockLLMResponse = {
        text: JSON.stringify({
          knowledges: [
            {
              content: 'Low confidence knowledge',
              // biome-ignore lint/style/useNamingConvention: LLM response format uses snake_case
              confidence_score: 0.3,
              level: 'public',
              type: 'other',
            },
            {
              content: 'High confidence knowledge',
              // biome-ignore lint/style/useNamingConvention: LLM response format uses snake_case
              confidence_score: 0.9,
              level: 'public',
              type: 'methodology',
            },
          ],
        }),
        tokensUsed: { prompt: 100, completion: 50, total: 150 },
        model: 'gpt-4',
        responseTimeMs: 1000,
        finishReason: 'stop' as const,
      };

      vi.mocked(mockStorage.getSession).mockResolvedValue(session);
      vi.mocked(mockStorage.listSteps).mockResolvedValue(steps);
      vi.mocked(mockLLM.callWithMessages).mockResolvedValue(mockLLMResponse);
      vi.mocked(mockKnowledgeBase.search).mockResolvedValue([]);
      vi.mocked(mockKnowledgeBase.indexDocuments).mockResolvedValue({
        totalFiles: 1,
        filesProcessed: 1,
        totalChunks: 1,
        chunksIndexed: 1,
        status: 'complete',
      });
      vi.mocked(mockStorage.updateSession).mockResolvedValue(undefined);

      // Execute extraction with minConfidence of 0.6
      const stats = await extractor.extractFromSession('session-2', {
        minConfidence: 0.6,
      });

      // Verify low confidence knowledge was filtered
      expect(stats.totalExtracted).toBe(2);
      expect(stats.newEntities).toBe(1);
      expect(stats.lowConfidenceEntities).toBe(1);
    });

    it('should throw error for non-completed sessions', async () => {
      const session: Session = {
        id: 'session-3',
        goal: 'Test goal',
        status: 'active',
        agentType: 'AutoAgent',
        autoRun: true,
        depth: 0,
        isSubAgent: false,
        lastCompressedStepId: 0,
        isCompressing: false,
        isRunning: true,
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(mockStorage.getSession).mockResolvedValue(session);

      await expect(extractor.extractFromSession('session-3')).rejects.toThrow(
        'Cannot extract knowledge from session in status: active',
      );
    });

    it('should handle deduplication correctly', async () => {
      const session: Session = {
        id: 'session-4',
        goal: 'Test goal',
        status: 'completed',
        agentType: 'AutoAgent',
        autoRun: true,
        depth: 0,
        isSubAgent: false,
        lastCompressedStepId: 0,
        isCompressing: false,
        isRunning: false,
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const steps: Step[] = [
        {
          id: 1,
          sessionId: 'session-4',
          stepNumber: 1,
          action: 'CallTool',
          status: 'completed',
          discarded: false,
          isParallel: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      // Mock LLM responses
      const extractionResponse = {
        text: JSON.stringify({
          knowledges: [
            {
              content: 'Similar knowledge to existing',
              // biome-ignore lint/style/useNamingConvention: LLM response format uses snake_case
              confidence_score: 0.8,
              level: 'public',
              type: 'methodology',
            },
          ],
        }),
        tokensUsed: { prompt: 100, completion: 50, total: 150 },
        model: 'gpt-4',
        responseTimeMs: 1000,
        finishReason: 'stop' as const,
      };

      const comparisonResponse = {
        text: JSON.stringify({
          result: 'existing',
          reasoning: 'This knowledge already exists',
          // biome-ignore lint/style/useNamingConvention: LLM response format uses snake_case
          existing_id: 'existing-1',
        }),
        tokensUsed: { prompt: 100, completion: 50, total: 150 },
        model: 'gpt-4',
        responseTimeMs: 1000,
        finishReason: 'stop' as const,
      };

      vi.mocked(mockStorage.getSession).mockResolvedValue(session);
      vi.mocked(mockStorage.listSteps).mockResolvedValue(steps);
      vi.mocked(mockLLM.callWithMessages)
        .mockResolvedValueOnce(extractionResponse)
        .mockResolvedValueOnce(comparisonResponse);

      // Mock similar knowledge found
      vi.mocked(mockKnowledgeBase.search).mockResolvedValue([
        {
          id: 'existing-1',
          content: 'Existing similar knowledge',
          score: 0.9,
          metadata: {
            level: 'public',
            createdAt: new Date(),
          },
        },
      ]);

      vi.mocked(mockStorage.updateSession).mockResolvedValue(undefined);

      const stats = await extractor.extractFromSession('session-4');

      // Verify duplicate was detected
      expect(stats.duplicateEntities).toBe(1);
      expect(stats.newEntities).toBe(0);
    });

    it('should skip deduplication when requested', async () => {
      const session: Session = {
        id: 'session-5',
        goal: 'Test goal',
        status: 'completed',
        agentType: 'AutoAgent',
        autoRun: true,
        depth: 0,
        isSubAgent: false,
        lastCompressedStepId: 0,
        isCompressing: false,
        isRunning: false,
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const steps: Step[] = [
        {
          id: 1,
          sessionId: 'session-5',
          stepNumber: 1,
          action: 'CallTool',
          status: 'completed',
          discarded: false,
          isParallel: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const mockLLMResponse = {
        text: JSON.stringify({
          knowledges: [
            {
              content: 'Some knowledge',
              // biome-ignore lint/style/useNamingConvention: LLM response format uses snake_case
              confidence_score: 0.8,
              level: 'public',
              type: 'methodology',
            },
          ],
        }),
        tokensUsed: { prompt: 100, completion: 50, total: 150 },
        model: 'gpt-4',
        responseTimeMs: 1000,
        finishReason: 'stop' as const,
      };

      vi.mocked(mockStorage.getSession).mockResolvedValue(session);
      vi.mocked(mockStorage.listSteps).mockResolvedValue(steps);
      vi.mocked(mockLLM.callWithMessages).mockResolvedValue(mockLLMResponse);
      vi.mocked(mockKnowledgeBase.indexDocuments).mockResolvedValue({
        totalFiles: 1,
        filesProcessed: 1,
        totalChunks: 1,
        chunksIndexed: 1,
        status: 'complete',
      });
      vi.mocked(mockStorage.updateSession).mockResolvedValue(undefined);

      const stats = await extractor.extractFromSession('session-5', {
        skipDeduplication: true,
      });

      // Verify search was not called
      expect(mockKnowledgeBase.search).not.toHaveBeenCalled();
      expect(stats.newEntities).toBe(1);
    });
  });
});
