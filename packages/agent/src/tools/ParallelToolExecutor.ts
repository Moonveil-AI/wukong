/**
 * Parallel Tool Executor
 *
 * Executes multiple tools simultaneously with different wait strategies.
 */

import type { WukongEventEmitter } from '../EventEmitter';
import type {
  ParallelResults,
  ParallelToolCall,
  ParallelToolCallStatus,
  StorageAdapter,
  ToolContext,
  WaitStrategy,
} from '../types';
import type { ToolExecutionRequest, ToolExecutor } from './ToolExecutor';

/**
 * Parallel tool execution configuration
 */
export interface ParallelToolExecutorConfig {
  /** Tool executor instance */
  toolExecutor: ToolExecutor;

  /** Storage adapter for tracking parallel calls */
  storageAdapter: StorageAdapter;

  /** Event emitter (optional) */
  eventEmitter?: WukongEventEmitter;

  /** Default timeout for parallel execution (seconds) */
  defaultTimeout?: number;

  /** Maximum retries per tool */
  maxRetries?: number;

  /** Custom error handler */
  onError?: (error: Error, toolCall: ParallelToolCall) => void;
}

/**
 * Parallel tool call request
 */
export interface ParallelToolRequest {
  /** Unique identifier for this tool call */
  toolId: string;

  /** Tool name */
  toolName: string;

  /** Tool parameters */
  parameters: Record<string, any>;
}

/**
 * Parallel execution options
 */
export interface ParallelExecutionOptions {
  /** Step ID this parallel execution belongs to */
  stepId: number;

  /** Session ID */
  sessionId: string;

  /** Execution context */
  context: ToolContext;

  /** Wait strategy */
  waitStrategy: WaitStrategy;

  /** Timeout in seconds (optional) */
  timeout?: number;

  /** Maximum retries per tool (optional) */
  maxRetries?: number;
}

/**
 * Parallel Tool Executor
 *
 * Manages parallel tool execution with different wait strategies.
 */
export class ParallelToolExecutor {
  private toolExecutor: ToolExecutor;
  private storage: StorageAdapter;
  private eventEmitter?: WukongEventEmitter;
  private config: Required<Omit<ParallelToolExecutorConfig, 'eventEmitter' | 'onError'>> & {
    eventEmitter?: WukongEventEmitter;
    onError?: (error: Error, toolCall: ParallelToolCall) => void;
  };

  constructor(config: ParallelToolExecutorConfig) {
    this.toolExecutor = config.toolExecutor;
    this.storage = config.storageAdapter;
    this.eventEmitter = config.eventEmitter;
    this.config = {
      toolExecutor: config.toolExecutor,
      storageAdapter: config.storageAdapter,
      eventEmitter: config.eventEmitter,
      defaultTimeout: config.defaultTimeout ?? 300, // 5 minutes
      maxRetries: config.maxRetries ?? 3,
      onError: config.onError,
    };
  }

