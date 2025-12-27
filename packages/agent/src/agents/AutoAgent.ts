/**
 * @file AutoAgent.ts
 * @input Depends on SessionManager, StepExecutor, PromptBuilder, ResponseParser, ToolRegistry, AgentFork, StopController
 * @output Exports AutoAgent class, AutoAgentOptions, LLMCaller, KnowledgeBase interfaces
 * @position Core agent mode - fully autonomous execution. Consumed by WukongAgent when mode='auto'.
 *
 * SYNC: When modified, update this header and /packages/agent/src/README.md
 *
 * Auto Agent
 *
 * An autonomous agent that runs continuously until completion without user interaction.
 * This is designed for long-running tasks that don't require user confirmation.
 *
 * Key features:
 * - Runs autonomously without user input
 * - First step always searches knowledge base
 * - Respects maxSteps limit
 * - Handles timeout gracefully
 * - Can be stopped manually
 * - Full event transparency
 */

import type { EventEmitter } from 'eventemitter3';
import { StopController } from '../controller/StopController.js';
import { StepExecutor } from '../executor/StepExecutor.js';
import { AgentFork } from '../fork/AgentFork.js';
import { PromptBuilder, type PromptContext } from '../prompt/PromptBuilder.js';
import { ResponseParser } from '../prompt/ResponseParser.js';
import { SessionManager } from '../session/SessionManager.js';
import { ToolExecutor } from '../tools/ToolExecutor.js';
import { ToolRegistry } from '../tools/ToolRegistry.js';
import type { StorageAdapter } from '../types/adapters.js';
import type { Session, Step, TaskOptions, TaskResult, Tool } from '../types/index.js';

/**
 * LLM Caller interface
 */
export interface LLMCaller {
  call(prompt: string): Promise<string>;
  callWithStreaming?(
    prompt: string,
    options: {
      onChunk?: (chunk: string) => void;
      onComplete?: (fullText: string) => void;
      onError?: (error: Error) => void;
    },
  ): Promise<any>;
}

/**
 * Knowledge base interface
 */
export interface KnowledgeBase {
  search(query: string, options?: any): Promise<any[]>;
}

/**
 * Options for AutoAgent
 */
export interface AutoAgentOptions {
  /** Storage adapter */
  storageAdapter: StorageAdapter;

  /** LLM caller */
  llmCaller: LLMCaller;

  /** Event emitter */
  eventEmitter: EventEmitter;

  /** Available tools */
  tools: Tool[];

  /** API keys for tools */
  apiKeys?: Record<string, string>;

  /** Files adapter */
  filesAdapter?: any;

  /** Knowledge base (optional) */
  knowledgeBase?: KnowledgeBase;

  /** Enable Tool Executor mode */
  enableToolExecutor?: boolean;

  /** Company name */
  companyName?: string;

  /** Maximum steps per session */
  maxSteps?: number;

  /** Timeout in seconds */
  timeoutSeconds?: number;
}

/**
 * Auto Agent Implementation
 *
 * Executes tasks autonomously without user confirmation.
 */
export class AutoAgent {
  private storageAdapter: StorageAdapter;
  private llmCaller: LLMCaller;
  private eventEmitter: EventEmitter;
  private tools: Tool[];
  private apiKeys: Record<string, string>;
  private filesAdapter?: any;
  private knowledgeBase?: KnowledgeBase;
  private enableToolExecutor: boolean;
  private companyName?: string;
  private maxSteps: number;
  private timeoutSeconds: number;

  private sessionManager: SessionManager;
  private stepExecutor: StepExecutor;
  private promptBuilder: PromptBuilder;
  private responseParser: ResponseParser;
  private stopController: StopController;
  private agentFork: AgentFork;

