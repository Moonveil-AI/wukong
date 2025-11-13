/**
 * Core type definitions for the Wukong Agent system
 *
 * This file contains all the core interfaces and types used throughout the agent system.
 */

// ==========================================
// Session Types
// ==========================================

/**
 * Agent session representing a complete conversation/task
 */
export interface Session {
  /** Unique session identifier */
  id: string;

  /** User's goal/objective for this session */
  goal: string;

  /** Original goal before any modifications */
  initialGoal?: string;

  /** Current session status */
  status: 'active' | 'paused' | 'completed' | 'failed' | 'stopped';

  /** User identification */
  userId?: string;
  apiKey?: string;
  organizationId?: string;

  /** Agent configuration */
  agentType: 'InteractiveAgent' | 'AutoAgent';
  autoRun: boolean;
  toolsConfig?: Record<string, any>;

  /** Agent Fork support */
  parentSessionId?: string;
  depth: number;
  inheritedContext?: string;
  resultSummary?: string;
  isSubAgent: boolean;

  /** History compression */
  lastCompressedStepId: number;
  compressedSummary?: string;
  isCompressing: boolean;
  compressingStartedAt?: Date;

  /** Execution control */
  isRunning: boolean;
  isDeleted: boolean;

  /** Knowledge extraction */
  lastKnowledgeExtractionAt?: Date;

  /** Sharing */
  shareSecretKey?: string;

  /** Audit fields */
  createdAt: Date;
  updatedAt: Date;
}

// ==========================================
// Step Types
// ==========================================

/**
 * Action types that the agent can perform
 */
export type ActionType =
  | 'CallTool'
  | 'CallToolsParallel'
  | 'ForkAutoAgent'
  | 'AskUser'
  | 'Plan'
  | 'Finish';

/**
 * Wait strategy for parallel tool execution
 */
export type WaitStrategy = 'all' | 'any' | 'majority';

/**
 * Individual execution step within a session
 */
export interface Step {
  /** Unique step identifier */
  id: number;

  /** Associated session ID */
  sessionId: string;

  /** Step number in sequence */
  stepNumber: number;

  /** LLM interaction */
  llmPrompt?: string;
  llmResponse?: string;

  /** Agent decision */
  action: ActionType;
  reasoning?: string;
  selectedTool?: string;
  parameters?: Record<string, any>;

  /** Execution result */
  stepResult?: string;
  errorMessage?: string;

  /** Status and control */
  status: 'pending' | 'running' | 'completed' | 'failed';
  discarded: boolean;

  /** Parallel execution support */
  isParallel: boolean;
  waitStrategy?: WaitStrategy;
  parallelStatus?: 'waiting' | 'partial' | 'completed';

  /** Timing */
  startedAt?: Date;
  completedAt?: Date;
  executionDurationMs?: number;

  /** Audit fields */
  createdAt: Date;
  updatedAt: Date;
}

// ==========================================
// Parallel Tool Call Types
// ==========================================

/**
 * Parallel tool call status
 */
export type ParallelToolCallStatus = 'pending' | 'running' | 'completed' | 'failed' | 'timeout';

/**
 * Individual tool call in parallel execution
 */
export interface ParallelToolCall {
  /** Unique identifier */
  id: number;

  /** Associated step ID */
  stepId: number;

  /** Tool identification */
  toolId: string;
  toolName: string;
  parameters: Record<string, any>;

  /** Execution status */
  status: ParallelToolCallStatus;
  result?: any;
  errorMessage?: string;

  /** Progress tracking */
  progressPercentage: number;
  statusMessage?: string;

  /** External API tracking (for async tools) */
  externalTaskId?: string;
  externalStatus?: string;

  /** Timing */
  startedAt?: Date;
  completedAt?: Date;
  executionDurationMs?: number;

  /** Retry tracking */
  retryCount: number;
  maxRetries: number;

  /** Audit fields */
  createdAt: Date;
  updatedAt: Date;
}