  /**
   * Execute multiple tools in parallel
   *
   * @returns Results based on wait strategy
   */
  async executeParallel(
    tools: ParallelToolRequest[],
    options: ParallelExecutionOptions,
  ): Promise<ParallelResults> {
    const { stepId, sessionId, context, waitStrategy, timeout, maxRetries } = options;

    // Validate inputs
    if (!tools || tools.length === 0) {
      throw new Error('No tools provided for parallel execution');
    }

    // Check for duplicate tool IDs
    const toolIds = new Set<string>();
    for (const tool of tools) {
      if (toolIds.has(tool.toolId)) {
        throw new Error(`Duplicate tool ID: ${tool.toolId}`);
      }
      toolIds.add(tool.toolId);
    }

    // Emit submission event
    this.emitEvent('tools:parallel:submitted', {
      stepId,
      sessionId,
      count: tools.length,
      waitStrategy,
      toolIds: Array.from(toolIds),
    });

    // Create parallel tool call records in storage
    const toolCalls: ParallelToolCall[] = [];
    for (const tool of tools) {
      const toolCall: Omit<ParallelToolCall, 'id' | 'createdAt' | 'updatedAt'> = {
        stepId,
        toolId: tool.toolId,
        toolName: tool.toolName,
        parameters: tool.parameters,
        status: 'pending',
        progressPercentage: 0,
        retryCount: 0,
        maxRetries: maxRetries ?? this.config.maxRetries,
      };

      const created = await this.storage.createParallelToolCall(toolCall);
      toolCalls.push(created);
    }

    // Execute all tools in parallel
    const executionPromises = toolCalls.map((toolCall) => this.executeToolCall(toolCall, context));

    // Wait based on strategy
    const results = await this.waitForCompletion(
      executionPromises,
      toolCalls,
      waitStrategy,
      timeout ?? this.config.defaultTimeout,
    );

    // Emit ready event
    this.emitEvent('tools:parallel:ready', {
      stepId,
      sessionId,
      completed: results.completed.length,
      failed: results.failed.length,
      pending: results.pending.length,
      conditionMet: results.conditionMet,
    });

    return results;
  }

  /**
   * Execute a single tool call and update its status
   */
  private async executeToolCall(
    toolCall: ParallelToolCall,
    context: ToolContext,
  ): Promise<ParallelToolCall> {
    try {
      // Update status to running
      await this.updateToolCallStatus(toolCall.id, 'running', {
        startedAt: new Date(),
      });

      this.emitEvent('tool:parallel:started', {
        toolId: toolCall.toolId,
        toolName: toolCall.toolName,
        stepId: toolCall.stepId,
      });

      // Execute the tool
      const request: ToolExecutionRequest = {
        tool: toolCall.toolName,
        params: toolCall.parameters,
        context,
      };

      const result = await this.toolExecutor.execute(request);

      // Update status based on result
      if (result.success) {
        await this.updateToolCallStatus(toolCall.id, 'completed', {
          result: result.result ? JSON.stringify(result.result) : undefined,
          completedAt: new Date(),
          executionDurationMs: (result as any).executionTime,
          progressPercentage: 100,
        });

        this.emitEvent('tool:parallel:completed', {
          toolId: toolCall.toolId,
          toolName: toolCall.toolName,
          stepId: toolCall.stepId,
          result,
        });
      } else {
        // Check if we should retry
        if (result.canRetry && toolCall.retryCount < toolCall.maxRetries) {
          // Retry with exponential backoff
          const retryDelay = 2 ** toolCall.retryCount * 1000;
          await this.sleep(retryDelay);

          await this.updateToolCallStatus(toolCall.id, 'running', {
            retryCount: toolCall.retryCount + 1,
          });

          // Recursive retry
          const updatedToolCall = await this.storage.getParallelToolCall(toolCall.id);
          if (updatedToolCall) {
            return this.executeToolCall(updatedToolCall, context);
          }
        }

        // Failed after retries or not retryable
        await this.updateToolCallStatus(toolCall.id, 'failed', {
          errorMessage: result.error || 'Unknown error',
          completedAt: new Date(),
          progressPercentage: 0,
        });

        this.emitEvent('tool:parallel:failed', {
          toolId: toolCall.toolId,
          toolName: toolCall.toolName,
          stepId: toolCall.stepId,
          error: result.error,
        });
      }

      // Fetch updated tool call
      const updated = await this.storage.getParallelToolCall(toolCall.id);
      return updated || toolCall;
    } catch (error) {
      // Handle unexpected errors
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

      await this.updateToolCallStatus(toolCall.id, 'failed', {
        errorMessage,
        completedAt: new Date(),
      });

      this.emitEvent('tool:parallel:failed', {
        toolId: toolCall.toolId,
        toolName: toolCall.toolName,
        stepId: toolCall.stepId,
        error: errorMessage,
      });

      if (this.config.onError && error instanceof Error) {
        this.config.onError(error, toolCall);
      }

      // Return updated tool call
      const updated = await this.storage.getParallelToolCall(toolCall.id);
      return updated || toolCall;
    }
  }

