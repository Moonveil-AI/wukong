/**
 * Step Executor
 *
 * Executes individual steps including tool calls and LLM interactions.
 */

import type { EventEmitter } from 'eventemitter3';
import type { AgentFork } from '../fork/AgentFork.js';
import type { ToolExecutor } from '../tools/ToolExecutor.js';
import type { StorageAdapter } from '../types/adapters.js';
import type {
  AgentAction,
  AskUserAction,
  CallToolAction,
  CallToolsParallelAction,
  FinishAction,
  ForkAutoAgentAction,
  PlanAction,
  Session,
  Step,
  Tool,
  ToolContext,
  ToolResult,
  WaitStrategy,
} from '../types/index.js';

/**
 * Tool registry interface for tool management
 */
export interface ToolRegistry {
  getTool(name: string): Tool | null;
  listTools(): Tool[];
}

/**
 * Options for StepExecutor
 */
export interface StepExecutorOptions {
  /** Storage adapter for persisting steps */
  storageAdapter: StorageAdapter;

  /** Tool registry for tool lookup */
  toolRegistry?: ToolRegistry;

  /** Tool executor for validated tool execution (optional, enables schema validation) */
  toolExecutor?: ToolExecutor;

  /** Event emitter for step events */
  eventEmitter?: EventEmitter;

  /** API keys for tools */
  apiKeys?: Record<string, string>;

  /** Files adapter for file operations */
  filesAdapter?: any;

  /** Agent fork manager for sub-agent execution */
  agentFork?: AgentFork;
}

/**
 * Result of step execution
 */
export interface StepExecutionResult {
  /** Whether the step executed successfully */
  success: boolean;

  /** Step data after execution */
  step: Step;

  /** Result data */
  result?: any;

  /** Error message if failed */
  error?: string;

  /** Whether execution should continue */
  shouldContinue: boolean;

  /** Whether to wait for user input (AskUser action) */
  waitForUser?: boolean;

  /** For async operations: task IDs to track */
  taskIds?: string[];
}

/**
 * Executes individual agent steps
 */
export class StepExecutor {
  private storageAdapter: StorageAdapter;
  private toolRegistry?: ToolRegistry;
  private toolExecutor?: ToolExecutor;
  private eventEmitter?: EventEmitter;
  private apiKeys: Record<string, string>;
  private filesAdapter?: any;
  private agentFork?: AgentFork;

  constructor(options: StepExecutorOptions) {
    this.storageAdapter = options.storageAdapter;
    this.toolRegistry = options.toolRegistry;
    this.toolExecutor = options.toolExecutor;
    this.eventEmitter = options.eventEmitter;
    this.apiKeys = options.apiKeys || {};
    this.filesAdapter = options.filesAdapter;
    this.agentFork = options.agentFork;
  }

  /**
   * Execute a step based on the parsed agent action
   *
   * @param session - The current session
   * @param action - The parsed agent action
   * @param llmPrompt - The LLM prompt that was sent
   * @param llmResponse - The raw LLM response
   * @returns Step execution result
   */
  async execute(
    session: Session,
    action: AgentAction,
    llmPrompt?: string,
    llmResponse?: string,
  ): Promise<StepExecutionResult> {
    // Create initial step record
    const step = await this.createStep(session, action, llmPrompt, llmResponse);

    try {
      // Emit step started event
      this.eventEmitter?.emit('step:started', { step });

      // Update step status to running
      await this.storageAdapter.updateStep(step.id, {
        status: 'running',
        startedAt: new Date(),
      });

      // Execute based on action type
      let result: StepExecutionResult;

      switch (action.action) {
        case 'CallTool':
          result = await this.executeCallTool(step, action);
          break;
        case 'CallToolsParallel':
          result = await this.executeCallToolsParallel(step, action);
          break;
        case 'ForkAutoAgent':
          result = await this.executeForkAutoAgent(step, action);
          break;
        case 'AskUser':
          result = this.executeAskUser(step, action);
          break;
        case 'Plan':
          result = this.executePlan(step, action);
          break;
        case 'Finish':
          result = await this.executeFinish(step, action);
          break;
        default:
          throw new Error(`Unknown action type: ${(action as any).action}`);
      }

      // Update step with completion data
      const completedAt = new Date();
      const startedAt = step.startedAt || new Date();
      const executionDurationMs = completedAt.getTime() - startedAt.getTime();

      const updatedStep = await this.storageAdapter.updateStep(step.id, {
        status: result.success ? 'completed' : 'failed',
        stepResult: result.result ? JSON.stringify(result.result) : undefined,
        errorMessage: result.error,
        completedAt,
        executionDurationMs,
      });

      result.step = updatedStep;

      // Emit step completed event
      this.eventEmitter?.emit('step:completed', { step: updatedStep });

      // Handle discardable steps if specified
      if (action.discardableSteps && action.discardableSteps.length > 0) {
        await this.storageAdapter.markStepsAsDiscarded(session.id, action.discardableSteps);
      }

      return result;
    } catch (error) {
      // Update step with error
      const errorMessage = error instanceof Error ? error.message : String(error);
      const updatedStep = await this.storageAdapter.updateStep(step.id, {
        status: 'failed',
        errorMessage,
        completedAt: new Date(),
        executionDurationMs: Date.now() - (step.startedAt?.getTime() || Date.now()),
      });

      // Emit step failed event
      this.eventEmitter?.emit('step:failed', { step: updatedStep, error: errorMessage });

      return {
        success: false,
        step: updatedStep,
        error: errorMessage,
        shouldContinue: false,
      };
    }
  }

