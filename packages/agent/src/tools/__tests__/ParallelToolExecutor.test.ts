/**
 * Tests for ParallelToolExecutor
 */

import { beforeEach, describe, expect, it } from 'vitest';
import type { ParallelToolCall, StorageAdapter, ToolContext, ToolResult } from '../../types';
import { ParallelToolExecutor } from '../ParallelToolExecutor';
import type { ToolExecutor } from '../ToolExecutor';

// Mock Storage Adapter
class MockStorageAdapter implements Partial<StorageAdapter> {
  private parallelToolCalls = new Map<number, ParallelToolCall>();
  private nextId = 1;

  async createParallelToolCall(
    data: Omit<ParallelToolCall, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<ParallelToolCall> {
    const id = this.nextId++;
    const toolCall: ParallelToolCall = {
      ...data,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.parallelToolCalls.set(id, toolCall);
    return toolCall;
  }

  async updateParallelToolCall(id: number, updates: Partial<ParallelToolCall>): Promise<void> {
    const existing = this.parallelToolCalls.get(id);
    if (existing) {
      this.parallelToolCalls.set(id, {
        ...existing,
        ...updates,
        updatedAt: new Date(),
      });
    }
  }

  async getParallelToolCall(id: number): Promise<ParallelToolCall | null> {
    return this.parallelToolCalls.get(id) || null;
  }

  async listParallelToolCalls(stepId: number): Promise<ParallelToolCall[]> {
    return Array.from(this.parallelToolCalls.values()).filter((tc) => tc.stepId === stepId);
  }

  reset(): void {
    this.parallelToolCalls.clear();
    this.nextId = 1;
  }
}

// Mock Tool Executor
class MockToolExecutor implements Partial<ToolExecutor> {
  private mockExecutions = new Map<string, (params: any) => Promise<ToolResult>>();

  setMockExecution(toolName: string, handler: (params: any) => Promise<ToolResult>): void {
    this.mockExecutions.set(toolName, handler);
  }

  async execute(request: {
    tool: string;
    params: Record<string, any>;
    context: ToolContext;
  }): Promise<ToolResult> {
    const handler = this.mockExecutions.get(request.tool);
    if (handler) {
      try {
        return await handler(request.params);
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }

    // Default success response
    return {
      success: true,
      result: `Result from ${request.tool}`,
    };
  }
}

// Mock Event Emitter
class MockEventEmitter {
  private events: Array<{ event: string; data: any }> = [];

  emit(eventObj: any): void {
    // Extract event name from the event object
    const eventName = eventObj.event;
    this.events.push({ event: eventName, data: eventObj });
  }

  getEvents(): Array<{ event: string; data: any }> {
    return this.events;
  }

  clearEvents(): void {
    this.events = [];
  }

  hasEvent(eventName: string): boolean {
    return this.events.some((e) => e.event === eventName);
  }

  getEvent(eventName: string): any {
    return this.events.find((e) => e.event === eventName)?.data;
  }
}

describe('ParallelToolExecutor', () => {
  let executor: ParallelToolExecutor;
  let storage: MockStorageAdapter;
  let toolExecutor: MockToolExecutor;
  let eventEmitter: MockEventEmitter;
  let context: ToolContext;

  beforeEach(() => {
    storage = new MockStorageAdapter();
    toolExecutor = new MockToolExecutor();
    eventEmitter = new MockEventEmitter();

    executor = new ParallelToolExecutor({
      toolExecutor: toolExecutor as any,
      storageAdapter: storage as any,
      eventEmitter: eventEmitter as any,
      defaultTimeout: 10, // 10 seconds for tests
      maxRetries: 2,
    });

    context = {
      sessionId: 'test-session',
      stepId: 1,
      apiKeys: {},
    };
  });

  describe('executeParallel - "all" strategy', () => {
    it('should execute all tools and wait for all to complete', async () => {
      const tools = [
        { toolId: 't1', toolName: 'tool1', parameters: { test: '1' } },
        { toolId: 't2', toolName: 'tool2', parameters: { test: '2' } },
        { toolId: 't3', toolName: 'tool3', parameters: { test: '3' } },
      ];

      const results = await executor.executeParallel(tools, {
        stepId: 1,
        sessionId: 'test-session',
        context,
        waitStrategy: 'all',
      });

      expect(results.completed.length).toBe(3);
      expect(results.failed.length).toBe(0);
      expect(results.pending.length).toBe(0);
      expect(results.conditionMet).toBe(true);
    });

    it('should handle partial failures with "all" strategy', async () => {
      // Mock one tool to fail
      toolExecutor.setMockExecution('tool2', async () => ({
        success: false,
        error: 'Tool failed',
        canRetry: false,
      }));

      const tools = [
        { toolId: 't1', toolName: 'tool1', parameters: {} },
        { toolId: 't2', toolName: 'tool2', parameters: {} },
        { toolId: 't3', toolName: 'tool3', parameters: {} },
      ];

      const results = await executor.executeParallel(tools, {
        stepId: 1,
        sessionId: 'test-session',
        context,
        waitStrategy: 'all',
      });

      expect(results.completed.length).toBe(2);
      expect(results.failed.length).toBe(1);
      expect(results.conditionMet).toBe(false); // Not all completed successfully
    });

    it('should emit appropriate events', async () => {
      const tools = [
        { toolId: 't1', toolName: 'tool1', parameters: {} },
        { toolId: 't2', toolName: 'tool2', parameters: {} },
      ];

      await executor.executeParallel(tools, {
        stepId: 1,
        sessionId: 'test-session',
        context,
        waitStrategy: 'all',
      });

      expect(eventEmitter.hasEvent('tools:parallel:submitted')).toBe(true);
      expect(eventEmitter.hasEvent('tool:parallel:started')).toBe(true);
      expect(eventEmitter.hasEvent('tool:parallel:completed')).toBe(true);
      expect(eventEmitter.hasEvent('tools:parallel:ready')).toBe(true);
    });
  });

  describe('executeParallel - "any" strategy', () => {
    it('should continue when any tool completes', async () => {
      // Make tool2 complete faster
      toolExecutor.setMockExecution('tool1', async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return { success: true, result: 'slow' };
      });

      toolExecutor.setMockExecution('tool2', async () => {
        return { success: true, result: 'fast' };
      });

      const tools = [
        { toolId: 't1', toolName: 'tool1', parameters: {} },
        { toolId: 't2', toolName: 'tool2', parameters: {} },
      ];

      const results = await executor.executeParallel(tools, {
        stepId: 1,
        sessionId: 'test-session',
        context,
        waitStrategy: 'any',
      });

      expect(results.completed.length).toBeGreaterThanOrEqual(1);
      expect(results.conditionMet).toBe(true);
    });

    it('should fail if all tools fail with "any" strategy', async () => {
      toolExecutor.setMockExecution('tool1', async () => ({
        success: false,
        error: 'Failed',
        canRetry: false,
      }));

      toolExecutor.setMockExecution('tool2', async () => ({
        success: false,
        error: 'Failed',
        canRetry: false,
      }));

      const tools = [
        { toolId: 't1', toolName: 'tool1', parameters: {} },
        { toolId: 't2', toolName: 'tool2', parameters: {} },
      ];

      const results = await executor.executeParallel(tools, {
        stepId: 1,
        sessionId: 'test-session',
        context,
        waitStrategy: 'any',
      });

      expect(results.completed.length).toBe(0);
      expect(results.failed.length).toBe(2);
      expect(results.conditionMet).toBe(false);
    });
  });

  describe('executeParallel - "majority" strategy', () => {
    it('should continue when majority completes', async () => {
      const tools = [
        { toolId: 't1', toolName: 'tool1', parameters: {} },
        { toolId: 't2', toolName: 'tool2', parameters: {} },
        { toolId: 't3', toolName: 'tool3', parameters: {} },
      ];

      const results = await executor.executeParallel(tools, {
        stepId: 1,
        sessionId: 'test-session',
        context,
        waitStrategy: 'majority',
      });

      expect(results.completed.length).toBeGreaterThanOrEqual(2); // >50%
      expect(results.conditionMet).toBe(true);
    });

    it('should fail if majority fails', async () => {
      toolExecutor.setMockExecution('tool1', async () => ({
        success: false,
        error: 'Failed',
        canRetry: false,
      }));

      toolExecutor.setMockExecution('tool2', async () => ({
        success: false,
        error: 'Failed',
        canRetry: false,
      }));

      const tools = [
        { toolId: 't1', toolName: 'tool1', parameters: {} },
        { toolId: 't2', toolName: 'tool2', parameters: {} },
        { toolId: 't3', toolName: 'tool3', parameters: {} },
      ];

      const results = await executor.executeParallel(tools, {
        stepId: 1,
        sessionId: 'test-session',
        context,
        waitStrategy: 'majority',
      });

      expect(results.completed.length).toBeLessThan(2); // Not majority
      expect(results.conditionMet).toBe(false);
    });
  });

  describe('retry logic', () => {
    it('should retry failed tools with canRetry=true', async () => {
      let attempts = 0;

      toolExecutor.setMockExecution('tool1', async () => {
        attempts++;
        if (attempts < 2) {
          return { success: false, error: 'Temporary failure', canRetry: true };
        }
        return { success: true, result: 'Success after retry' };
      });

      const tools = [{ toolId: 't1', toolName: 'tool1', parameters: {} }];

      const results = await executor.executeParallel(tools, {
        stepId: 1,
        sessionId: 'test-session',
        context,
        waitStrategy: 'all',
        maxRetries: 3,
      });

      expect(results.completed.length).toBe(1);
      expect(attempts).toBeGreaterThan(1);
    });

    it('should not retry if canRetry=false', async () => {
      let attempts = 0;

      toolExecutor.setMockExecution('tool1', async () => {
        attempts++;
        return { success: false, error: 'Permanent failure', canRetry: false };
      });

      const tools = [{ toolId: 't1', toolName: 'tool1', parameters: {} }];

      const results = await executor.executeParallel(tools, {
        stepId: 1,
        sessionId: 'test-session',
        context,
        waitStrategy: 'all',
      });

      expect(results.failed.length).toBe(1);
      expect(attempts).toBe(1); // No retries
    });
  });

  describe('error handling', () => {
    it('should handle tool execution errors', async () => {
      toolExecutor.setMockExecution('tool1', async () => {
        throw new Error('Unexpected error');
      });

      const tools = [{ toolId: 't1', toolName: 'tool1', parameters: {} }];

      const results = await executor.executeParallel(tools, {
        stepId: 1,
        sessionId: 'test-session',
        context,
        waitStrategy: 'all',
      });

      expect(results.failed.length).toBe(1);
      expect(eventEmitter.hasEvent('tool:parallel:failed')).toBe(true);
    });

    it('should reject duplicate tool IDs', async () => {
      const tools = [
        { toolId: 't1', toolName: 'tool1', parameters: {} },
        { toolId: 't1', toolName: 'tool2', parameters: {} }, // Duplicate ID
      ];

      await expect(
        executor.executeParallel(tools, {
          stepId: 1,
          sessionId: 'test-session',
          context,
          waitStrategy: 'all',
        }),
      ).rejects.toThrow('Duplicate tool ID');
    });

    it('should reject empty tool list', async () => {
      await expect(
        executor.executeParallel([], {
          stepId: 1,
          sessionId: 'test-session',
          context,
          waitStrategy: 'all',
        }),
      ).rejects.toThrow('No tools provided');
    });
  });

  describe('getToolCallStatus', () => {
    it('should retrieve tool call status', async () => {
      const tools = [{ toolId: 't1', toolName: 'tool1', parameters: {} }];

      await executor.executeParallel(tools, {
        stepId: 1,
        sessionId: 'test-session',
        context,
        waitStrategy: 'all',
      });

      const status = await executor.getToolCallStatus('t1', 1);
      expect(status).not.toBeNull();
      expect(status?.toolId).toBe('t1');
      expect(status?.status).toBe('completed');
    });
  });

  describe('getStepToolCalls', () => {
    it('should retrieve all tool calls for a step', async () => {
      const tools = [
        { toolId: 't1', toolName: 'tool1', parameters: {} },
        { toolId: 't2', toolName: 'tool2', parameters: {} },
      ];

      await executor.executeParallel(tools, {
        stepId: 1,
        sessionId: 'test-session',
        context,
        waitStrategy: 'all',
      });

      const toolCalls = await executor.getStepToolCalls(1);
      expect(toolCalls.length).toBe(2);
    });
  });

  describe('cancelStepToolCalls', () => {
    it('should cancel pending/running tools', async () => {
      // Create long-running tools
      toolExecutor.setMockExecution('tool1', async () => {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        return { success: true, result: 'done' };
      });

      const tools = [{ toolId: 't1', toolName: 'tool1', parameters: {} }];

      // Start execution (don't await)
      const executionPromise = executor.executeParallel(tools, {
        stepId: 1,
        sessionId: 'test-session',
        context,
        waitStrategy: 'all',
      });

      // Wait a bit for execution to start
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Cancel
      await executor.cancelStepToolCalls(1);

      // Check that cancel event was emitted
      expect(eventEmitter.hasEvent('tool:parallel:cancelled')).toBe(true);

      // Clean up - don't wait for full execution
      executionPromise.catch(() => {
        // Ignore errors from cancelled execution
      });
    });
  });

  describe('timeout handling', () => {
    it('should timeout long-running tools', async () => {
      toolExecutor.setMockExecution('tool1', async () => {
        // Simulate very long execution
        await new Promise((resolve) => setTimeout(resolve, 20000));
        return { success: true, result: 'done' };
      });

      const tools = [{ toolId: 't1', toolName: 'tool1', parameters: {} }];

      const _results = await executor.executeParallel(tools, {
        stepId: 1,
        sessionId: 'test-session',
        context,
        waitStrategy: 'all',
        timeout: 1, // 1 second timeout
      });

      // Should have timed out
      const toolCalls = await executor.getStepToolCalls(1);
      const timedOut = toolCalls.some((tc) => tc.status === 'timeout');
      expect(timedOut).toBe(true);
    });
  });
});
