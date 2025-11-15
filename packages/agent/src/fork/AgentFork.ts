/**
 * Agent Fork System
 *
 * Allows agents to spawn sub-agents for complex sub-tasks, enabling
 * parallel processing and task decomposition.
 *
 * Key features:
 * - Depth tracking to prevent infinite recursion
 * - Context compression for efficient sub-agent creation
 * - Result summarization for parent agent consumption
 * - Event emission for progress tracking
 * - Timeout and step limits for sub-agents
 */

import type { EventEmitter } from 'eventemitter3';
import type { LLMCaller } from '../agents/AutoAgent.js';
import type { KnowledgeBase } from '../agents/AutoAgent.js';
import type {
  ForkAgentTask,
  ForkAgentTaskStatus,
  Session,
  StorageAdapter,
  SubAgentError,
  SubAgentInfo,
  SubAgentResult,
  Tool,
} from '../types/index.js';
import type { ExecutionAdapter } from './ExecutionAdapter.js';

/**
 * Options for forking a sub-agent
 */
export interface ForkAgentOptions {
  /** Goal for the sub-agent */
  goal: string;

  /** Context summary to pass to sub-agent */
  contextSummary?: string;

  /** Maximum depth (prevent infinite recursion) */
  maxDepth?: number;

  /** Maximum steps for sub-agent */
  maxSteps?: number;

  /** Timeout in seconds */
  timeoutSeconds?: number;

  /** Parent session ID */
  parentSessionId: string;

  /** Parent step ID (optional) */
  parentStepId?: number;

  /** Current depth */
  currentDepth: number;

  /** User ID */
  userId?: string;

  /** Organization ID */
  organizationId?: string;
}

/**
 * Context compression options
 */
export interface CompressionOptions {
  /** Maximum length of compressed context */
  maxLength?: number;

  /** Whether to preserve key facts */
  preserveKeyFacts?: boolean;

  /** Whether to preserve constraints */
  preserveConstraints?: boolean;
}

/**
 * Agent Fork Manager
 *
 * Manages the creation and execution of sub-agents
 */
export class AgentFork {
  /** Maximum fork depth allowed */
  private static readonly MAX_FORK_DEPTH = 3;

  /** Default timeout for sub-agents (5 minutes) */
  private static readonly DEFAULT_TIMEOUT_SECONDS = 300;

  /** Default max steps for sub-agents */
  private static readonly DEFAULT_MAX_STEPS = 20;

  constructor(
    private storageAdapter: StorageAdapter,
    private llmCaller: LLMCaller,
    private eventEmitter: EventEmitter,
    private tools: Tool[],
    private apiKeys: Record<string, string>,
    private executionAdapter?: ExecutionAdapter,
    private filesAdapter?: any,
    private knowledgeBase?: KnowledgeBase,
    private enableToolExecutor?: boolean,
    private companyName?: string,
  ) {
    // If no execution adapter provided, create a default Promise-based one
    if (!this.executionAdapter) {
      console.warn(
        '[AgentFork] No ExecutionAdapter provided, using legacy Promise-based execution. ' +
          'For production serverless environments, consider using InngestAdapter.',
      );
    }
  }

  /**
   * Fork a sub-agent for a specific task
   *
   * @param options - Fork options
   * @returns Task ID for tracking the sub-agent
   */
  async forkAutoAgent(options: ForkAgentOptions): Promise<string> {
    const {
      goal,
      contextSummary,
      maxDepth = AgentFork.MAX_FORK_DEPTH,
      maxSteps = AgentFork.DEFAULT_MAX_STEPS,
      timeoutSeconds = AgentFork.DEFAULT_TIMEOUT_SECONDS,
      parentSessionId,
      parentStepId,
      currentDepth,
      userId,
      organizationId,
    } = options;

    // Check depth limit
    if (currentDepth >= maxDepth) {
      throw new Error(
        `Maximum fork depth (${maxDepth}) exceeded. Cannot fork sub-agent at depth ${currentDepth}.`,
      );
    }

    // Create fork task record
    const task = await this.storageAdapter.createForkAgentTask({
      parentSessionId,
      parentStepId,
      goal,
      contextSummary,
      depth: currentDepth + 1,
      maxSteps,
      timeoutSeconds,
      status: 'pending',
      stepsExecuted: 0,
      tokensUsed: 0,
      toolsCalled: 0,
      retryCount: 0,
      maxRetries: 3,
    });

    // Emit subagent:started event
    this.emitSubAgentStarted({
      sessionId: task.id,
      parentSessionId,
      goal,
      depth: task.depth,
      contextSummary: contextSummary || '',
    });

    // Use execution adapter if provided, otherwise fall back to legacy implementation
    if (this.executionAdapter) {
      // Use adapter pattern (recommended for production)
      await this.executionAdapter.executeSubAgent({
        task,
        userId,
        organizationId,
        storageAdapter: this.storageAdapter,
        llmCaller: this.llmCaller,
        tools: this.tools,
        apiKeys: this.apiKeys,
        filesAdapter: this.filesAdapter,
        knowledgeBase: this.knowledgeBase,
        enableToolExecutor: this.enableToolExecutor,
        companyName: this.companyName,
      });
    } else {
      // Legacy Promise-based execution (backward compatibility)
      this.executeSubAgent(task, userId, organizationId).catch((error) => {
        console.error(`Sub-agent ${task.id} failed:`, error);
      });
    }

    return task.id;
  }