  /**
   * Create initial step record
   */
  private async createStep(
    session: Session,
    action: AgentAction,
    llmPrompt?: string,
    llmResponse?: string,
  ): Promise<Step> {
    // Get current step count
    const existingSteps = await this.storageAdapter.listSteps(session.id, {
      includeDiscarded: false,
    });
    const stepNumber = existingSteps.length + 1;

    // Create step
    return await this.storageAdapter.createStep({
      sessionId: session.id,
      stepNumber,
      llmPrompt,
      llmResponse,
      action: action.action,
      reasoning: action.reasoning,
      selectedTool: action.action === 'CallTool' ? action.selectedTool : undefined,
      parameters:
        action.action === 'CallTool' ||
        action.action === 'CallToolsParallel' ||
        action.action === 'ForkAutoAgent'
          ? (action as any).parameters || {}
          : undefined,
      status: 'pending',
      discarded: false,
      isParallel: action.action === 'CallToolsParallel',
      waitStrategy: action.action === 'CallToolsParallel' ? action.waitStrategy : undefined,
    });
  }

  /**
   * Execute CallTool action
   */
  private async executeCallTool(step: Step, action: CallToolAction): Promise<StepExecutionResult> {
    const { selectedTool, parameters } = action;

    // Create tool context
    const context: ToolContext = {
      sessionId: step.sessionId,
      stepId: step.id,
      apiKeys: this.apiKeys,
      filesAdapter: this.filesAdapter,
    };

    let toolResult: ToolResult;

    // Use ToolExecutor if available (provides schema validation and error handling)
    if (this.toolExecutor) {
      toolResult = await this.toolExecutor.execute({
        tool: selectedTool,
        params: parameters,
        context,
      });
    } else {
      // Fallback to direct tool execution (legacy behavior)
      if (!this.toolRegistry) {
        throw new Error('Tool registry not configured');
      }

      const tool = this.toolRegistry.getTool(selectedTool);
      if (!tool) {
        throw new Error(`Tool not found: ${selectedTool}`);
      }

      toolResult = await tool.handler(parameters, context);
    }

    // Check if async tool
    if (toolResult.taskId) {
      // Async tool - will complete later
      return {
        success: true,
        step,
        result: {
          taskId: toolResult.taskId,
          summary: toolResult.summary || 'Async task submitted',
        },
        shouldContinue: true,
        taskIds: [toolResult.taskId],
      };
    }

    // Sync tool - completed immediately
    return {
      success: toolResult.success,
      step,
      result: toolResult.summary || toolResult.result,
      error: toolResult.error,
      shouldContinue: toolResult.success,
    };
  }

