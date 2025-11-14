/**
 * WukongAgent - Main agent class that ties everything together
 *
 * This is the primary entry point for using the Wukong agent framework.
 * It provides a unified interface for creating and executing agents in both
 * interactive and autonomous modes.
 */

import { WukongEventEmitter } from './EventEmitter';
import type { KnowledgeBase, LLMCaller } from './agents/AutoAgent';
import { MultiModelCaller, type MultiModelCallerConfig } from './llm/MultiModelCaller';
import type { Session, StorageAdapter, TaskOptions, Tool } from './types';
import type { LLMCallResponse } from './types/adapters';

/**
 * LLM caller wrapper to adapt different LLM response formats
 */
class LLMCallerAdapter implements LLMCaller {
  constructor(
    private llm:
      | { call(prompt: string): Promise<string> }
      | { call(prompt: string): Promise<LLMCallResponse> },
  ) {}

  async call(prompt: string): Promise<string> {
    const result = await this.llm.call(prompt);
    if (typeof result === 'string') {
      return result;
    }
    // It's an LLMCallResponse
    return result.text;
  }
}

/**
 * Configuration options for WukongAgent
 */
export interface WukongAgentConfig {
  /**
   * Storage adapter for persisting sessions, steps, and todos
   */
  adapter: StorageAdapter;

  /**
   * LLM caller configuration
   * Can be a single LLM adapter or multi-model config
   */
  llm: LLMCaller | MultiModelCallerConfig | { call(prompt: string): Promise<LLMCallResponse> };

  /**
   * Available tools for the agent
   */
  tools?: Tool[];

  /**
   * Knowledge base for semantic search
   * Optional - if not provided, knowledge base features will be disabled
   */
  knowledgeBase?: KnowledgeBase;

  /**
   * Default agent mode
   * @default 'interactive'
   */
  defaultMode?: 'interactive' | 'auto';

  /**
   * Enable MCP (Model Context Protocol) mode for reduced token usage
   * @default true
   */
  enableMCP?: boolean;

  /**
   * Default maximum number of steps for autonomous execution
   * @default 50
   */
  maxSteps?: number;

  /**
   * Default timeout in seconds for autonomous execution
   * @default 600 (10 minutes)
   */
  timeout?: number;

  /**
   * API keys for tools
   */
  apiKeys?: Record<string, string>;

  /**
   * Files adapter for file operations
   */
  filesAdapter?: any;

  /**
   * Company name for context
   */
  companyName?: string;
}

/**
 * Options for executing a task
 */
export interface ExecuteOptions extends TaskOptions {
  /**
   * Agent mode: 'interactive' requires user confirmation after each step,
   * 'auto' runs autonomously until completion
   */
  mode?: 'interactive' | 'auto';

  /**
   * Session ID to resume an existing session
   * If not provided, a new session will be created
   */
  sessionId?: string;

  /**
   * User ID for the session
   */
  userId?: string;

  /**
   * Organization ID for the session
   */
  organizationId?: string;

  /**
   * Parent session ID (for sub-agents)
   */
  parentSessionId?: string;
}

/**
 * Result of task execution
 */
export interface ExecutionResult {
  /**
   * Session ID
   */
  sessionId: string;

  /**
   * Execution status
   */
  status: 'completed' | 'stopped' | 'error' | 'timeout';

  /**
   * Final output from the agent
   */
  output?: any;

  /**
   * Error if status is 'error'
   */
  error?: Error;

  /**
   * Number of steps executed
   */
  stepCount: number;

  /**
   * Session details
   */
  session: Session;
}

/**
 * Main WukongAgent class
 *
 * @example
 * ```typescript
 * import { WukongAgent } from '@wukong/agent';
 * import { LocalAdapter } from '@wukong/adapter-local';
 * import { ClaudeAdapter } from '@wukong/llm-anthropic';
 *
 * const agent = new WukongAgent({
 *   adapter: new LocalAdapter({ dbPath: './data/wukong.db' }),
 *   llm: new ClaudeAdapter({
 *     apiKey: process.env.ANTHROPIC_API_KEY,
 *     model: 'claude-sonnet-4.5'
 *   })
 * });
 *
 * // Execute a task
 * const result = await agent.execute({
 *   goal: 'Analyze sales data and generate a report',
 *   mode: 'auto'
 * });
 * ```
 */