  /**
   * Wait for a sub-agent to complete
   *
   * @param taskId - Task ID
   * @returns Sub-agent result
   */
  async waitForSubAgent(taskId: string): Promise<SubAgentResult> {
    // Use execution adapter if provided
    if (this.executionAdapter) {
      const maxPollTime = 600000; // 10 minutes
      const result = await this.executionAdapter.waitForCompletion(taskId, maxPollTime);

      return {
        sessionId: result.sessionId,
        summary: typeof result.result === 'string' ? result.result : JSON.stringify(result.result),
        result: result.result,
        stepsExecuted: result.stepsExecuted,
        tokensUsed: result.tokensUsed,
        durationSeconds: result.durationMs / 1000,
      };
    }

    // Legacy implementation (backward compatibility)
    const pollInterval = 2000; // 2 seconds
    const maxPollTime = 600000; // 10 minutes
    const startTime = Date.now();

    while (Date.now() - startTime < maxPollTime) {
      const task = await this.storageAdapter.getForkAgentTask(taskId);

      if (!task) {
        throw new Error(`Fork task ${taskId} not found`);
      }

      if (task.status === 'completed') {
        return {
          sessionId: task.subSessionId || '',
          summary: task.resultSummary || '',
          result: task.resultSummary,
          stepsExecuted: task.stepsExecuted,
          tokensUsed: task.tokensUsed,
          durationSeconds: task.executionDurationMs ? task.executionDurationMs / 1000 : 0,
        };
      }

      if (task.status === 'failed' || task.status === 'timeout') {
        throw new Error(task.errorMessage || 'Sub-agent execution failed');
      }

      // Wait before next poll
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    throw new Error(`Timeout waiting for sub-agent ${taskId} to complete`);
  }

  /**
   * Wait for multiple sub-agents to complete
   *
   * @param taskIds - Array of task IDs
   * @returns Array of sub-agent results
   */
  async waitForMultipleSubAgents(taskIds: string[]): Promise<SubAgentResult[]> {
    return await Promise.all(taskIds.map((taskId) => this.waitForSubAgent(taskId)));
  }

  /**
   * Compress context for sub-agent
   *
   * @param fullContext - Full context to compress
   * @param options - Compression options
   * @returns Compressed context
   */
  async compressContext(fullContext: string, options: CompressionOptions = {}): Promise<string> {
    const { maxLength = 500, preserveKeyFacts = true, preserveConstraints = true } = options;

    // If context is already short enough, return as-is
    if (fullContext.length <= maxLength) {
      return fullContext;
    }

    // Use LLM to compress context
    const compressionPrompt = `
You are a context compression expert. Your task is to compress the following context into a concise summary.

**Requirements:**
1. Keep the summary under ${maxLength} characters
2. ${preserveKeyFacts ? 'Preserve all key facts and information' : 'Focus on main ideas'}
3. ${preserveConstraints ? 'Preserve all constraints and requirements' : 'Generalize constraints'}
4. Use clear, direct language
5. Remove redundant information

**Context to compress:**
${fullContext}

**Compressed summary (under ${maxLength} characters):**
`.trim();

    try {
      const compressed = await this.llmCaller.call(compressionPrompt);
      return compressed.trim();
    } catch (error) {
      console.error('Failed to compress context:', error);
      // Fallback: simple truncation
      return `${fullContext.substring(0, maxLength)}...`;
    }
  }

  /**
   * Compress sub-agent result for parent
   *
   * @param result - Full sub-agent result
   * @param maxLength - Maximum length of compressed result
   * @returns Compressed result summary
   */
  async compressResult(result: any, maxLength = 500): Promise<string> {
    // Convert result to string if needed
    const resultStr = typeof result === 'string' ? result : JSON.stringify(result, null, 2);

    // If result is already short enough, return as-is
    if (resultStr.length <= maxLength) {
      return resultStr;
    }

    // Use LLM to compress result
    const compressionPrompt = `
You are a result summarization expert. Your task is to summarize the following sub-agent execution result into a concise summary.

**Requirements:**
1. Keep the summary under ${maxLength} characters
2. Focus on key outcomes and findings
3. Include any important data or metrics
4. Mention any errors or issues encountered
5. Use clear, actionable language

**Sub-agent result:**
${resultStr}

**Summary (under ${maxLength} characters):**
`.trim();

    try {
      const compressed = await this.llmCaller.call(compressionPrompt);
      return compressed.trim();
    } catch (error) {
      console.error('Failed to compress result:', error);
      // Fallback: simple truncation
      return `${resultStr.substring(0, maxLength)}...`;
    }
  }

  /**
   * Execute sub-agent (internal method)
   */
  private async executeSubAgent(
    task: ForkAgentTask,
    userId?: string,
    organizationId?: string,
  ): Promise<void> {
    const startTime = Date.now();

    try {
      // Update task status to running
      await this.storageAdapter.updateForkAgentTask(task.id, {
        status: 'running',
        startedAt: new Date(),
      });

      // Dynamically import AutoAgent to avoid circular dependencies
      const { AutoAgent } = await import('../agents/AutoAgent.js');

      // Create sub-agent with compressed context
      const subAgent = new AutoAgent({
        storageAdapter: this.storageAdapter,
        llmCaller: this.llmCaller,
        eventEmitter: this.eventEmitter,
        tools: this.tools,
        apiKeys: this.apiKeys,
        filesAdapter: this.filesAdapter,
        knowledgeBase: this.knowledgeBase,
        enableToolExecutor: this.enableToolExecutor,
        companyName: this.companyName,
        maxSteps: task.maxSteps,
        timeoutSeconds: task.timeoutSeconds,
      });

      // Execute sub-agent with timeout
      const result = await this.executeWithTimeout(
        async () => {
          return await subAgent.execute({
            goal: task.goal,
            context: {
              userId,
              organizationId,
              parentSessionId: task.parentSessionId,
            },
          });
        },
        task.timeoutSeconds * 1000, // Convert to milliseconds
      );

      // Get sub-agent session
      const subSession = await this.storageAdapter.getSession(result.sessionId);

      if (!subSession) {
        throw new Error(`Sub-agent session ${result.sessionId} not found`);
      }

      // Compress result for parent
      const compressedResult = await this.compressResult(result.result);

      // Calculate execution duration
      const executionDurationMs = Date.now() - startTime;

      // Update task with results
      await this.storageAdapter.updateForkAgentTask(task.id, {
        status: 'completed',
        subSessionId: result.sessionId,
        resultSummary: compressedResult,
        stepsExecuted: result.stepsExecuted,
        tokensUsed: result.tokensUsed,
        toolsCalled: this.countToolsCalled(result),
        completedAt: new Date(),
        executionDurationMs,
      });

      // Emit subagent:completed event
      this.emitSubAgentCompleted({
        sessionId: result.sessionId,
        summary: compressedResult,
        result: compressedResult,
        stepsExecuted: result.stepsExecuted,
        tokensUsed: result.tokensUsed,
        durationSeconds: executionDurationMs / 1000,
      });
    } catch (error: any) {
      // Calculate execution duration
      const executionDurationMs = Date.now() - startTime;

      // Determine if it's a timeout error
      const isTimeout = error.message?.includes('timeout') || error.name === 'TimeoutError';
      const status: ForkAgentTaskStatus = isTimeout ? 'timeout' : 'failed';

      // Update task with error
      await this.storageAdapter.updateForkAgentTask(task.id, {
        status,
        errorMessage: error.message || 'Unknown error',
        completedAt: new Date(),
        executionDurationMs,
      });

      // Emit subagent:failed event
      this.emitSubAgentFailed({
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

  /**
   * Count tools called in result
   */
  private countToolsCalled(result: any): number {
    // This is a simple heuristic - in reality we'd track this more precisely
    return result.stepsExecuted || 0;
  }

  /**
   * Emit subagent:started event
   */
  private emitSubAgentStarted(info: SubAgentInfo): void {
    this.eventEmitter.emit('subagent:started', info);
  }

  /**
   * Emit subagent:completed event
   */
  private emitSubAgentCompleted(result: SubAgentResult): void {
    this.eventEmitter.emit('subagent:completed', result);
  }

  /**
   * Emit subagent:failed event
   */
  private emitSubAgentFailed(error: SubAgentError): void {
    this.eventEmitter.emit('subagent:failed', error);
  }

  /**
   * Get sub-agents for a parent session
   *
   * @param parentSessionId - Parent session ID
   * @returns List of sub-agent tasks
   */
  async getSubAgents(parentSessionId: string): Promise<ForkAgentTask[]> {
    return await this.storageAdapter.listForkAgentTasks(parentSessionId);
  }

  /**
   * Get parent session for a sub-agent
   *
   * @param subSessionId - Sub-agent session ID
   * @returns Parent session or null
   */
  async getParentSession(subSessionId: string): Promise<Session | null> {
    const subSession = await this.storageAdapter.getSession(subSessionId);

    if (!subSession?.parentSessionId) {
      return null;
    }

    return await this.storageAdapter.getSession(subSession.parentSessionId);
  }
}
