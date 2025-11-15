/**
 * Execution Adapter Interface
 *
 * Defines how sub-agents are executed in different environments:
 * - PromiseAdapter: For local development (Node.js long-running process)
 * - InngestAdapter: For serverless environments (Vercel, AWS Lambda, etc.)
 */

import type { LLMCaller } from '../agents/AutoAgent.js';
import type { KnowledgeBase } from '../agents/AutoAgent.js';
import type { ForkAgentTask, StorageAdapter, Tool } from '../types/index.js';

/**
 * Options for executing a sub-agent
 */
export interface SubAgentExecutionOptions {
  /** The fork task configuration */
  task: ForkAgentTask;

  /** User ID for the sub-agent */
  userId?: string;

  /** Organization ID for the sub-agent */
  organizationId?: string;

  /** Storage adapter */
  storageAdapter: StorageAdapter;

  /** LLM caller */
  llmCaller: LLMCaller;

  /** Available tools */
  tools: Tool[];

  /** API keys */
  apiKeys: Record<string, string>;

  /** Files adapter */
  filesAdapter?: any;

  /** Knowledge base */
  knowledgeBase?: KnowledgeBase;

  /** Enable MCP */
  enableMCP?: boolean;

  /** Company name */
  companyName?: string;
}

/**
 * Result of sub-agent execution
 */
export interface SubAgentExecutionResult {
  /** Sub-agent session ID */
  sessionId: string;

  /** Execution status */
  status: 'completed' | 'failed' | 'timeout';

  /** Final result */
  result?: any;

  /** Error message if failed */
  error?: string;

  /** Number of steps executed */
  stepsExecuted: number;

  /** Tokens used */
  tokensUsed: number;

  /** Execution duration in milliseconds */
  durationMs: number;
}

/**
 * Execution Adapter Interface
 *
 * Different implementations for different execution environments
 */
export interface ExecutionAdapter {
  /**
   * Execute a sub-agent
   *
   * @param options - Execution options
   * @returns Promise that resolves when execution is initiated (not necessarily completed)
   */
  executeSubAgent(options: SubAgentExecutionOptions): Promise<void>;

  /**
   * Wait for a sub-agent to complete
   *
   * @param taskId - Task ID to wait for
   * @param timeoutMs - Maximum time to wait in milliseconds
   * @returns Promise that resolves with the execution result
   */
  waitForCompletion(taskId: string, timeoutMs: number): Promise<SubAgentExecutionResult>;

  /**
   * Cancel a running sub-agent
   *
   * @param taskId - Task ID to cancel
   */
  cancelSubAgent(taskId: string): Promise<void>;

  /**
   * Check if a sub-agent is still running
   *
   * @param taskId - Task ID to check
   * @returns True if still running
   */
  isRunning(taskId: string): Promise<boolean>;

  /**
   * Get the adapter name (for logging/debugging)
   */
  getName(): string;
}