  /**
   * Execute CallToolsParallel action
   */
  private async executeCallToolsParallel(
    step: Step,
    action: CallToolsParallelAction,
  ): Promise<StepExecutionResult> {
    const { parallelTools, waitStrategy } = action;

    // Check that we have either toolExecutor or toolRegistry
    if (!(this.toolExecutor || this.toolRegistry)) {
      throw new Error('Tool executor or tool registry not configured');
    }

    // Store parallel tool calls in database
    const parallelToolCalls = await Promise.all(
      parallelTools.map(async (toolCall) => {
        return await this.storageAdapter.createParallelToolCall({
          stepId: step.id,
          toolId: toolCall.toolId,
          toolName: toolCall.toolName,
          parameters: toolCall.parameters,
          status: 'pending',
          progressPercentage: 0,
          retryCount: 0,
          maxRetries: 3,
        });
      }),
    );

    // Execute tools in parallel
    const toolPromises = parallelTools.map(async (toolCall) => {
      const context: ToolContext = {
        sessionId: step.sessionId,
        stepId: step.id,
        apiKeys: this.apiKeys,
        filesAdapter: this.filesAdapter,
      };

      try {
        let result: ToolResult;

        // Use ToolExecutor if available (provides schema validation and error handling)
        if (this.toolExecutor) {
          result = await this.toolExecutor.execute({
            tool: toolCall.toolName,
            params: toolCall.parameters,
            context,
          });
        } else {
          // Fallback to direct tool execution (legacy behavior)
          const tool = this.toolRegistry?.getTool(toolCall.toolName);
          if (!tool) {
            return {
              toolId: toolCall.toolId,
              success: false,
              error: `Tool not found: ${toolCall.toolName}`,
            };
          }
          result = await tool.handler(toolCall.parameters, context);
        }

        // Update parallel tool call status
        const dbToolCall = parallelToolCalls.find((tc) => tc.toolId === toolCall.toolId);
        if (dbToolCall) {
          await this.storageAdapter.updateParallelToolCall(dbToolCall.id, {
            status: result.success ? 'completed' : 'failed',
            result: result.result,
            errorMessage: result.error,
            completedAt: new Date(),
          });
        }

        return {
          toolId: toolCall.toolId,
          toolName: toolCall.toolName,
          success: result.success,
          result: result.summary || result.result,
          error: result.error,
          taskId: result.taskId,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        // Update parallel tool call status
        const dbToolCall = parallelToolCalls.find((tc) => tc.toolId === toolCall.toolId);
        if (dbToolCall) {
          await this.storageAdapter.updateParallelToolCall(dbToolCall.id, {
            status: 'failed',
            errorMessage,
            completedAt: new Date(),
          });
        }

        return {
          toolId: toolCall.toolId,
          toolName: toolCall.toolName,
          success: false,
          error: errorMessage,
        };
      }
    });

    // Wait for tools based on strategy
    const results = await this.waitForParallelTools(toolPromises, waitStrategy);

    // Check if wait strategy is satisfied
    const successCount = results.filter((r) => r.success).length;
    const totalCount = results.length;
    const isSatisfied = this.checkWaitStrategy(successCount, totalCount, waitStrategy);

    // Collect task IDs for async tools
    const taskIds = results.map((r) => r.taskId).filter((id): id is string => id !== undefined);

    return {
      success: isSatisfied,
      step,
      result: {
        results,
        successCount,
        totalCount,
        waitStrategy,
        satisfied: isSatisfied,
      },
      shouldContinue: isSatisfied,
      taskIds: taskIds.length > 0 ? taskIds : undefined,
    };
  }

  /**
   * Wait for parallel tools based on strategy
   */
  private async waitForParallelTools(
    promises: Promise<any>[],
    strategy: WaitStrategy,
  ): Promise<any[]> {
    if (strategy === 'all') {
      // Wait for all tools to complete
      return await Promise.all(promises);
    }

    if (strategy === 'any') {
      // Wait for any tool to complete successfully
      const results = await Promise.allSettled(promises);
      return results.map((r) =>
        r.status === 'fulfilled' ? r.value : { success: false, error: r.reason },
      );
    }

    if (strategy === 'majority') {
      // Wait for majority to complete
      const results = await Promise.allSettled(promises);
      return results.map((r) =>
        r.status === 'fulfilled' ? r.value : { success: false, error: r.reason },
      );
    }

    return await Promise.all(promises);
  }

  /**
   * Check if wait strategy is satisfied
   */
  private checkWaitStrategy(
    successCount: number,
    totalCount: number,
    strategy: WaitStrategy,
  ): boolean {
    switch (strategy) {
      case 'all':
        return successCount === totalCount;
      case 'any':
        return successCount >= 1;
      case 'majority':
        return successCount > totalCount / 2;
      default:
        return false;
    }
  }

  /**
   * Execute ForkAutoAgent action
   */
  private async executeForkAutoAgent(
    step: Step,
    action: ForkAutoAgentAction,
  ): Promise<StepExecutionResult> {
    const { subGoal, contextSummary, maxDepth, maxSteps, timeout } = action;

    // Get current session
    const currentSession = await this.storageAdapter.getSession(step.sessionId);
    if (!currentSession) {
      throw new Error('Session not found');
    }

    // Use AgentFork if available, otherwise use legacy implementation
    if (this.agentFork) {
      try {
        const taskId = await this.agentFork.forkAutoAgent({
          goal: subGoal,
          contextSummary,
          maxDepth,
          maxSteps,
          timeoutSeconds: timeout,
          parentSessionId: currentSession.id,
          parentStepId: step.id,
          currentDepth: currentSession.depth,
          userId: currentSession.userId,
          organizationId: currentSession.organizationId,
        });

        return {
          success: true,
          step,
          result: {
            taskId,
            subGoal,
            status: 'pending',
            message: 'Sub-agent forked and will execute asynchronously',
          },
          shouldContinue: true,
          taskIds: [taskId],
        };
      } catch (error) {
        throw new Error(
          `Failed to fork sub-agent: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    // Legacy implementation (for backward compatibility)
    // Check depth limit
    const newDepth = currentSession.depth + 1;
    if (maxDepth && newDepth > maxDepth) {
      throw new Error(`Maximum agent fork depth exceeded: ${maxDepth}`);
    }

    // Create sub-agent session
    const subSession = await this.storageAdapter.createSession({
      goal: subGoal,
      initialGoal: subGoal,
      status: 'active',
      userId: currentSession.userId,
      apiKey: currentSession.apiKey,
      organizationId: currentSession.organizationId,
      agentType: 'AutoAgent',
      autoRun: true,
      parentSessionId: currentSession.id,
      depth: newDepth,
      inheritedContext: contextSummary,
      isSubAgent: true,
      lastCompressedStepId: 0,
      isCompressing: false,
      isRunning: false,
      isDeleted: false,
    });

    // Store fork task in database
    await this.storageAdapter.createForkAgentTask({
      parentSessionId: currentSession.id,
      parentStepId: step.id,
      subSessionId: subSession.id,
      goal: subGoal,
      contextSummary,
      depth: newDepth,
      maxSteps: maxSteps || 20,
      timeoutSeconds: timeout || 300,
      status: 'pending',
      stepsExecuted: 0,
      tokensUsed: 0,
      toolsCalled: 0,
      retryCount: 0,
      maxRetries: 3,
    });

    // Emit fork event
    this.eventEmitter?.emit('agent:forked', {
      parentSessionId: currentSession.id,
      subSessionId: subSession.id,
      subGoal,
    });

    return {
      success: true,
      step,
      result: {
        subSessionId: subSession.id,
        subGoal,
        status: 'pending',
        message: 'Sub-agent created and will execute asynchronously',
      },
      shouldContinue: true,
    };
  }

  /**
   * Execute AskUser action
   */
  private executeAskUser(step: Step, action: AskUserAction): StepExecutionResult {
    const { question, options } = action;

    // Emit ask user event
    this.eventEmitter?.emit('user:questionAsked', {
      step,
      question,
      options,
    });

    return {
      success: true,
      step,
      result: {
        question,
        options,
        status: 'waiting_for_user',
      },
      shouldContinue: false,
      waitForUser: true,
    };
  }

  /**
   * Execute Plan action
   */
  private executePlan(step: Step, action: PlanAction): StepExecutionResult {
    const { plan } = action;

    // Emit plan ready event
    this.eventEmitter?.emit('plan:ready', {
      step,
      plan,
    });

    return {
      success: true,
      step,
      result: {
        plan,
        status: 'plan_created',
      },
      shouldContinue: true,
    };
  }

  /**
   * Execute Finish action
   */
  private async executeFinish(step: Step, action: FinishAction): Promise<StepExecutionResult> {
    const { finalResult, summary } = action;

    // Update session status to completed
    await this.storageAdapter.updateSession(step.sessionId, {
      status: 'completed',
      resultSummary: summary,
    });

    // Emit session completed event
    this.eventEmitter?.emit('session:completed', {
      sessionId: step.sessionId,
      result: finalResult,
      summary,
    });

    return {
      success: true,
      step,
      result: {
        finalResult,
        summary,
        status: 'finished',
      },
      shouldContinue: false,
    };
  }
}