  /**
   * Wait for completion based on strategy
   */
  private async waitForCompletion(
    promises: Promise<ParallelToolCall>[],
    toolCalls: ParallelToolCall[],
    strategy: WaitStrategy,
    timeoutSeconds: number,
  ): Promise<ParallelResults> {
    if (toolCalls.length === 0) {
      throw new Error('No tool calls to wait for');
    }
    // Safe to access after length check
    const firstToolCall = toolCalls[0];
    if (!firstToolCall) {
      throw new Error('Unexpected: first tool call is undefined');
    }
    const stepId = firstToolCall.stepId;

    // Create timeout promise
    const timeoutPromise = new Promise<'timeout'>((resolve) => {
      setTimeout(() => resolve('timeout'), timeoutSeconds * 1000);
    });

    let conditionMet = false;
    let completed: ParallelToolCall[] = [];
    let failed: ParallelToolCall[] = [];
    let pending: ParallelToolCall[] = [];

    switch (strategy) {
      case 'all': {
        // Wait for all tools to complete
        const raceResult = await Promise.race([Promise.allSettled(promises), timeoutPromise]);

        if (raceResult === 'timeout') {
          // Timeout occurred, mark incomplete tools as timeout
          for (const toolCall of toolCalls) {
            const current = await this.storage.getParallelToolCall(toolCall.id);
            if (current && current.status === 'running') {
              await this.updateToolCallStatus(toolCall.id, 'timeout', {
                completedAt: new Date(),
              });
            }
          }
        }

        // Collect all results
        const results = await this.getAllToolCalls(stepId);
        completed = results.filter((r) => r.status === 'completed');
        failed = results.filter((r) => r.status === 'failed' || r.status === 'timeout');
        pending = results.filter((r) => r.status === 'pending' || r.status === 'running');
        conditionMet = completed.length === toolCalls.length;
        break;
      }

      case 'any': {
        // Wait for any tool to complete successfully
        while (true) {
          const results = await this.getAllToolCalls(stepId);
          const completedResults = results.filter((r) => r.status === 'completed');

          if (completedResults.length > 0) {
            // At least one completed
            completed = completedResults;
            failed = results.filter((r) => r.status === 'failed' || r.status === 'timeout');
            pending = results.filter((r) => r.status === 'pending' || r.status === 'running');
            conditionMet = true;
            break;
          }

          // Check if all failed
          const failedResults = results.filter(
            (r) => r.status === 'failed' || r.status === 'timeout',
          );
          if (failedResults.length === toolCalls.length) {
            completed = [];
            failed = failedResults;
            pending = [];
            conditionMet = false;
            break;
          }

          // Check timeout
          const isTimeout = await Promise.race([
            this.sleep(100).then(() => false),
            timeoutPromise.then(() => true),
          ]);

          if (isTimeout) {
            // Timeout occurred
            for (const toolCall of toolCalls) {
              const current = await this.storage.getParallelToolCall(toolCall.id);
              if (current && current.status === 'running') {
                await this.updateToolCallStatus(toolCall.id, 'timeout', {
                  completedAt: new Date(),
                });
              }
            }

            const finalResults = await this.getAllToolCalls(stepId);
            completed = finalResults.filter((r) => r.status === 'completed');
            failed = finalResults.filter((r) => r.status === 'failed' || r.status === 'timeout');
            pending = [];
            conditionMet = completed.length > 0;
            break;
          }
        }
        break;
      }

      case 'majority': {
        // Wait for majority (>50%) to complete
        const majorityThreshold = Math.ceil(toolCalls.length / 2);

        while (true) {
          const results = await this.getAllToolCalls(stepId);
          const completedResults = results.filter((r) => r.status === 'completed');
          const failedResults = results.filter(
            (r) => r.status === 'failed' || r.status === 'timeout',
          );
          const finalizedCount = completedResults.length + failedResults.length;

          if (completedResults.length >= majorityThreshold) {
            // Majority completed successfully
            completed = completedResults;
            failed = failedResults;
            pending = results.filter((r) => r.status === 'pending' || r.status === 'running');
            conditionMet = true;
            break;
          }

          if (finalizedCount === toolCalls.length) {
            // All finished but majority not successful
            completed = completedResults;
            failed = failedResults;
            pending = [];
            conditionMet = completedResults.length >= majorityThreshold;
            break;
          }

          // Check timeout
          const isTimeout = await Promise.race([
            this.sleep(100).then(() => false),
            timeoutPromise.then(() => true),
          ]);

          if (isTimeout) {
            // Timeout occurred
            for (const toolCall of toolCalls) {
              const current = await this.storage.getParallelToolCall(toolCall.id);
              if (current && current.status === 'running') {
                await this.updateToolCallStatus(toolCall.id, 'timeout', {
                  completedAt: new Date(),
                });
              }
            }

            const finalResults = await this.getAllToolCalls(stepId);
            completed = finalResults.filter((r) => r.status === 'completed');
            failed = finalResults.filter((r) => r.status === 'failed' || r.status === 'timeout');
            pending = [];
            conditionMet = completed.length >= majorityThreshold;
            break;
          }
        }
        break;
      }
    }

    // Convert to result format
    return {
      stepId,
      completed: completed.map((tc) => ({
        toolId: tc.toolId,
        toolName: tc.toolName,
        result: {
          success: true,
          result: tc.result ? JSON.parse(tc.result) : undefined,
        },
      })),
      failed: failed.map((tc) => ({
        toolId: tc.toolId,
        toolName: tc.toolName,
        error: tc.errorMessage || 'Unknown error',
      })),
      pending: pending.map((tc) => ({
        toolId: tc.toolId,
        toolName: tc.toolName,
      })),
      conditionMet,
    };
  }