  constructor(options: AutoAgentOptions) {
    this.storageAdapter = options.storageAdapter;
    this.llmCaller = options.llmCaller;
    this.eventEmitter = options.eventEmitter;
    this.tools = options.tools;
    this.apiKeys = options.apiKeys || {};
    this.filesAdapter = options.filesAdapter;
    this.knowledgeBase = options.knowledgeBase;
    this.enableToolExecutor = options.enableToolExecutor ?? true;
    this.companyName = options.companyName;
    this.maxSteps = options.maxSteps ?? 100;
    this.timeoutSeconds = options.timeoutSeconds ?? 3600;

    // Initialize components
    this.sessionManager = new SessionManager(this.storageAdapter);
    this.agentFork = new AgentFork(
      this.storageAdapter,
      this.llmCaller,
      this.eventEmitter,
      this.tools,
      this.apiKeys,
      undefined, // executionAdapter - can be injected later
      this.filesAdapter,
      this.knowledgeBase,
      this.enableToolExecutor,
      this.companyName,
    );

    // Create tool registry and executor for schema validation
    const toolRegistry = new ToolRegistry({ path: '', autoDiscover: false });
    for (const tool of this.tools) {
      toolRegistry.register(tool);
    }

    const toolExecutor = this.enableToolExecutor
      ? new ToolExecutor({
          registry: toolRegistry,
          enableToolExecutor: this.enableToolExecutor,
        })
      : undefined;

    this.stepExecutor = new StepExecutor({
      storageAdapter: this.storageAdapter,
      eventEmitter: this.eventEmitter,
      apiKeys: this.apiKeys,
      filesAdapter: this.filesAdapter,
      agentFork: this.agentFork,
      toolExecutor,
      toolRegistry: {
        getTool: (name: string) => this.tools.find((t) => t.metadata.name === name) || null,
        listTools: () => this.tools,
      },
    });
    this.promptBuilder = new PromptBuilder({
      enableToolExecutor: this.enableToolExecutor,
      companyName: this.companyName,
    });
    this.responseParser = new ResponseParser();
    this.stopController = new StopController();
  }