// ==========================================
// Fork Agent Task Types
// ==========================================

/**
 * Fork agent task status
 */
export type ForkAgentTaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'timeout';

/**
 * Agent fork task for sub-agent execution
 */
export interface ForkAgentTask {
  /** Unique identifier */
  id: string;

  /** Parent relationship */
  parentSessionId: string;
  parentStepId?: number;

  /** Sub-agent information */
  subSessionId?: string;
  goal: string;
  contextSummary?: string;
  depth: number;

  /** Execution configuration */
  maxSteps: number;
  timeoutSeconds: number;

  /** Status tracking */
  status: ForkAgentTaskStatus;
  resultSummary?: string;
  errorMessage?: string;

  /** Resource tracking */
  stepsExecuted: number;
  tokensUsed: number;
  toolsCalled: number;

  /** Timing */
  startedAt?: Date;
  completedAt?: Date;
  executionDurationMs?: number;

  /** Retry tracking */
  retryCount: number;
  maxRetries: number;

  /** Audit fields */
  createdAt: Date;
  updatedAt: Date;
}

// ==========================================
// Todo Types
// ==========================================

/**
 * Todo item status
 */
export type TodoStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'failed';

/**
 * Todo item for task tracking
 */
export interface Todo {
  /** Unique todo identifier */
  id: string;

  /** Associated session ID */
  sessionId: string;

  /** Todo information */
  title: string;
  description?: string;
  orderIndex: number;

  /** Status and dependencies */
  status: TodoStatus;
  dependencies?: string[];
  priority: number;

  /** Estimation and tracking */
  estimatedSteps?: number;
  actualSteps: number;
  estimatedTokens?: number;
  actualTokens: number;

  /** Results */
  result?: Record<string, any>;
  error?: string;

  /** Timing */
  startedAt?: Date;
  completedAt?: Date;
  durationSeconds?: number;

  /** Audit fields */
  createdAt: Date;
  updatedAt: Date;
}

// ==========================================
// Tool Types
// ==========================================

/**
 * Tool risk level
 */
export type ToolRiskLevel = 'low' | 'medium' | 'high';

/**
 * Tool metadata from metadata.json
 */
export interface ToolMetadata {
  /** Tool name (unique identifier) */
  name: string;

  /** Function description */
  description: string;

  /** Version number */
  version: string;

  /** Category */
  category: 'media' | 'data' | 'text' | 'code' | 'other';

  /** Risk level */
  riskLevel: ToolRiskLevel;

  /** Timeout in seconds */
  timeout: number;

  /** Whether user confirmation is required */
  requiresConfirmation: boolean;

  /** Whether this is an async tool */
  async: boolean;

  /** Estimated execution time in seconds */
  estimatedTime: number;
}

/**
 * Tool parameter schema (JSON Schema)
 */
export interface ToolSchema {
  $schema?: string;
  type: 'object';
  properties: Record<string, any>;
  required?: string[];
  [key: string]: any;
}

/**
 * Tool execution context
 */
export interface ToolContext {
  /** Session ID */
  sessionId: string;

  /** Step ID */
  stepId: number;

  /** User ID */
  userId?: string;

  /** API keys available to the tool */
  apiKeys: Record<string, string>;

  /** File adapter for file operations */
  filesAdapter?: any;

  /** Additional context */
  [key: string]: any;
}

/**
 * Tool execution result
 */
export interface ToolResult {
  /** Whether the tool executed successfully */
  success: boolean;

  /** Result data */
  result?: any;

  /** Error message if failed */
  error?: string;

  /** Result summary (for MCP mode) */
  summary?: string;

  /** Whether the operation can be retried */
  canRetry?: boolean;

  /** Suggestion for retry */
  suggestion?: string;

  /** For async tools: task ID */
  taskId?: string;
}

/**
 * Tool handler function signature
 */
export type ToolHandler = (
  params: Record<string, any>,
  context: ToolContext,
) => Promise<ToolResult>;

