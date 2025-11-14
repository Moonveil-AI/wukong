/**
 * Async Tool Executor
 *
 * Handles long-running tools that execute asynchronously with polling or webhook support.
 */

import type { WukongEventEmitter } from '../EventEmitter';
import type { Tool, ToolContext, ToolResult } from '../types';
import type { CacheAdapter } from '../types/adapters';

// ==========================================
// Types
// ==========================================

/**
 * Async tool execution status
 */
export type AsyncTaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'timeout';

/**
 * Async tool type
 */
export type AsyncToolType = 'polling' | 'webhook';

/**
 * Async task record stored in cache
 */
export interface AsyncToolTask {
  /** Internal task ID */
  internalTaskId: string;

  /** Tool name */
  toolName: string;

  /** Tool parameters */
  parameters: Record<string, any>;

  /** Session and step context */
  sessionId: string;
  stepId: number;

  /** Task status */
  status: AsyncTaskStatus;

  /** External API task ID (if applicable) */
  externalTaskId?: string;

  /** Result data */
  result?: any;

  /** Error message */
  error?: string;

  /** Progress tracking */
  progress?: number;
  statusMessage?: string;

  /** Retry tracking */
  retryCount: number;
  maxRetries: number;

  /** Timing */
  startedAt?: Date;
  completedAt?: Date;
  lastPolledAt?: Date;

  /** Metadata */
  asyncType: AsyncToolType;
  estimatedTime: number;
}

/**
 * Async tool handler interface
 */
export interface AsyncToolHandler {
  /**
   * Submit task to external API
   * @returns External task ID
   */
  submit(params: Record<string, any>, context: ToolContext): Promise<string>;

  /**
   * Poll task status (for polling type)
   */
  poll?(
    externalTaskId: string,
    context: ToolContext,
  ): Promise<{
    status: AsyncTaskStatus;
    progress?: number;
    result?: any;
    statusMessage?: string;
  }>;

  /**
   * Handle webhook notification (for webhook type)
   */
  onWebhook?(
    payload: any,
    context: ToolContext,
  ): Promise<{
    status: AsyncTaskStatus;
    result?: any;
  }>;
}

/**
 * Async tool with handler
 */
export interface AsyncTool extends Tool {
  asyncHandler: AsyncToolHandler;
  asyncType: AsyncToolType;
  pollingInterval?: number;
  maxRetries?: number;
}

/**
 * Async executor configuration
 */
export interface AsyncToolExecutorConfig {
  /** Cache adapter for task tracking */
  cacheAdapter: CacheAdapter;

  /** Event emitter for notifications */
  eventEmitter?: WukongEventEmitter;

  /** Default polling interval in seconds */
  defaultPollingInterval?: number;

  /** Default max retries */
  defaultMaxRetries?: number;

  /** Task timeout in seconds */
  taskTimeout?: number;

  /** Custom error handler */
  onError?: (error: Error, task: AsyncToolTask) => void;
}

/**
 * Task submission options
 */
export interface TaskSubmitOptions {
  sessionId: string;
  stepId: number;
  context: ToolContext;
}

// ==========================================
// AsyncToolExecutor
// ==========================================

/**
 * Async Tool Executor
 *
 * Manages asynchronous tool execution with polling and webhook support.
 */
export class AsyncToolExecutor {
  private cache: CacheAdapter;
  private eventEmitter?: WukongEventEmitter;
  private config: Required<Omit<AsyncToolExecutorConfig, 'eventEmitter' | 'onError'>> & {
    eventEmitter?: WukongEventEmitter;
    onError?: (error: Error, task: AsyncToolTask) => void;
  };

  constructor(config: AsyncToolExecutorConfig) {
    this.cache = config.cacheAdapter;
    this.eventEmitter = config.eventEmitter;
    this.config = {
      cacheAdapter: config.cacheAdapter,
      eventEmitter: config.eventEmitter,
      defaultPollingInterval: config.defaultPollingInterval ?? 5,
      defaultMaxRetries: config.defaultMaxRetries ?? 50,
      taskTimeout: config.taskTimeout ?? 3600,
      onError: config.onError,
    };
  }