  /**
   * Execute a task in autonomous mode
   */
  async execute(options: TaskOptions): Promise<TaskResult> {
    const startTime = Date.now();

    try {
      // Create or resume session
      const session = await this.sessionManager.createSession({
        sessionId: options.sessionId,
        goal: options.goal,
        agentType: 'AutoAgent',
        autoRun: true,
        userId: options.context?.['userId'] as string | undefined,
        organizationId: options.context?.['organizationId'] as string | undefined,
      });

      // Reset stop controller
      this.stopController.reset();
      this.stopController.updateState(session.id, 0, 0);

      // Update session to running
      await this.storageAdapter.updateSession(session.id, {
        status: 'active',
        isRunning: true,
      });

      // Emit session created event
      this.eventEmitter.emit('session:created', {
        event: 'session:created',
        session,
      });

      // First step: Search knowledge base if available
      let knowledgeResults: any[] = [];
      if (this.knowledgeBase && options.goal) {
        try {
          this.eventEmitter.emit('knowledge:searching', {
            event: 'knowledge:searching',
            sessionId: session.id,
            query: options.goal,
          });

          knowledgeResults = await this.knowledgeBase.search(options.goal, {
            topK: 5,
            filters: {
              userId: options.context?.['userId'],
              organizationId: options.context?.['organizationId'],
            },
          });

          this.eventEmitter.emit('knowledge:found', {
            event: 'knowledge:found',
            sessionId: session.id,
            results: knowledgeResults,
            count: knowledgeResults.length,
          });
        } catch (error) {
          // Knowledge search failed, continue without it
          this.eventEmitter.emit('knowledge:error', {
            event: 'knowledge:error',
            sessionId: session.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      // Main execution loop
      let currentStep = 0;
      let isComplete = false;
      let finalResult: any = null;
      const timeoutMs = (options.timeout ?? this.timeoutSeconds) * 1000;

      while (!isComplete && currentStep < (options.maxSteps ?? this.maxSteps)) {
        // Check timeout
        if (Date.now() - startTime > timeoutMs) {
          await this.handleTimeout(session, currentStep);
          return this.buildTaskResult(session, 'timeout', currentStep, startTime);
        }

        // Check stop signal
        if (this.stopController.shouldStop()) {
          await this.handleStop(session, currentStep);
          return this.buildTaskResult(session, 'stopped', currentStep, startTime);
        }

        try {
          // Execute one step
          const stepResult = await this.executeStep(session, currentStep, knowledgeResults);

          currentStep++;
          this.stopController.updateState(
            session.id,
            currentStep,
            stepResult.step.id,
            stepResult.result,
          );

          // Check if task is complete
          if (stepResult.step.action === 'Finish') {
            isComplete = true;
            finalResult = stepResult.result;
          }

          // If graceful stop was requested, confirm it can stop now
          if (this.stopController.hasStopRequest()) {
            this.stopController.confirmStop();
          }

          // Emit progress update
          this.eventEmitter.emit('progress:updated', {
            event: 'progress:updated',
            sessionId: session.id,
            percentage: Math.min((currentStep / (options.maxSteps ?? this.maxSteps)) * 100, 99),
            currentStep,
            totalSteps: options.maxSteps ?? this.maxSteps,
          });

          // Clear knowledge results after first step
          if (currentStep === 1) {
            knowledgeResults = [];
          }
        } catch (error) {
          // Step execution failed
          await this.handleStepError(session, currentStep, error);
          return this.buildTaskResult(session, 'failed', currentStep, startTime, error);
        }
      }

      // Check if we hit max steps without completing
      if (!isComplete && currentStep >= (options.maxSteps ?? this.maxSteps)) {
        await this.storageAdapter.updateSession(session.id, {
          status: 'failed',
          isRunning: false,
        });

        this.eventEmitter.emit('task:maxStepsReached', {
          event: 'task:maxStepsReached',
          sessionId: session.id,
          stepsExecuted: currentStep,
        });

        return this.buildTaskResult(
          session,
          'failed',
          currentStep,
          startTime,
          new Error('Max steps reached'),
        );
      }

      // Task completed successfully
      await this.storageAdapter.updateSession(session.id, {
        status: 'completed',
        isRunning: false,
      });

      this.eventEmitter.emit('task:completed', {
        event: 'task:completed',
        sessionId: session.id,
        result: {
          sessionId: session.id,
          status: 'completed',
          result: finalResult,
          stepsExecuted: currentStep,
          tokensUsed: 0, // TODO: Track tokens
          durationSeconds: (Date.now() - startTime) / 1000,
          canResume: false,
        },
      });

      return this.buildTaskResult(session, 'completed', currentStep, startTime, null, finalResult);
    } catch (error) {
      // Fatal error during execution
      return {
        sessionId: '',
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
        stepsExecuted: 0,
        tokensUsed: 0,
        durationSeconds: (Date.now() - startTime) / 1000,
        canResume: false,
      };
    }
  }

  /**
   * Execute a single step
   */
  private async executeStep(
    session: Session,
    stepNumber: number,
    knowledgeResults: any[],
  ): Promise<{
    success: boolean;
    step: Step;
    result?: any;
    error?: string;
    shouldContinue: boolean;
  }> {
    // Load history
    const history = await this.storageAdapter.listSteps(session.id);

    // Build prompt with knowledge results on first step
    const promptContext: PromptContext = {
      goal: session.goal,
      agentType: 'AutoAgent',
      companyName: this.companyName,
      tools: this.tools,
      history,
      enableToolExecutor: this.enableToolExecutor,
      autoRun: true,
      knowledge: stepNumber === 0 && knowledgeResults.length > 0 ? knowledgeResults : undefined,
    };

    const prompt = this.promptBuilder.build(promptContext);

    // Emit LLM started event
    this.eventEmitter.emit('llm:started', {
      event: 'llm:started',
      sessionId: session.id,
      stepId: stepNumber,
      model: 'unknown', // TODO: Get from LLM caller
      promptTokens: 0, // TODO: Count tokens
    });

    // Call LLM with streaming
    let llmResponseText = '';
    let llmResponse: any;

    // Try to use streaming if available
    if (this.llmCaller.callWithStreaming) {
      llmResponse = await this.llmCaller.callWithStreaming(prompt, {
        onChunk: (chunk: string) => {
          // Emit streaming event
          this.eventEmitter.emit('llm:streaming', {
            event: 'llm:streaming',
            sessionId: session.id,
            stepId: stepNumber,
            chunk: {
              text: chunk,
              index: 0,
              isFinal: false,
            },
          });
        },
        onComplete: (fullText: string) => {
          llmResponseText = fullText;
        },
        onError: (error: Error) => {
          this.eventEmitter.emit('llm:error', {
            event: 'llm:error',
            sessionId: session.id,
            stepId: stepNumber,
            error: error.message,
            model: 'unknown',
          });
        },
      });
      llmResponseText = llmResponse.text || llmResponseText;
    } else {
      // Fallback to regular call
      llmResponseText = await this.llmCaller.call(prompt);
      llmResponse = { text: llmResponseText };
    }

    // Emit LLM complete event
    this.eventEmitter.emit('llm:complete', {
      event: 'llm:complete',
      sessionId: session.id,
      stepId: stepNumber,
      response: {
        text: llmResponseText,
        tokensUsed: {
          prompt: llmResponse.tokensUsed?.prompt || 0,
          completion: llmResponse.tokensUsed?.completion || 0,
          total: llmResponse.tokensUsed?.total || 0,
        },
        model: llmResponse.model || 'unknown',
        responseTimeMs: llmResponse.responseTimeMs || 0,
      },
    });

    // Parse response
    const parsedAction = this.responseParser.parse(llmResponseText);

    // Handle discardable steps if specified
    if (parsedAction.discardableSteps && parsedAction.discardableSteps.length > 0) {
      await this.sessionManager.markStepsAsDiscarded(session.id, parsedAction.discardableSteps);

      this.eventEmitter.emit('steps:discarded', {
        event: 'steps:discarded',
        sessionId: session.id,
        stepIds: parsedAction.discardableSteps,
      });
    }

    // Execute the action (StepExecutor will create and manage the step)
    const executionResult = await this.stepExecutor.execute(
      session,
      parsedAction,
      prompt,
      llmResponseText,
    );

    return executionResult;
  }

  /**
   * Handle timeout
   */
  private async handleTimeout(session: Session, stepsCompleted: number): Promise<void> {
    await this.storageAdapter.updateSession(session.id, {
      status: 'failed',
      isRunning: false,
    });

    this.eventEmitter.emit('task:timeout', {
      event: 'task:timeout',
      sessionId: session.id,
      stepsCompleted,
      partialResult: undefined,
    });
  }

  /**
   * Handle graceful stop
   */
  private async handleStop(session: Session, _stepsCompleted: number): Promise<void> {
    await this.storageAdapter.updateSession(session.id, {
      status: 'paused',
      isRunning: false,
    });

    const stopState = this.stopController.getStopState();
    this.eventEmitter.emit('task:stopped', {
      event: 'task:stopped',
      sessionId: session.id,
      state: stopState,
    });
  }

  /**
   * Handle step execution error
   */
  private async handleStepError(
    session: Session,
    _stepNumber: number,
    error: unknown,
  ): Promise<void> {
    await this.storageAdapter.updateSession(session.id, {
      status: 'failed',
      isRunning: false,
    });

    this.eventEmitter.emit('task:failed', {
      event: 'task:failed',
      sessionId: session.id,
      error: error instanceof Error ? error.message : String(error),
      partialResult: undefined,
    });
  }

  /**
   * Build task result
   */
  private buildTaskResult(
    session: Session,
    status: 'completed' | 'failed' | 'stopped' | 'timeout',
    stepsExecuted: number,
    startTime: number,
    error?: unknown,
    result?: any,
  ): TaskResult {
    return {
      sessionId: session.id,
      status,
      result,
      error: error instanceof Error ? error.message : error ? String(error) : undefined,
      stepsExecuted,
      tokensUsed: 0, // TODO: Track tokens
      durationSeconds: (Date.now() - startTime) / 1000,
      canResume: status === 'stopped' || status === 'timeout',
    };
  }

  /**
   * Resume a paused session
   */
  async resume(sessionId: string): Promise<TaskResult> {
    const session = await this.storageAdapter.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    if (session.status !== 'paused') {
      throw new Error(`Session ${sessionId} is not paused (status: ${session.status})`);
    }

    // Resume execution
    // TODO: Continue from last step instead of restarting
    return this.execute({
      goal: session.goal,
      mode: 'auto',
    });
  }

  /**
   * Request stop
   */
  requestStop(graceful = true): void {
    this.stopController.requestStop({ graceful, saveState: true });

    const stopState = this.stopController.getStopState();
    this.eventEmitter.emit('task:stopping', {
      event: 'task:stopping',
      sessionId: stopState?.sessionId || '',
      graceful,
    });
  }
}