/**
 * Tool error handler function signature
 */
export type ToolErrorHandler = (
  error: Error,
  params: Record<string, any>,
  context: ToolContext,
) => Promise<ToolResult>;

/**
 * Complete tool definition
 */
export interface Tool {
  /** Tool metadata */
  metadata: ToolMetadata;

  /** Parameter schema */
  schema: ToolSchema;

  /** Tool handler function */
  handler: ToolHandler;

  /** Error handler (optional) */
  onError?: ToolErrorHandler;
}

// ==========================================
// Agent Configuration Types
// ==========================================

/**
 * Knowledge base configuration
 */
export interface KnowledgeBaseConfig {
  /** File path to knowledge base */
  path: string;

  /** Optional embedding model */
  embedModel?: string;
}

/**
 * Tools configuration
 */
export interface ToolsConfig {
  /** Tools directory path */
  path: string;

  /** Auto-discover tools */
  autoDiscover?: boolean;
}

/**
 * Trustworthiness configuration
 */
export interface TrustConfig {
  /** Operation types requiring confirmation */
  requireConfirmation?: string[];

  /** Whether to show execution plan */
  showPlan?: boolean;

  /** Whether to enable undo */
  enableUndo?: boolean;

  /** Maximum execution steps */
  maxSteps?: number;
}

/**
 * Token optimization configuration
 */
export interface TokenConfig {
  /** Enable MCP Code Execution */
  enableMCP?: boolean;

  /** Enable Skills lazy loading */
  enableSkills?: boolean;

  /** Auto-discard useless steps */
  autoDiscard?: boolean;
}

/**
 * Main agent configuration
 */
export interface WukongAgentConfig {
  /** LLM API key */
  llmKey: string;

  /** Optional LLM model */
  llmModel?: string;

  /** Storage and cache adapter */
  adapter: any; // Will be typed more specifically in adapters.ts

  /** Knowledge base configuration (optional) */
  knowledgeBase?: KnowledgeBaseConfig;

  /** Tools configuration */
  tools: ToolsConfig;

  /** Trustworthiness configuration (optional) */
  trustConfig?: TrustConfig;

  /** Token optimization configuration (optional) */
  tokenConfig?: TokenConfig;
}

// ==========================================
// Task Execution Types
// ==========================================

/**
 * Progress event data
 */
export interface ProgressEvent {
  /** Session ID */
  sessionId: string;

  /** Current step number */
  currentStep: number;

  /** Total steps (if known) */
  totalSteps?: number;

  /** Progress percentage */
  percentage: number;

  /** Current action description */
  description?: string;
}

/**
 * Execution plan
 */
export interface ExecutionPlan {
  /** Planned steps */
  steps: Array<{
    action: ActionType;
    description: string;
    estimatedTime?: number;
  }>;

  /** Total estimated time */
  totalEstimatedTime?: number;

  /** Estimated token usage */
  estimatedTokens?: number;
}

/**
 * Tool call information
 */
export interface ToolCall {
  /** Tool name */
  toolName: string;

  /** Tool parameters */
  parameters: Record<string, any>;

  /** Whether this is a high-risk operation */
  isHighRisk: boolean;

  /** Risk level */
  riskLevel: ToolRiskLevel;

  /** Tool description */
  description: string;
}

/**
 * Task execution options
 */
export interface TaskOptions {
  /** User goal */
  goal: string;

  /** Execution mode */
  mode?: 'interactive' | 'auto';

  /** Show progress */
  showProgress?: boolean;

  /** Progress callback */
  onProgress?: (event: ProgressEvent) => void;

  /** Plan ready callback */
  onPlanReady?: (plan: ExecutionPlan) => Promise<boolean>;

  /** Tool call callback */
  onToolCall?: (call: ToolCall) => Promise<boolean>;

  /** Maximum steps */
  maxSteps?: number;

  /** Timeout in seconds */
  timeout?: number;

  /** Additional context */
  context?: Record<string, any>;
}