  /**
   * Execute an async tool
   *
   * @returns Internal task ID
   */
  async executeAsync(
    tool: AsyncTool,
    params: Record<string, any>,
    options: TaskSubmitOptions,
  ): Promise<string> {
    const taskId = this.generateTaskId();

    try {
      // Create task record
      const task: AsyncToolTask = {
        internalTaskId: taskId,
        toolName: tool.metadata.name,
        parameters: params,
        sessionId: options.sessionId,
        stepId: options.stepId,
        status: 'pending',
        retryCount: 0,
        maxRetries: tool.maxRetries ?? this.config.defaultMaxRetries,
        asyncType: tool.asyncType,
        estimatedTime: tool.metadata.estimatedTime,
      };

      // Store in cache
      await this.cache.set(`async:task:${taskId}`, task, {
        ttl: this.config.taskTimeout,
      });

      // Emit submitted event
      this.emitEvent('tool:async:submitted', {
        taskId,
        toolName: tool.metadata.name,
        estimatedTime: tool.metadata.estimatedTime,
        sessionId: options.sessionId,
        stepId: options.stepId,
      });

      // Submit to external API
      try {
        const externalTaskId = await tool.asyncHandler.submit(params, options.context);

        // Update task with external ID
        task.externalTaskId = externalTaskId;
        task.status = 'running';
        task.startedAt = new Date();
        await this.cache.set(`async:task:${taskId}`, task, {
          ttl: this.config.taskTimeout,
        });

        // Add to polling queue if polling type
        if (tool.asyncType === 'polling') {
          await this.addToPollingQueue(taskId);
        }

        // Emit running event
        this.emitEvent('tool:async:running', {
          taskId,
          externalTaskId,
          toolName: tool.metadata.name,
        });
      } catch (error) {
        // Failed to submit
        task.status = 'failed';
        task.error = error instanceof Error ? error.message : String(error);
        task.completedAt = new Date();
        await this.cache.set(`async:task:${taskId}`, task, {
          ttl: 3600, // Keep failed tasks for 1 hour
        });

        // Emit error
        this.emitEvent('tool:async:error', {
          taskId,
          error: task.error,
        });

        throw error;
      }

      return taskId;
    } catch (error) {
      if (this.config.onError && error instanceof Error) {
        try {
          this.config.onError(error, {
            internalTaskId: taskId,
            toolName: tool.metadata.name,
            parameters: params,
            sessionId: options.sessionId,
            stepId: options.stepId,
            status: 'failed',
            retryCount: 0,
            maxRetries: 0,
            asyncType: tool.asyncType,
            estimatedTime: tool.metadata.estimatedTime,
          });
        } catch (handlerError) {
          console.error('[AsyncToolExecutor] Error in error handler:', handlerError);
        }
      }
      throw error;
    }
  }