export class WukongAgent extends WukongEventEmitter {
  private config: WukongAgentConfig;
  private llmCaller: LLMCaller;

  /**
   * Create a new WukongAgent instance
   */
  constructor(config: WukongAgentConfig) {
    super();

    // Validate required config
    if (!config.adapter) {
      throw new Error('StorageAdapter is required');
    }
    if (!config.llm) {
      throw new Error('LLM configuration is required');
    }

    this.config = {
      defaultMode: 'interactive',
      enableMCP: true,
      maxSteps: 50,
      timeout: 600,
      tools: [],
      apiKeys: {},
      ...config,
    };

    // Initialize LLM caller
    if ('call' in config.llm) {
      // It's an LLM adapter - wrap it to ensure string return type
      this.llmCaller = new LLMCallerAdapter(config.llm as any);
    } else {
      // Multi-model config
      const multiModel = new MultiModelCaller(config.llm as MultiModelCallerConfig);
      this.llmCaller = new LLMCallerAdapter(multiModel);
    }
  }

  /**
   * Execute a task using the agent
   *
   * @param options - Task execution options
   * @returns Promise resolving to execution result
   *
   * @example
   * ```typescript
   * // Interactive mode - requires user confirmation
   * const result = await agent.execute({
   *   goal: 'Create a new blog post',
   *   mode: 'interactive'
   * });
   *
   * // Auto mode - runs autonomously
   * const result = await agent.execute({
   *   goal: 'Analyze data and generate report',
   *   mode: 'auto',
   *   maxSteps: 20,
   *   timeout: 300
   * });
   *
   * // Resume existing session
   * const result = await agent.execute({
   *   sessionId: 'existing-session-id',
   *   mode: 'auto'
   * });
   * ```
   */
  async execute(options: ExecuteOptions): Promise<ExecutionResult> {
    try {
      const mode = options.mode || this.config.defaultMode || 'interactive';

      // Emit task:started event
      this.emit({
        event: 'task:started',
        goal: options.goal,
        mode,
        timestamp: new Date(),
      } as any);

      let sessionId: string;
      let result: any;

      if (options.sessionId) {
        // Use existing session
        sessionId = options.sessionId;
      } else {
        // Create new session - will be created by the agent
        if (!options.goal) {
          throw new Error('Goal is required when creating a new session');
        }
        // We'll let the agent create the session
        sessionId = ''; // Will be set by agent
      }

      // Execute based on mode
      if (mode === 'interactive') {
        result = await this.executeInteractive(options);
        sessionId = result.sessionId;
      } else {
        result = await this.executeAuto(options);
        sessionId = result.sessionId;
      }

      // Get final session state
      const finalSession = await this.config.adapter.getSession(sessionId);
      if (!finalSession) {
        throw new Error('Session not found after execution');
      }

      const stepCount = await this.getStepCount(sessionId);

      // Emit task:completed event
      this.emit({
        event: 'task:completed',
        sessionId,
        status: result.status || 'completed',
        stepCount,
        timestamp: new Date(),
      } as any);

      return {
        sessionId,
        status: result.status || 'completed',
        output: result.result,
        stepCount,
        session: finalSession,
      };
    } catch (error) {
      // Emit task:error event
      this.emit({
        event: 'task:error',
        error: error as Error,
        timestamp: new Date(),
      } as any);

      throw error;
    }
  }

  /**
   * Get step count for a session
   */
  private async getStepCount(sessionId: string): Promise<number> {
    const steps = await this.config.adapter.listSteps(sessionId);
    return steps.length;
  }

