/**
 * AsyncToolExecutor Tests
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ToolContext, ToolMetadata } from '../../types';
import type { CacheAdapter } from '../../types/adapters';
import { type AsyncTool, AsyncToolExecutor, type AsyncToolTask } from '../AsyncToolExecutor';

// Mock cache adapter
class MockCacheAdapter implements CacheAdapter {
  private data = new Map<string, any>();
  private queue: any[] = [];

  async get<T = any>(key: string): Promise<T | null> {
    return this.data.get(key) || null;
  }

  async set(key: string, value: any, _options?: any): Promise<void> {
    this.data.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.data.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    return this.data.has(key);
  }

  async increment(key: string, by = 1): Promise<number> {
    const current = (this.data.get(key) as number) || 0;
    const newValue = current + by;
    this.data.set(key, newValue);
    return newValue;
  }

  async decrement(key: string, by = 1): Promise<number> {
    return this.increment(key, -by);
  }

  async expire(_key: string, _seconds: number): Promise<void> {
    // Mock implementation
  }

  async mget<T = any>(keys: string[]): Promise<Array<T | null>> {
    return keys.map((key) => this.data.get(key) || null);
  }

  async mset(entries: Array<{ key: string; value: any; options?: any }>): Promise<void> {
    for (const entry of entries) {
      this.data.set(entry.key, entry.value);
    }
  }

  async mdel(keys: string[]): Promise<void> {
    for (const key of keys) {
      this.data.delete(key);
    }
  }

  async keys(pattern: string): Promise<string[]> {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return Array.from(this.data.keys()).filter((key) => regex.test(key));
  }

  async clear(): Promise<void> {
    this.data.clear();
  }

  async queuePush(_queueName: string, value: any): Promise<void> {
    this.queue.push(value);
  }

  async queuePop(_queueName: string): Promise<any> {
    return this.queue.shift();
  }

  async queueLength(_queueName: string): Promise<number> {
    return this.queue.length;
  }

  async lock(key: string, _ttl: number): Promise<boolean> {
    if (this.data.has(`lock:${key}`)) {
      return false;
    }
    this.data.set(`lock:${key}`, true);
    return true;
  }

  async unlock(key: string): Promise<void> {
    this.data.delete(`lock:${key}`);
  }
}

// Mock event emitter
class MockEventEmitter {
  private listeners = new Map<string, Array<(eventObj: any) => void>>();

  on(event: string, listener: (eventObj: any) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)?.push(listener);
  }

  emit(eventObj: any): void {
    const eventName = eventObj.event;
    const listeners = this.listeners.get(eventName);
    if (listeners) {
      for (const listener of listeners) {
        listener(eventObj);
      }
    }
  }
}

describe('AsyncToolExecutor', () => {
  let executor: AsyncToolExecutor;
  let cache: MockCacheAdapter;
  let eventEmitter: MockEventEmitter;

  beforeEach(() => {
    cache = new MockCacheAdapter();
    eventEmitter = new MockEventEmitter();

    executor = new AsyncToolExecutor({
      cacheAdapter: cache as any,
      eventEmitter: eventEmitter as any,
      defaultPollingInterval: 5,
      defaultMaxRetries: 3,
      taskTimeout: 60,
    });
  });

  describe('executeAsync', () => {
    it('should submit async task and return task ID', async () => {
      const mockTool: AsyncTool = {
        metadata: {
          name: 'test_async_tool',
          description: 'Test async tool',
          version: '1.0.0',
          category: 'other',
          riskLevel: 'low',
          timeout: 60,
          requiresConfirmation: false,
          async: true,
          estimatedTime: 30,
        } as ToolMetadata,
        schema: { type: 'object', properties: {} },
        handler: vi.fn(),
        asyncHandler: {
          submit: vi.fn().mockResolvedValue('external-123'),
        },
        asyncType: 'polling',
      };

      const context: ToolContext = {
        sessionId: 'session-1',
        stepId: 1,
        apiKeys: {},
      };

      const taskId = await executor.executeAsync(
        mockTool,
        { test: 'value' },
        {
          sessionId: 'session-1',
          stepId: 1,
          context,
        },
      );

      expect(taskId).toMatch(/^task_\d+_/);
      expect(mockTool.asyncHandler.submit).toHaveBeenCalledWith({ test: 'value' }, context);

      // Verify task was stored in cache
      const task = await executor.getTask(taskId);
      expect(task).toBeDefined();
      expect(task?.status).toBe('running');
      expect(task?.externalTaskId).toBe('external-123');
    });

    it('should emit submitted and running events', async () => {
      const submittedSpy = vi.fn();
      const runningSpy = vi.fn();

      eventEmitter.on('tool:async:submitted', submittedSpy);
      eventEmitter.on('tool:async:running', runningSpy);

      const mockTool: AsyncTool = {
        metadata: {
          name: 'test_tool',
          description: 'Test',
          version: '1.0.0',
          category: 'other',
          riskLevel: 'low',
          timeout: 60,
          requiresConfirmation: false,
          async: true,
          estimatedTime: 30,
        } as ToolMetadata,
        schema: { type: 'object', properties: {} },
        handler: vi.fn(),
        asyncHandler: {
          submit: vi.fn().mockResolvedValue('external-456'),
        },
        asyncType: 'polling',
      };

      await executor.executeAsync(
        mockTool,
        {},
        {
          sessionId: 'session-1',
          stepId: 1,
          context: { sessionId: 'session-1', stepId: 1, apiKeys: {} },
        },
      );

      expect(submittedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          toolName: 'test_tool',
          estimatedTime: 30,
        }),
      );
      expect(runningSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          externalTaskId: 'external-456',
        }),
      );
    });

    it('should handle submission failure', async () => {
      const errorSpy = vi.fn();
      eventEmitter.on('tool:async:error', errorSpy);

      const mockTool: AsyncTool = {
        metadata: {
          name: 'failing_tool',
          description: 'Test',
          version: '1.0.0',
          category: 'other',
          riskLevel: 'low',
          timeout: 60,
          requiresConfirmation: false,
          async: true,
          estimatedTime: 30,
        } as ToolMetadata,
        schema: { type: 'object', properties: {} },
        handler: vi.fn(),
        asyncHandler: {
          submit: vi.fn().mockRejectedValue(new Error('API error')),
        },
        asyncType: 'polling',
      };

      await expect(
        executor.executeAsync(
          mockTool,
          {},
          {
            sessionId: 'session-1',
            stepId: 1,
            context: { sessionId: 'session-1', stepId: 1, apiKeys: {} },
          },
        ),
      ).rejects.toThrow('API error');

      expect(errorSpy).toHaveBeenCalled();
    });
  });

  describe('pollTask', () => {
    it('should poll task and update status', async () => {
      const mockTool: AsyncTool = {
        metadata: {
          name: 'poll_tool',
          description: 'Test',
          version: '1.0.0',
          category: 'other',
          riskLevel: 'low',
          timeout: 60,
          requiresConfirmation: false,
          async: true,
          estimatedTime: 30,
        } as ToolMetadata,
        schema: { type: 'object', properties: {} },
        handler: vi.fn(),
        asyncHandler: {
          submit: vi.fn().mockResolvedValue('external-789'),
          poll: vi.fn().mockResolvedValue({
            status: 'running',
            progress: 50,
            statusMessage: 'Processing...',
          }),
        },
        asyncType: 'polling',
      };

      const context: ToolContext = {
        sessionId: 'session-1',
        stepId: 1,
        apiKeys: {},
      };

      // Submit task first
      const taskId = await executor.executeAsync(
        mockTool,
        {},
        {
          sessionId: 'session-1',
          stepId: 1,
          context,
        },
      );

      // Poll the task
      const updatedTask = await executor.pollTask(taskId, mockTool, context);

      expect(updatedTask.status).toBe('running');
      expect(updatedTask.progress).toBe(50);
      expect(updatedTask.statusMessage).toBe('Processing...');
      expect(mockTool.asyncHandler.poll).toHaveBeenCalledWith('external-789', context);
    });

    it('should handle task completion', async () => {
      const completedSpy = vi.fn();
      eventEmitter.on('tool:async:completed', completedSpy);

      const mockTool: AsyncTool = {
        metadata: {
          name: 'complete_tool',
          description: 'Test',
          version: '1.0.0',
          category: 'other',
          riskLevel: 'low',
          timeout: 60,
          requiresConfirmation: false,
          async: true,
          estimatedTime: 30,
        } as ToolMetadata,
        schema: { type: 'object', properties: {} },
        handler: vi.fn(),
        asyncHandler: {
          submit: vi.fn().mockResolvedValue('external-999'),
          poll: vi.fn().mockResolvedValue({
            status: 'completed',
            progress: 100,
            result: { output: 'success' },
          }),
        },
        asyncType: 'polling',
      };

      const context: ToolContext = {
        sessionId: 'session-1',
        stepId: 1,
        apiKeys: {},
      };

      const taskId = await executor.executeAsync(
        mockTool,
        {},
        {
          sessionId: 'session-1',
          stepId: 1,
          context,
        },
      );

      const completedTask = await executor.pollTask(taskId, mockTool, context);

      expect(completedTask.status).toBe('completed');
      expect(completedTask.result).toEqual({ output: 'success' });
      expect(completedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId,
          result: { output: 'success' },
        }),
      );
    });

    it('should handle task failure', async () => {
      const errorSpy = vi.fn();
      eventEmitter.on('tool:async:error', errorSpy);

      const mockTool: AsyncTool = {
        metadata: {
          name: 'fail_tool',
          description: 'Test',
          version: '1.0.0',
          category: 'other',
          riskLevel: 'low',
          timeout: 60,
          requiresConfirmation: false,
          async: true,
          estimatedTime: 30,
        } as ToolMetadata,
        schema: { type: 'object', properties: {} },
        handler: vi.fn(),
        asyncHandler: {
          submit: vi.fn().mockResolvedValue('external-fail'),
          poll: vi.fn().mockResolvedValue({
            status: 'failed',
            statusMessage: 'Processing failed',
          }),
        },
        asyncType: 'polling',
      };

      const context: ToolContext = {
        sessionId: 'session-1',
        stepId: 1,
        apiKeys: {},
      };

      const taskId = await executor.executeAsync(
        mockTool,
        {},
        {
          sessionId: 'session-1',
          stepId: 1,
          context,
        },
      );

      const failedTask = await executor.pollTask(taskId, mockTool, context);

      expect(failedTask.status).toBe('failed');
      expect(failedTask.error).toBe('Processing failed');
      expect(errorSpy).toHaveBeenCalled();
    });

    it('should retry on polling error', async () => {
      const mockTool: AsyncTool = {
        metadata: {
          name: 'retry_tool',
          description: 'Test',
          version: '1.0.0',
          category: 'other',
          riskLevel: 'low',
          timeout: 60,
          requiresConfirmation: false,
          async: true,
          estimatedTime: 30,
        } as ToolMetadata,
        schema: { type: 'object', properties: {} },
        handler: vi.fn(),
        asyncHandler: {
          submit: vi.fn().mockResolvedValue('external-retry'),
          poll: vi.fn().mockRejectedValue(new Error('Network error')),
        },
        asyncType: 'polling',
        maxRetries: 2,
      };

      const context: ToolContext = {
        sessionId: 'session-1',
        stepId: 1,
        apiKeys: {},
      };

      const taskId = await executor.executeAsync(
        mockTool,
        {},
        {
          sessionId: 'session-1',
          stepId: 1,
          context,
        },
      );

      const task1 = await executor.pollTask(taskId, mockTool, context);
      expect(task1.retryCount).toBe(1);
      expect(task1.status).toBe('running');

      const task2 = await executor.pollTask(taskId, mockTool, context);
      expect(task2.retryCount).toBe(2);
      expect(task2.status).toBe('failed');
    });
  });

  describe('handleWebhook', () => {
    it('should handle webhook notification', async () => {
      const completedSpy = vi.fn();
      eventEmitter.on('tool:async:completed', completedSpy);

      const mockTool: AsyncTool = {
        metadata: {
          name: 'webhook_tool',
          description: 'Test',
          version: '1.0.0',
          category: 'other',
          riskLevel: 'low',
          timeout: 60,
          requiresConfirmation: false,
          async: true,
          estimatedTime: 30,
        } as ToolMetadata,
        schema: { type: 'object', properties: {} },
        handler: vi.fn(),
        asyncHandler: {
          submit: vi.fn().mockResolvedValue('external-webhook'),
          onWebhook: vi.fn().mockResolvedValue({
            status: 'completed',
            result: { data: 'webhook result' },
          }),
        },
        asyncType: 'webhook',
      };

      const context: ToolContext = {
        sessionId: 'session-1',
        stepId: 1,
        apiKeys: {},
      };

      const taskId = await executor.executeAsync(
        mockTool,
        {},
        {
          sessionId: 'session-1',
          stepId: 1,
          context,
        },
      );

      const payload = { status: 'completed', output: 'test' };
      const task = await executor.handleWebhook(taskId, payload, mockTool, context);

      expect(task.status).toBe('completed');
      expect(task.result).toEqual({ data: 'webhook result' });
      expect(completedSpy).toHaveBeenCalled();
    });
  });

  describe('task management', () => {
    it('should get task by ID', async () => {
      const mockTool: AsyncTool = {
        metadata: {
          name: 'get_tool',
          description: 'Test',
          version: '1.0.0',
          category: 'other',
          riskLevel: 'low',
          timeout: 60,
          requiresConfirmation: false,
          async: true,
          estimatedTime: 30,
        } as ToolMetadata,
        schema: { type: 'object', properties: {} },
        handler: vi.fn(),
        asyncHandler: {
          submit: vi.fn().mockResolvedValue('external-get'),
        },
        asyncType: 'polling',
      };

      const taskId = await executor.executeAsync(
        mockTool,
        {},
        {
          sessionId: 'session-1',
          stepId: 1,
          context: { sessionId: 'session-1', stepId: 1, apiKeys: {} },
        },
      );

      const task = await executor.getTask(taskId);
      expect(task).toBeDefined();
      expect(task?.internalTaskId).toBe(taskId);
    });

    it('should get all tasks for a session', async () => {
      const mockTool: AsyncTool = {
        metadata: {
          name: 'session_tool',
          description: 'Test',
          version: '1.0.0',
          category: 'other',
          riskLevel: 'low',
          timeout: 60,
          requiresConfirmation: false,
          async: true,
          estimatedTime: 30,
        } as ToolMetadata,
        schema: { type: 'object', properties: {} },
        handler: vi.fn(),
        asyncHandler: {
          submit: vi.fn().mockResolvedValue('external-session'),
        },
        asyncType: 'polling',
      };

      await executor.executeAsync(
        mockTool,
        {},
        {
          sessionId: 'session-1',
          stepId: 1,
          context: { sessionId: 'session-1', stepId: 1, apiKeys: {} },
        },
      );

      await executor.executeAsync(
        mockTool,
        {},
        {
          sessionId: 'session-1',
          stepId: 2,
          context: { sessionId: 'session-1', stepId: 2, apiKeys: {} },
        },
      );

      await executor.executeAsync(
        mockTool,
        {},
        {
          sessionId: 'session-2',
          stepId: 1,
          context: { sessionId: 'session-2', stepId: 1, apiKeys: {} },
        },
      );

      const tasks = await executor.getSessionTasks('session-1');
      expect(tasks.length).toBe(2);
      expect(tasks.every((t) => t.sessionId === 'session-1')).toBe(true);
    });

    it('should cancel a task', async () => {
      const cancelledSpy = vi.fn();
      eventEmitter.on('tool:async:cancelled', cancelledSpy);

      const mockTool: AsyncTool = {
        metadata: {
          name: 'cancel_tool',
          description: 'Test',
          version: '1.0.0',
          category: 'other',
          riskLevel: 'low',
          timeout: 60,
          requiresConfirmation: false,
          async: true,
          estimatedTime: 30,
        } as ToolMetadata,
        schema: { type: 'object', properties: {} },
        handler: vi.fn(),
        asyncHandler: {
          submit: vi.fn().mockResolvedValue('external-cancel'),
        },
        asyncType: 'polling',
      };

      const taskId = await executor.executeAsync(
        mockTool,
        {},
        {
          sessionId: 'session-1',
          stepId: 1,
          context: { sessionId: 'session-1', stepId: 1, apiKeys: {} },
        },
      );

      await executor.cancelTask(taskId);

      const task = await executor.getTask(taskId);
      expect(task?.status).toBe('failed');
      expect(task?.error).toBe('Task cancelled by user');
      expect(cancelledSpy).toHaveBeenCalled();
    });
  });

  describe('taskToToolResult', () => {
    it('should convert completed task to success result', () => {
      const task: AsyncToolTask = {
        internalTaskId: 'task-1',
        toolName: 'test_tool',
        parameters: {},
        sessionId: 'session-1',
        stepId: 1,
        status: 'completed',
        result: { data: 'test' },
        retryCount: 0,
        maxRetries: 3,
        asyncType: 'polling',
        estimatedTime: 30,
      };

      const result = executor.taskToToolResult(task);
      expect(result.success).toBe(true);
      expect(result.result).toEqual({ data: 'test' });
    });

    it('should convert failed task to error result', () => {
      const task: AsyncToolTask = {
        internalTaskId: 'task-2',
        toolName: 'test_tool',
        parameters: {},
        sessionId: 'session-1',
        stepId: 1,
        status: 'failed',
        error: 'Task failed',
        retryCount: 0,
        maxRetries: 3,
        asyncType: 'polling',
        estimatedTime: 30,
      };

      const result = executor.taskToToolResult(task);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Task failed');
    });

    it('should convert running task to pending result', () => {
      const task: AsyncToolTask = {
        internalTaskId: 'task-3',
        toolName: 'test_tool',
        parameters: {},
        sessionId: 'session-1',
        stepId: 1,
        status: 'running',
        retryCount: 0,
        maxRetries: 3,
        asyncType: 'polling',
        estimatedTime: 30,
      };

      const result = executor.taskToToolResult(task);
      expect(result.success).toBe(false);
      expect(result.canRetry).toBe(true);
      expect(result.taskId).toBe('task-3');
    });
  });
});
