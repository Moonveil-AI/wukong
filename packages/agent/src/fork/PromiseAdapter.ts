/**
 * Promise-based Execution Adapter
 *
 * Executes sub-agents asynchronously in the same Node.js process using Promises.
 * Suitable for:
 * - Local development
 * - Long-running Node.js servers
 * - Self-hosted environments
 *
 * NOT suitable for:
 * - Serverless environments (Vercel, AWS Lambda, etc.)
 * - Short-lived processes
 */

import type { EventEmitter } from 'eventemitter3';
import type {
  ExecutionAdapter,
  SubAgentExecutionOptions,
  SubAgentExecutionResult,
} from './ExecutionAdapter.js';

/**
 * Promise-based execution adapter
 *
 * Executes sub-agents in the background using JavaScript Promises
 */
export class PromiseAdapter implements ExecutionAdapter {
  private runningTasks = new Map<string, boolean>();
  private taskStorageMap = new Map<string, any>();

  constructor(private eventEmitter?: EventEmitter) {}

  /**
   * Execute sub-agent in background (non-blocking)
   */
  async executeSubAgent(options: SubAgentExecutionOptions): Promise<void> {
    const { task, userId, organizationId, storageAdapter } = options;

    // Store the storage adapter for this task (for later polling)
    this.taskStorageMap.set(task.id, storageAdapter);

    // Mark task as running
    this.runningTasks.set(task.id, true);

    // Update task status to running
    await storageAdapter.updateForkAgentTask(task.id, {
      status: 'running',
      startedAt: new Date(),
    });

    // Execute in background (don't await)
    this.executeInBackground(options, userId, organizationId).catch((error) => {
      console.error(`[PromiseAdapter] Sub-agent ${task.id} failed:`, error);
    });
  }

  /**
   * Wait for sub-agent completion by polling database
   */
  async waitForCompletion(taskId: string, timeoutMs: number): Promise<SubAgentExecutionResult> {
    const storageAdapter = this.taskStorageMap.get(taskId);
    if (!storageAdapter) {
      throw new Error(`Storage adapter not found for task ${taskId}`);
    }

    const pollInterval = 2000; // 2 seconds
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const task = await storageAdapter.getForkAgentTask(taskId);

      if (!task) {
        throw new Error(`Task ${taskId} not found`);
      }

      if (task.status === 'completed') {
        this.runningTasks.delete(taskId);
        return {
          sessionId: task.subSessionId || '',
          status: 'completed',
          result: task.resultSummary,
          stepsExecuted: task.stepsExecuted,
          tokensUsed: task.tokensUsed,
          durationMs: task.executionDurationMs || 0,
        };
      }

      if (task.status === 'failed') {
        this.runningTasks.delete(taskId);
        return {
          sessionId: task.subSessionId || '',
          status: 'failed',
          error: task.errorMessage,
          stepsExecuted: task.stepsExecuted,
          tokensUsed: task.tokensUsed,
          durationMs: task.executionDurationMs || 0,
        };
      }

      if (task.status === 'timeout') {
        this.runningTasks.delete(taskId);
        return {
          sessionId: task.subSessionId || '',
          status: 'timeout',
          error: 'Execution timeout',
          stepsExecuted: task.stepsExecuted,
          tokensUsed: task.tokensUsed,
          durationMs: task.executionDurationMs || 0,
        };
      }

      // Wait before next poll
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    throw new Error(`Timeout waiting for sub-agent ${taskId} to complete`);
  }

  /**
   * Cancel a running sub-agent
   */
  async cancelSubAgent(taskId: string): Promise<void> {
    const storageAdapter = this.taskStorageMap.get(taskId);
    if (!storageAdapter) {
      throw new Error(`Storage adapter not found for task ${taskId}`);
    }

    // In Promise-based execution, we can only mark it as cancelled
    // The actual execution will continue until it checks the status
    this.runningTasks.delete(taskId);
    this.taskStorageMap.delete(taskId);

    const task = await storageAdapter.getForkAgentTask(taskId);
    if (task && task.status === 'running') {
      await storageAdapter.updateForkAgentTask(taskId, {
        status: 'failed',
        errorMessage: 'Cancelled by user',
        completedAt: new Date(),
      });
    }
  }