/**
 * Task execution result
 */
export interface TaskResult {
  /** Session ID */
  sessionId: string;

  /** Final status */
  status: 'completed' | 'failed' | 'stopped' | 'timeout';

  /** Final result */
  result?: any;

  /** Error message if failed */
  error?: string;

  /** Number of steps executed */
  stepsExecuted: number;

  /** Total tokens used */
  tokensUsed: number;

  /** Execution duration in seconds */
  durationSeconds: number;

  /** Can be resumed */
  canResume: boolean;
}

// ==========================================
// Action-Specific Types
// ==========================================

/**
 * CallTool action
 */
export interface CallToolAction {
  action: 'CallTool';
  reasoning: string;
  selectedTool: string;
  parameters: Record<string, any>;
  discardableSteps?: number[];
}

/**
 * CallToolsParallel action
 */
export interface CallToolsParallelAction {
  action: 'CallToolsParallel';
  reasoning: string;
  parallelTools: Array<{
    toolId: string;
    toolName: string;
    parameters: Record<string, any>;
  }>;
  waitStrategy: WaitStrategy;
  discardableSteps?: number[];
}

/**
 * ForkAutoAgent action
 */
export interface ForkAutoAgentAction {
  action: 'ForkAutoAgent';
  reasoning: string;
  subGoal: string;
  contextSummary: string;
  maxDepth?: number;
  maxSteps?: number;
  timeout?: number;
  discardableSteps?: number[];
}

/**
 * AskUser action
 */
export interface AskUserAction {
  action: 'AskUser';
  reasoning: string;
  question: string;
  options?: string[];
  discardableSteps?: number[];
}

/**
 * Plan action
 */
export interface PlanAction {
  action: 'Plan';
  reasoning: string;
  plan: ExecutionPlan;
  discardableSteps?: number[];
}

/**
 * Finish action
 */
export interface FinishAction {
  action: 'Finish';
  reasoning: string;
  finalResult: any;
  summary?: string;
  discardableSteps?: number[];
}

/**
 * Union type of all possible actions
 */
export type AgentAction =
  | CallToolAction
  | CallToolsParallelAction
  | ForkAutoAgentAction
  | AskUserAction
  | PlanAction
  | FinishAction;

// ==========================================
// Checkpoint Types
// ==========================================

/**
 * Session checkpoint for undo/restore
 */
export interface Checkpoint {
  /** Unique checkpoint identifier */
  id: string;

  /** Session ID */
  sessionId: string;

  /** Checkpoint name */
  name?: string;

  /** Step ID at checkpoint */
  stepId: number;

  /** Session state snapshot */
  sessionState: Partial<Session>;

  /** Created timestamp */
  createdAt: Date;
}

// ==========================================
// Stop Control Types
// ==========================================

/**
 * Stop options
 */
export interface StopOptions {
  /** Graceful stop (complete current step) */
  graceful?: boolean;

  /** Save state for resumption */
  saveState?: boolean;
}

/**
 * Stop state information
 */
export interface StopState {
  /** Session ID */
  sessionId: string;

  /** Completed steps */
  completedSteps: number;

  /** Partial result if available */
  partialResult?: any;

  /** Can be resumed */
  canResume: boolean;

  /** Last completed step ID */
  lastStepId: number;
}

// ==========================================
// LLM Types
// ==========================================

/**
 * LLM streaming chunk
 */
export interface StreamChunk {
  /** Chunk text */
  text: string;

  /** Cumulative text so far */
  fullText: string;

  /** Chunk index */
  index: number;

  /** Whether this is the final chunk */
  isFinal: boolean;
}

/**
 * Complete LLM response
 */
export interface LLMResponse {
  /** Full response text */
  text: string;

  /** Token usage */
  tokensUsed: {
    prompt: number;
    completion: number;
    total: number;
  };

  /** Model used */
  model: string;

  /** Response time in ms */
  responseTimeMs: number;
}