  /**
   * Poll a task to check its status
   *
   * @returns Updated task status
   */
  async pollTask(taskId: string, tool: AsyncTool, context: ToolContext): Promise<AsyncToolTask> {
    const task = await this.getTask(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    if (task.status === 'completed' || task.status === 'failed') {
      return task;
    }

    if (!task.externalTaskId) {
      throw new Error(`Task ${taskId} has no external task ID`);
    }

    if (!tool.asyncHandler.poll) {
      throw new Error(`Tool ${tool.metadata.name} does not support polling`);
    }

    try {
      // Query external API
      const status = await tool.asyncHandler.poll(task.externalTaskId, context);

      // Update task
      task.status = status.status;
      task.progress = status.progress;
      task.statusMessage = status.statusMessage;
      task.lastPolledAt = new Date();

      if (status.status === 'completed') {
        task.result = status.result;
        task.completedAt = new Date();
        await this.handleTaskCompletion(task);
      } else if (status.status === 'failed') {
        task.error = status.statusMessage || 'Task failed';
        task.completedAt = new Date();
        await this.handleTaskFailure(task);
      } else {
        // Still running, re-add to polling queue
        await this.cache.set(`async:task:${taskId}`, task, {
          ttl: this.config.taskTimeout,
        });
        await this.addToPollingQueue(taskId);

        // Emit progress event
        this.emitEvent('tool:async:progress', {
          taskId,
          status: task.status,
          progress: task.progress,
          statusMessage: task.statusMessage,
        });
      }

      return task;
    } catch (error) {
      // Polling failed
      task.retryCount++;

      if (task.retryCount >= task.maxRetries) {
        task.status = 'failed';
        task.error = `Polling failed after ${task.retryCount} attempts: ${error instanceof Error ? error.message : String(error)}`;
        task.completedAt = new Date();
        await this.handleTaskFailure(task);
      } else {
        // Retry
        await this.cache.set(`async:task:${taskId}`, task, {
          ttl: this.config.taskTimeout,
        });
        await this.addToPollingQueue(taskId);
      }

      return task;
    }
  }

  /**
   * Handle webhook notification
   */
  async handleWebhook(
    taskId: string,
    payload: any,
    tool: AsyncTool,
    context: ToolContext,
  ): Promise<AsyncToolTask> {
    const task = await this.getTask(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    if (!tool.asyncHandler.onWebhook) {
      throw new Error(`Tool ${tool.metadata.name} does not support webhooks`);
    }

    try {
      const result = await tool.asyncHandler.onWebhook(payload, context);

      task.status = result.status;
      task.result = result.result;

      if (result.status === 'completed') {
        task.completedAt = new Date();
        await this.handleTaskCompletion(task);
      } else if (result.status === 'failed') {
        task.error = 'Task failed';
        task.completedAt = new Date();
        await this.handleTaskFailure(task);
      } else {
        await this.cache.set(`async:task:${taskId}`, task, {
          ttl: this.config.taskTimeout,
        });
      }

      return task;
    } catch (error) {
      task.status = 'failed';
      task.error = error instanceof Error ? error.message : String(error);
      task.completedAt = new Date();
      await this.handleTaskFailure(task);
      throw error;
    }
  }

  /**
   * Get task by ID
   */
  async getTask(taskId: string): Promise<AsyncToolTask | null> {
    return await this.cache.get<AsyncToolTask>(`async:task:${taskId}`);
  }

  /**
   * Get all tasks for a session
   */
  async getSessionTasks(sessionId: string): Promise<AsyncToolTask[]> {
    const keys = await this.cache.keys('async:task:*');
    const tasks: AsyncToolTask[] = [];

    for (const key of keys) {
      const task = await this.cache.get<AsyncToolTask>(key);
      if (task && task.sessionId === sessionId) {
        tasks.push(task);
      }
    }

    return tasks;
  }

  /**
   * Get pending tasks
   */
  async getPendingTasks(): Promise<AsyncToolTask[]> {
    const keys = await this.cache.keys('async:task:*');
    const tasks: AsyncToolTask[] = [];

    for (const key of keys) {
      const task = await this.cache.get<AsyncToolTask>(key);
      if (task && (task.status === 'pending' || task.status === 'running')) {
        tasks.push(task);
      }
    }

    return tasks;
  }

  /**
   * Cancel a task
   */
  async cancelTask(taskId: string): Promise<void> {
    const task = await this.getTask(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    task.status = 'failed';
    task.error = 'Task cancelled by user';
    task.completedAt = new Date();

    await this.cache.set(`async:task:${taskId}`, task, {
      ttl: 3600,
    });

    // Remove from polling queue
    await this.removeFromPollingQueue(taskId);

    // Emit cancelled event
    this.emitEvent('tool:async:cancelled', {
      taskId,
      toolName: task.toolName,
    });
  }

  /**
   * Get polling queue size
   */
  async getQueueSize(): Promise<number> {
    const queueKeys = await this.cache.keys('async:polling:queue:*');
    return queueKeys.length;
  }

  /**
   * Convert async task to tool result
   */
  taskToToolResult(task: AsyncToolTask): ToolResult {
    if (task.status === 'completed') {
      return {
        success: true,
        result: task.result,
        summary: `Async task completed: ${task.toolName}`,
      };
    }

    if (task.status === 'failed' || task.status === 'timeout') {
      return {
        success: false,
        error: task.error || 'Task failed',
        canRetry: task.status === 'timeout',
        suggestion: task.status === 'timeout' ? 'Try increasing the timeout' : undefined,
      };
    }

    // Still running
    return {
      success: false,
      error: 'Task is still running',
      canRetry: true,
      taskId: task.internalTaskId,
    };
  }

  // ==========================================
  // Private Methods
  // ==========================================

  /**
   * Generate unique task ID
   */
  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Add task to polling queue
   */
  private async addToPollingQueue(taskId: string): Promise<void> {
    await this.cache.queuePush('async:polling:queue', taskId);
  }

  /**
   * Remove task from polling queue
   */
  private async removeFromPollingQueue(taskId: string): Promise<void> {
    // Note: This is a simplified implementation
    // A production version might need a more efficient queue implementation
    const task = await this.getTask(taskId);
    if (task) {
      await this.cache.delete(`async:polling:queue:${taskId}`);
    }
  }

  /**
   * Handle task completion
   */
  private async handleTaskCompletion(task: AsyncToolTask): Promise<void> {
    // Store completed task with longer TTL
    await this.cache.set(`async:task:${task.internalTaskId}`, task, {
      ttl: 86400, // 24 hours
    });

    // Remove from polling queue
    await this.removeFromPollingQueue(task.internalTaskId);

    // Emit completion event
    this.emitEvent('tool:async:completed', {
      taskId: task.internalTaskId,
      toolName: task.toolName,
      result: task.result,
      sessionId: task.sessionId,
      stepId: task.stepId,
    });
  }

  /**
   * Handle task failure
   */
  private async handleTaskFailure(task: AsyncToolTask): Promise<void> {
    // Store failed task
    await this.cache.set(`async:task:${task.internalTaskId}`, task, {
      ttl: 3600, // 1 hour
    });

    // Remove from polling queue
    await this.removeFromPollingQueue(task.internalTaskId);

    // Emit error event
    this.emitEvent('tool:async:error', {
      taskId: task.internalTaskId,
      toolName: task.toolName,
      error: task.error,
      sessionId: task.sessionId,
      stepId: task.stepId,
    });

    // Call error handler
    if (this.config.onError) {
      try {
        this.config.onError(new Error(task.error || 'Task failed'), task);
      } catch (handlerError) {
        console.error('[AsyncToolExecutor] Error in error handler:', handlerError);
      }
    }
  }

  /**
   * Emit event via event emitter
   */
  private emitEvent(eventName: string, data: any): void {
    if (!this.eventEmitter) {
      return;
    }

    // The event emitter expects an event object with an 'event' property
    // For now, we'll skip strict typing and just emit generic events
    // In a production implementation, we'd create proper event objects
    // matching the WukongEvent union type
    try {
      // Create event object
      const eventObj = {
        event: eventName,
        ...data,
      };
      (this.eventEmitter as any).emit(eventObj);
    } catch (error) {
      console.error('[AsyncToolExecutor] Failed to emit event:', error);
    }
  }

  /**
   * Get execution statistics
   */
  getStats() {
    return {
      defaultPollingInterval: this.config.defaultPollingInterval,
      defaultMaxRetries: this.config.defaultMaxRetries,
      taskTimeout: this.config.taskTimeout,
    };
  }
}
