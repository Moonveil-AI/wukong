import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useWukongClient } from '../useWukongClient';

// Create mock client implementation
const createMockClient = (overrides = {}) => ({
  healthCheck: vi.fn().mockResolvedValue({ status: 'ok', timestamp: new Date().toISOString() }),
  createSession: vi.fn().mockResolvedValue({ id: 'test-session-id' }),
  getSession: vi.fn().mockResolvedValue({ id: 'test-session-id' }),
  getHistory: vi.fn().mockResolvedValue({
    sessionId: 'test-session-id',
    goal: 'Test goal',
    history: [],
  }),
  connectSSE: vi.fn(),
  connectWebSocket: vi.fn().mockResolvedValue(undefined),
  disconnect: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
  execute: vi.fn().mockResolvedValue({ success: true }),
  stopExecution: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

// Mock @wukong/client
vi.mock('@wukong/client', () => ({
  // biome-ignore lint/style/useNamingConvention: WukongClient is a class name and should be PascalCase
  WukongClient: vi.fn(() => createMockClient()),
}));

// Mock useSessionPersistence
vi.mock('../useSessionPersistence', () => ({
  useSessionPersistence: vi.fn(() => ({
    getPersistedSessionId: vi.fn(() => null),
    persistSessionId: vi.fn(),
  })),
}));

describe('useWukongClient - Bug Fixes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Bug Fix #1: Duplicate Event Handlers (2025-12-27)', () => {
    it('should call off() to cleanup event handlers on unmount', async () => {
      const mockOn = vi.fn();
      const mockOff = vi.fn();

      // Override mock for this specific test
      const { WukongClient } = await import('@wukong/client');
      vi.mocked(WukongClient).mockImplementationOnce(
        () => createMockClient({ on: mockOn, off: mockOff }) as any,
      );

      const { unmount } = renderHook(() => useWukongClient({ apiUrl: 'http://localhost:3001' }));

      // Wait for initialization
      await waitFor(
        () => {
          expect(mockOn).toHaveBeenCalled();
        },
        { timeout: 3000 },
      );

      // Unmount the hook
      unmount();

      // CRITICAL: off() must be called to prevent duplicate event handlers
      expect(mockOff).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  describe('Bug Fix #2: Multi-turn History Restoration (2025-12-27)', () => {
    it('should restore all conversation turns, not just the first one', async () => {
      const mockHistory = {
        sessionId: 'existing-session-id',
        goal: 'First question',
        history: [
          {
            id: 1,
            stepNumber: 1,
            action: 'Finish',
            status: 'completed',
            discarded: false,
            llmPrompt: '<goal_description>First question</goal_description>',
            llmResponse:
              '<final_output>{"action":"Finish","message_to_user":"Answer to first question"}</final_output>',
            createdAt: '2025-12-27T00:00:00.000Z',
            completedAt: '2025-12-27T00:00:01.000Z',
          },
          {
            id: 2,
            stepNumber: 2,
            action: 'Finish',
            status: 'completed',
            discarded: false,
            llmPrompt: '<goal_description>Second question</goal_description>',
            llmResponse:
              '<final_output>{"action":"Finish","message_to_user":"Answer to second question"}</final_output>',
            createdAt: '2025-12-27T00:01:00.000Z',
            completedAt: '2025-12-27T00:01:01.000Z',
          },
        ],
      };

      // Mock client to return history
      const { WukongClient } = await import('@wukong/client');
      vi.mocked(WukongClient).mockImplementationOnce(
        () =>
          createMockClient({
            getSession: vi.fn().mockResolvedValue({ id: 'existing-session-id' }),
            getHistory: vi.fn().mockResolvedValue(mockHistory),
          }) as any,
      );

      // Mock session persistence to restore session
      const { useSessionPersistence } = await import('../useSessionPersistence');
      vi.mocked(useSessionPersistence).mockReturnValueOnce({
        getPersistedSessionId: vi.fn(() => 'existing-session-id'),
        persistSessionId: vi.fn(),
      });

      const { result } = renderHook(() =>
        useWukongClient({
          apiUrl: 'http://localhost:3001',
          restoreSession: true,
        }),
      );

      await waitFor(
        () => {
          expect(result.current.status).toBe('ready');
        },
        { timeout: 3000 },
      );

      // CRITICAL: Should have user messages for BOTH conversation turns
      const userMessages = result.current.messages.filter((m) => m.role === 'user');
      expect(userMessages.length).toBeGreaterThanOrEqual(2);

      // Verify first turn
      const hasFirstQuestion = result.current.messages.some((m) =>
        m.content.includes('First question'),
      );
      expect(hasFirstQuestion).toBe(true);

      // Verify second turn
      const hasSecondQuestion = result.current.messages.some((m) =>
        m.content.includes('Second question'),
      );
      expect(hasSecondQuestion).toBe(true);
    });
  });

  describe('Bug Fix #3: Step Details in History (2025-12-27)', () => {
    it('should show all intermediate steps, not just the final Finish message', async () => {
      const mockHistory = {
        sessionId: 'existing-session-id',
        goal: 'Calculate something',
        history: [
          {
            id: 1,
            stepNumber: 1,
            action: 'CallTool',
            status: 'completed',
            discarded: false,
            llmPrompt: '<goal_description>Calculate something</goal_description>',
            llmResponse:
              '<final_output>{"action":"CallTool","reasoning":"First multiply the numbers"}</final_output>',
            selectedTool: 'calculator',
            stepResult: '"calculator returned: 120"',
            createdAt: '2025-12-27T00:00:00.000Z',
            completedAt: '2025-12-27T00:00:01.000Z',
          },
          {
            id: 2,
            stepNumber: 2,
            action: 'CallTool',
            status: 'completed',
            discarded: false,
            llmPrompt: '<goal_description>Calculate something</goal_description>',
            llmResponse:
              '<final_output>{"action":"CallTool","reasoning":"Then add the number"}</final_output>',
            selectedTool: 'calculator',
            stepResult: '"calculator returned: 162"',
            createdAt: '2025-12-27T00:01:00.000Z',
            completedAt: '2025-12-27T00:01:01.000Z',
          },
          {
            id: 3,
            stepNumber: 3,
            action: 'Finish',
            status: 'completed',
            discarded: false,
            llmPrompt: '<goal_description>Calculate something</goal_description>',
            llmResponse:
              '<final_output>{"action":"Finish","message_to_user":"Final result is 162"}</final_output>',
            createdAt: '2025-12-27T00:02:00.000Z',
            completedAt: '2025-12-27T00:02:01.000Z',
          },
        ],
      };

      const { WukongClient } = await import('@wukong/client');
      vi.mocked(WukongClient).mockImplementationOnce(
        () =>
          createMockClient({
            getSession: vi.fn().mockResolvedValue({ id: 'existing-session-id' }),
            getHistory: vi.fn().mockResolvedValue(mockHistory),
          }) as any,
      );

      const { useSessionPersistence } = await import('../useSessionPersistence');
      vi.mocked(useSessionPersistence).mockReturnValueOnce({
        getPersistedSessionId: vi.fn(() => 'existing-session-id'),
        persistSessionId: vi.fn(),
      });

      const { result } = renderHook(() =>
        useWukongClient({
          apiUrl: 'http://localhost:3001',
          restoreSession: true,
        }),
      );

      await waitFor(
        () => {
          expect(result.current.status).toBe('ready');
        },
        { timeout: 3000 },
      );

      const assistantMessages = result.current.messages.filter((m) => m.role === 'assistant');

      // CRITICAL: Should show intermediate steps, not just final message
      // Expect at least 3 messages: step 1, step 2, and finish
      expect(assistantMessages.length).toBeGreaterThanOrEqual(3);

      // Verify intermediate steps show reasoning
      const hasMultiply = assistantMessages.some((m) => m.content.includes('multiply'));
      const hasAdd = assistantMessages.some((m) => m.content.includes('add'));
      const hasFinal = assistantMessages.some((m) => m.content.includes('Final result'));

      expect(hasMultiply).toBe(true);
      expect(hasAdd).toBe(true);
      expect(hasFinal).toBe(true);
    });
  });
});