  /**
   * Check if sub-agent is still running
   */
  async isRunning(taskId: string): Promise<boolean> {
    // Return as promise to satisfy async requirement
    return await Promise.resolve(this.runningTasks.has(taskId));
  }

  /**
   * Get adapter name
   */
  getName(): string {
    return 'PromiseAdapter';
  }

  /**
   * Execute sub-agent in background
   */
  private async executeInBackground(
    options: SubAgentExecutionOptions,
    userId?: string,
    organizationId?: string,
  ): Promise<void> {
    const {
      task,
      storageAdapter,
      llmCaller,
      tools,
      apiKeys,
      filesAdapter,
      knowledgeBase,
      enableToolExecutor,
      companyName,
    } = options;
    const startTime = Date.now();

    try {
      // Dynamically import AutoAgent to avoid circular dependencies
      const { AutoAgent } = await import('../agents/AutoAgent.js');

      // Create sub-agent
      // Create event emitter if not provided
      const eventEmitter =
        this.eventEmitter || (await import('eventemitter3')).EventEmitter.prototype;

      const subAgent = new AutoAgent({
        storageAdapter,
        llmCaller,
        eventEmitter: eventEmitter as any,
        tools,
        apiKeys,
        filesAdapter,
        knowledgeBase,
        enableToolExecutor,
        companyName,
        maxSteps: task.maxSteps,
        timeoutSeconds: task.timeoutSeconds,
      });

      // Execute with timeout
      const result = await this.executeWithTimeout(async () => {
        return await subAgent.execute({
          goal: task.goal,
          context: {
            userId,
            organizationId,
            parentSessionId: task.parentSessionId,
          },
        });
      }, task.timeoutSeconds * 1000);

      // Get sub-agent session
      const subSession = await storageAdapter.getSession(result.sessionId);

      if (!subSession) {
        throw new Error(`Sub-agent session ${result.sessionId} not found`);
      }

      // Calculate execution duration
      const executionDurationMs = Date.now() - startTime;

      // Update task with results
      await storageAdapter.updateForkAgentTask(task.id, {
        status: 'completed',
        subSessionId: result.sessionId,
        resultSummary: JSON.stringify(result.result),
        stepsExecuted: result.stepsExecuted,
        tokensUsed: result.tokensUsed,
        toolsCalled: result.stepsExecuted,
        completedAt: new Date(),
        executionDurationMs,
      });

      // Mark as no longer running
      this.runningTasks.delete(task.id);

      // Emit completion event
      this.eventEmitter?.emit('subagent:completed', {
        sessionId: result.sessionId,
        summary: JSON.stringify(result.result),
        result: result.result,
        stepsExecuted: result.stepsExecuted,
        tokensUsed: result.tokensUsed,
        durationSeconds: executionDurationMs / 1000,
      });
    } catch (error: any) {
      // Calculate execution duration
      const executionDurationMs = Date.now() - startTime;

      // Determine if it's a timeout error
      const isTimeout = error.message?.includes('timeout') || error.name === 'TimeoutError';
      const status = isTimeout ? 'timeout' : 'failed';

      // Update task with error
      await storageAdapter.updateForkAgentTask(task.id, {
        status,
        errorMessage: error.message || 'Unknown error',
        completedAt: new Date(),
        executionDurationMs,
      });

      // Mark as no longer running
      this.runningTasks.delete(task.id);

      // Emit failure event
      this.eventEmitter?.emit('subagent:failed', {
        sessionId: task.subSessionId || task.id,
        error: error.message || 'Unknown error',
        stepsCompleted: 0,
      });
    }
  }

  /**
   * Execute function with timeout
   */
  private async executeWithTimeout<T>(fn: () => Promise<T>, timeoutMs: number): Promise<T> {
    return await Promise.race([
      fn(),
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Sub-agent execution timeout')), timeoutMs),
      ),
    ]);
  }
}