/**
 * Token usage information
 */
export interface TokenUsage {
  /** Session ID */
  sessionId: string;

  /** Step ID */
  stepId: number;

  /** Prompt tokens */
  promptTokens: number;

  /** Completion tokens */
  completionTokens: number;

  /** Total tokens */
  totalTokens: number;

  /** Estimated cost in USD */
  estimatedCost: number;

  /** Tokens saved by optimizations */
  savings?: {
    mcpSavings?: number;
    skillsSavings?: number;
    discardSavings?: number;
    total: number;
  };
}

// ==========================================
// Parallel Execution Types
// ==========================================

/**
 * Parallel tool execution info
 */
export interface ParallelToolInfo {
  /** Parent step ID */
  stepId: number;

  /** Session ID */
  sessionId: string;

  /** Tool calls being executed */
  tools: Array<{
    toolId: string;
    toolName: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
  }>;

  /** Wait strategy */
  waitStrategy: WaitStrategy;

  /** Total tools */
  totalTools: number;

  /** Completed tools */
  completedTools: number;
}

/**
 * Parallel execution results
 */
export interface ParallelResults {
  /** Step ID */
  stepId: number;

  /** Completed tool results */
  completed: Array<{
    toolId: string;
    toolName: string;
    result: ToolResult;
  }>;

  /** Failed tool results */
  failed: Array<{
    toolId: string;
    toolName: string;
    error: string;
  }>;

  /** Pending tools (if using 'any' or 'majority' strategy) */
  pending: Array<{
    toolId: string;
    toolName: string;
  }>;

  /** Whether wait condition was met */
  conditionMet: boolean;
}

// ==========================================
// Sub-Agent Types
// ==========================================

/**
 * Sub-agent information
 */
export interface SubAgentInfo {
  /** Sub-agent session ID */
  sessionId: string;

  /** Parent session ID */
  parentSessionId: string;

  /** Sub-agent goal */
  goal: string;

  /** Depth level */
  depth: number;

  /** Context summary */
  contextSummary: string;
}

/**
 * Sub-agent progress update
 */
export interface SubAgentProgress {
  /** Sub-agent session ID */
  sessionId: string;

  /** Current step */
  currentStep: number;

  /** Progress percentage */
  percentage: number;

  /** Current status */
  status: string;
}

/**
 * Sub-agent result
 */
export interface SubAgentResult {
  /** Sub-agent session ID */
  sessionId: string;

  /** Compressed result summary */
  summary: string;

  /** Full result (optional) */
  result?: any;

  /** Steps executed */
  stepsExecuted: number;

  /** Tokens used */
  tokensUsed: number;

  /** Execution duration */
  durationSeconds: number;
}

/**
 * Sub-agent error
 */
export interface SubAgentError {
  /** Sub-agent session ID */
  sessionId: string;

  /** Error message */
  error: string;

  /** Steps completed before error */
  stepsCompleted: number;
}

// ==========================================
// Knowledge Base Types
// ==========================================

/**
 * Knowledge search filters
 */
export interface KnowledgeFilters {
  /** User ID filter */
  userId?: string;

  /** Organization ID filter */
  organizationId?: string;

  /** Knowledge level */
  level?: 'public' | 'organization' | 'individual';

  /** Session ID filter */
  sessionId?: string;
}

/**
 * Knowledge search options
 */
export interface KnowledgeSearchOptions {
  /** Search query */
  query: string;

  /** Number of results to return */
  topK?: number;

  /** Minimum similarity score */
  minScore?: number;

  /** Filters */
  filters?: KnowledgeFilters;
}

/**
 * Knowledge search result
 */
export interface KnowledgeResult {
  /** Document ID */
  id: string;

  /** Content */
  content: string;

  /** Similarity score */
  score: number;

  /** Metadata */
  metadata: {
    source?: string;
    title?: string;
    level: 'public' | 'organization' | 'individual';
    createdAt: Date;
    [key: string]: any;
  };
}