  /**
   * Execute task in interactive mode
   */
  private async executeInteractive(options: ExecuteOptions): Promise<any> {
    // Dynamically import to avoid circular dependencies
    const { InteractiveAgent } = await import('./agents/InteractiveAgent.js');

    const agent = new InteractiveAgent({
      storageAdapter: this.config.adapter,
      llmCaller: this.llmCaller,
      eventEmitter: this as any,
      tools: this.config.tools || [],
      apiKeys: this.config.apiKeys,
      filesAdapter: this.config.filesAdapter,
      enableMCP: this.config.enableMCP,
      companyName: this.config.companyName,
      maxSteps: options.maxSteps || this.config.maxSteps,
      timeoutSeconds: options.timeout || this.config.timeout,
    });

    return await agent.execute(options);
  }

  /**
   * Execute task in autonomous mode
   */
  private async executeAuto(options: ExecuteOptions): Promise<any> {
    // Dynamically import to avoid circular dependencies
    const { AutoAgent } = await import('./agents/AutoAgent.js');

    const agent = new AutoAgent({
      storageAdapter: this.config.adapter,
      llmCaller: this.llmCaller,
      eventEmitter: this as any,
      tools: this.config.tools || [],
      apiKeys: this.config.apiKeys,
      filesAdapter: this.config.filesAdapter,
      knowledgeBase: this.config.knowledgeBase,
      enableMCP: this.config.enableMCP,
      companyName: this.config.companyName,
      maxSteps: options.maxSteps || this.config.maxSteps,
      timeoutSeconds: options.timeout || this.config.timeout,
    });

    return await agent.execute(options);
  }

  /**
   * Get a session by ID
   */
  async getSession(sessionId: string): Promise<Session | null> {
    return await this.config.adapter.getSession(sessionId);
  }

  /**
   * Get all sessions for a user
   */
  async listSessions(options: {
    userId?: string;
    organizationId?: string;
    status?: Session['status'];
    limit?: number;
    offset?: number;
  }): Promise<{ sessions: Session[]; total: number }> {
    return await this.config.adapter.listSessions(options);
  }

  /**
   * Create a checkpoint for a session
   */
  async createCheckpoint(
    sessionId: string,
    options: {
      name?: string;
    },
  ): Promise<void> {
    const session = await this.config.adapter.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const lastStep = await this.config.adapter.getLastStep(sessionId);
    const stepId = lastStep?.id || 0;

    await this.config.adapter.createCheckpoint({
      sessionId,
      name: options.name,
      stepId,
      sessionState: session,
    });
  }

  /**
   * Restore a session from a checkpoint
   */
  async restoreCheckpoint(sessionId: string, checkpointId: string): Promise<void> {
    const checkpoint = await this.config.adapter.getCheckpoint(checkpointId);
    if (!checkpoint) {
      throw new Error(`Checkpoint not found: ${checkpointId}`);
    }

    if (checkpoint.sessionId !== sessionId) {
      throw new Error('Checkpoint does not belong to this session');
    }

    // Restore session state
    await this.config.adapter.updateSession(sessionId, checkpoint.sessionState);

    // Mark steps after checkpoint as discarded
    const steps = await this.config.adapter.listSteps(sessionId);
    const stepsToDiscard = steps.filter((s) => s.id > checkpoint.stepId).map((s) => s.id);

    if (stepsToDiscard.length > 0) {
      await this.config.adapter.markStepsAsDiscarded(sessionId, stepsToDiscard);
    }
  }

  /**
   * Get session history (all steps)
   */
  async getHistory(sessionId: string): Promise<any[]> {
    return await this.config.adapter.listSteps(sessionId);
  }

  /**
   * Get the storage adapter
   */
  getAdapter(): StorageAdapter {
    return this.config.adapter;
  }

  /**
   * Get the LLM caller
   */
  getLLM(): LLMCaller {
    return this.llmCaller;
  }

  /**
   * Get the current configuration
   */
  getConfig(): Readonly<WukongAgentConfig> {
    return { ...this.config };
  }
}

/**
 * Create a new WukongAgent instance (factory function)
 *
 * @example
 * ```typescript
 * const agent = createWukongAgent({
 *   adapter: new LocalAdapter({ dbPath: './data/wukong.db' }),
 *   llm: new ClaudeAdapter({ apiKey: process.env.ANTHROPIC_API_KEY })
 * });
 * ```
 */
export function createWukongAgent(config: WukongAgentConfig): WukongAgent {
  return new WukongAgent(config);
}