  /**
   * Get all tool calls for a step
   */
  private async getAllToolCalls(stepId: number): Promise<ParallelToolCall[]> {
    return await this.storage.listParallelToolCalls(stepId);
  }

  /**
   * Update tool call status
   */
  private async updateToolCallStatus(
    id: number,
    status: ParallelToolCallStatus,
    updates: Partial<ParallelToolCall>,
  ): Promise<void> {
    await this.storage.updateParallelToolCall(id, {
      status,
      ...updates,
      updatedAt: new Date(),
    });
  }

  /**
   * Get the status of a specific parallel tool call
   */
  async getToolCallStatus(toolId: string, stepId: number): Promise<ParallelToolCall | null> {
    const toolCalls = await this.storage.listParallelToolCalls(stepId);
    return toolCalls.find((tc) => tc.toolId === toolId) || null;
  }

  /**
   * Get all tool calls for a step with their current status
   */
  async getStepToolCalls(stepId: number): Promise<ParallelToolCall[]> {
    return await this.storage.listParallelToolCalls(stepId);
  }

  /**
   * Cancel all pending/running tools for a step
   */
  async cancelStepToolCalls(stepId: number): Promise<void> {
    const toolCalls = await this.storage.listParallelToolCalls(stepId);

    for (const toolCall of toolCalls) {
      if (toolCall.status === 'pending' || toolCall.status === 'running') {
        await this.updateToolCallStatus(toolCall.id, 'failed', {
          errorMessage: 'Cancelled by user',
          completedAt: new Date(),
        });

        this.emitEvent('tool:parallel:cancelled', {
          toolId: toolCall.toolId,
          toolName: toolCall.toolName,
          stepId,
        });
      }
    }
  }

  /**
   * Emit event through event emitter
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
      // Silently ignore event emission errors
      console.error('Error emitting event:', error);
    }
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
