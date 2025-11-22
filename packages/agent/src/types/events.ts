/**
 * Event type definitions for the Wukong Agent system
 *
 * The agent uses an event-driven architecture to provide visibility into execution.
 * All events follow a consistent naming pattern: <category>:<action>
 */

import type {
  ExecutionPlan,
  LLMResponse,
  ParallelResults,
  ParallelToolInfo,
  Session,
  Step,
  StopState,
  StreamChunk,
  SubAgentError,
  SubAgentInfo,
  SubAgentProgress,
  SubAgentResult,
  TaskResult,
  Todo,
  TokenUsage,
  ToolCall,
  ToolResult,
} from './index';

// ==========================================
// Session Events
// ==========================================

/**
 * Emitted when a new session is created
 */
export interface SessionCreatedEvent {
  event: 'session:created';
  session: Session;
}

/**
 * Emitted when a session is updated
 */
export interface SessionUpdatedEvent {
  event: 'session:updated';
  session: Session;
  changes: Partial<Session>;
}

/**
 * Emitted when a session is deleted
 */
export interface SessionDeletedEvent {
  event: 'session:deleted';
  sessionId: string;
}

/**
 * Emitted when a session is resumed
 */
export interface SessionResumedEvent {
  event: 'session:resumed';
  session: Session;
  fromStep: number;
}

// ==========================================
// Plan Events
// ==========================================

/**
 * Emitted when an execution plan is generated
 */
export interface PlanGeneratedEvent {
  event: 'plan:generated';
  sessionId: string;
  plan: ExecutionPlan;
}

/**
 * Emitted when the plan is updated
 */
export interface PlanUpdatedEvent {
  event: 'plan:updated';
  sessionId: string;
  plan: ExecutionPlan;
  changes: string;
}

// ==========================================
// Todo Events
// ==========================================

/**
 * Emitted when todos are generated for a session
 */
export interface TodosGeneratedEvent {
  event: 'todos:generated';
  sessionId: string;
  todos: Todo[];
}

/**
 * Emitted when a todo is started
 */
export interface TodoStartedEvent {
  event: 'todo:started';
  todo: Todo;
}

/**
 * Emitted when a todo is completed
 */
export interface TodoCompletedEvent {
  event: 'todo:completed';
  todo: Todo;
}

/**
 * Emitted when a todo fails
 */
export interface TodoFailedEvent {
  event: 'todo:failed';
  todo: Todo;
  error: string;
}

/**
 * Emitted when todos are updated
 */
export interface TodosUpdatedEvent {
  event: 'todos:updated';
  sessionId: string;
  changes: Array<{
    todoId: string;
    field: string;
    oldValue: any;
    newValue: any;
  }>;
}

// ==========================================
// Step Events
// ==========================================

/**
 * Emitted when a step is started
 */
export interface StepStartedEvent {
  event: 'step:started';
  step: Step;
}

/**
 * Emitted when a step is completed
 */
export interface StepCompletedEvent {
  event: 'step:completed';
  step: Step;
}

/**
 * Emitted when a step fails
 */
export interface StepFailedEvent {
  event: 'step:failed';
  step: Step;
  error: string;
}

/**
 * Emitted when steps are discarded for token optimization
 */
export interface StepsDiscardedEvent {
  event: 'steps:discarded';
  sessionId: string;
  stepIds: number[];
  tokensSaved: number;
}

// ==========================================
// Tool Execution Events
// ==========================================

/**
 * Emitted when a tool is about to execute
 */
export interface ToolExecutingEvent {
  event: 'tool:executing';
  sessionId: string;
  stepId: number;
  toolName: string;
  parameters: Record<string, any>;
  description: string;
}

/**
 * Emitted when a tool requires user confirmation
 */
export interface ToolRequiresConfirmationEvent {
  event: 'tool:requiresConfirmation';
  sessionId: string;
  stepId: number;
  toolCall: ToolCall;
}

/**
 * Emitted when a tool execution completes
 */
export interface ToolCompletedEvent {
  event: 'tool:completed';
  sessionId: string;
  stepId: number;
  toolName: string;
  result: ToolResult;
  durationMs: number;
}

/**
 * Emitted when a tool execution fails
 */
export interface ToolFailedEvent {
  event: 'tool:failed';
  sessionId: string;
  stepId: number;
  toolName: string;
  error: string;
  canRetry: boolean;
}

// ==========================================
// Async Tool Events
// ==========================================

/**
 * Emitted when an async task is submitted
 */
export interface AsyncTaskSubmittedEvent {
  event: 'tool:async:submitted';
  sessionId: string;
  stepId: number;
  toolName: string;
  taskId: string;
  estimatedTime?: number;
}

/**
 * Emitted when an async task has progress
 */
export interface AsyncTaskProgressEvent {
  event: 'tool:async:progress';
  sessionId: string;
  stepId: number;
  taskId: string;
  progress: {
    percentage?: number;
    status: string;
    message?: string;
  };
}

/**
 * Emitted when an async task completes
 */
export interface AsyncTaskCompletedEvent {
  event: 'tool:async:completed';
  sessionId: string;
  stepId: number;
  taskId: string;
  result: ToolResult;
  totalDurationMs: number;
}

/**
 * Emitted when an async task fails
 */
export interface AsyncTaskFailedEvent {
  event: 'tool:async:failed';
  sessionId: string;
  stepId: number;
  taskId: string;
  error: string;
}

// ==========================================
// Parallel Tool Events
// ==========================================

/**
 * Emitted when parallel tools are submitted
 */
export interface ParallelToolsSubmittedEvent {
  event: 'tools:parallel:submitted';
  sessionId: string;
  stepId: number;
  info: ParallelToolInfo;
}

/**
 * Emitted when one tool in parallel execution completes
 */
export interface ParallelToolCompletedEvent {
  event: 'tool:parallel:completed';
  sessionId: string;
  stepId: number;
  toolId: string;
  toolName: string;
  result: ToolResult;
  completedCount: number;
  totalCount: number;
}

/**
 * Emitted when one tool in parallel execution fails
 */
export interface ParallelToolFailedEvent {
  event: 'tool:parallel:failed';
  sessionId: string;
  stepId: number;
  toolId: string;
  toolName: string;
  error: string;
}

/**
 * Emitted when parallel tools meet their wait condition
 */
export interface ParallelToolsReadyEvent {
  event: 'tools:parallel:ready';
  sessionId: string;
  stepId: number;
  results: ParallelResults;
}

// ==========================================
// LLM Events
// ==========================================

/**
 * Emitted when LLM starts processing
 */
export interface LLMStartedEvent {
  event: 'llm:started';
  sessionId: string;
  stepId: number;
  model: string;
  promptTokens: number;
}

/**
 * Emitted for each streaming chunk from LLM
 */
export interface LLMStreamingEvent {
  event: 'llm:streaming';
  sessionId: string;
  stepId: number;
  chunk: StreamChunk;
}

/**
 * Emitted when LLM completes
 */
export interface LLMCompleteEvent {
  event: 'llm:complete';
  sessionId: string;
  stepId: number;
  response: LLMResponse;
}

/**
 * Emitted when LLM call fails
 */
export interface LLMFailedEvent {
  event: 'llm:failed';
  sessionId: string;
  stepId: number;
  error: string;
  model: string;
  willRetry: boolean;
}

// ==========================================
// Progress Events
// ==========================================

/**
 * Emitted when overall progress is updated
 */
export interface ProgressUpdatedEvent {
  event: 'progress:updated';
  sessionId: string;
  percentage: number;
  currentStep: number;
  totalSteps?: number;
  description?: string;
}

// ==========================================
// Reasoning Events
// ==========================================

/**
 * Emitted when agent's reasoning is available
 */
export interface ReasoningAvailableEvent {
  event: 'reasoning:available';
  sessionId: string;
  stepId: number;
  reasoning: {
    thought: string;
    action: string;
    justification: string;
  };
}

// ==========================================
// Task Events
// ==========================================

/**
 * Emitted when task is starting to stop
 */
export interface TaskStoppingEvent {
  event: 'task:stopping';
  sessionId: string;
  graceful: boolean;
}

/**
 * Emitted when task starts
 */
export interface TaskStartedEvent {
  event: 'task:started';
  goal?: string;
  mode: string;
  timestamp: Date;
}

/**
 * Emitted when task errors (exception)
 */
export interface TaskErrorEvent {
  event: 'task:error';
  error: Error;
  timestamp: Date;
}

/**
 * Emitted when task has stopped
 */
export interface TaskStoppedEvent {
  event: 'task:stopped';
  sessionId: string;
  state: StopState;
}

/**
 * Emitted when task is completed
 */
export interface TaskCompletedEvent {
  event: 'task:completed';
  sessionId: string;
  result: TaskResult;
}

/**
 * Emitted when task fails
 */
export interface TaskFailedEvent {
  event: 'task:failed';
  sessionId: string;
  error: string;
  partialResult?: any;
}

/**
 * Emitted when task times out
 */
export interface TaskTimeoutEvent {
  event: 'task:timeout';
  sessionId: string;
  stepsCompleted: number;
  partialResult?: any;
}

// ==========================================
// Token Usage Events
// ==========================================

/**
 * Emitted when tokens are used
 */
export interface TokensUsedEvent {
  event: 'tokens:used';
  usage: TokenUsage;
}

/**
 * Emitted when tokens are saved through optimizations
 */
export interface TokensSavedEvent {
  event: 'tokens:saved';
  sessionId: string;
  stepId: number;
  savedBy: 'mcp' | 'skills' | 'discard';
  amount: number;
  percentage: number;
}

// ==========================================
// Skills Events
// ==========================================

/**
 * Emitted when skills are matched for current context
 */
export interface SkillsMatchedEvent {
  event: 'skills:matched';
  sessionId: string;
  stepId: number;
  skills: Array<{
    name: string;
    score: number;
    reason: string;
  }>;
}

/**
 * Emitted when skills are loaded
 */
export interface SkillsLoadedEvent {
  event: 'skills:loaded';
  sessionId: string;
  stepId: number;
  skillNames: string[];
  tokenCount: number;
}

// ==========================================
// Sub-Agent Events
// ==========================================

/**
 * Emitted when a sub-agent is started
 */
export interface SubAgentStartedEvent {
  event: 'subagent:started';
  parentSessionId: string;
  info: SubAgentInfo;
}

/**
 * Emitted when a sub-agent has progress
 */
export interface SubAgentProgressEvent {
  event: 'subagent:progress';
  parentSessionId: string;
  progress: SubAgentProgress;
}

/**
 * Emitted when a sub-agent completes
 */
export interface SubAgentCompletedEvent {
  event: 'subagent:completed';
  parentSessionId: string;
  result: SubAgentResult;
}

/**
 * Emitted when a sub-agent fails
 */
export interface SubAgentFailedEvent {
  event: 'subagent:failed';
  parentSessionId: string;
  error: SubAgentError;
}

// ==========================================
// Knowledge Base Events
// ==========================================

/**
 * Emitted when knowledge base is searched
 */
export interface KnowledgeSearchedEvent {
  event: 'knowledge:searched';
  sessionId: string;
  stepId: number;
  query: string;
  resultsCount: number;
  durationMs: number;
}

/**
 * Emitted when knowledge is extracted from session
 */
export interface KnowledgeExtractedEvent {
  event: 'knowledge:extracted';
  sessionId: string;
  entitiesCount: number;
  level: 'public' | 'organization' | 'individual';
}

/**
 * Emitted when knowledge is indexed
 */
export interface KnowledgeIndexedEvent {
  event: 'knowledge:indexed';
  documentsCount: number;
  chunksCount: number;
  durationMs: number;
}

// ==========================================
// Checkpoint Events
// ==========================================

/**
 * Emitted when a checkpoint is created
 */
export interface CheckpointCreatedEvent {
  event: 'checkpoint:created';
  sessionId: string;
  checkpointId: string;
  stepId: number;
}

/**
 * Emitted when a checkpoint is restored
 */
export interface CheckpointRestoredEvent {
  event: 'checkpoint:restored';
  sessionId: string;
  checkpointId: string;
  restoredToStep: number;
}

// ==========================================
// Error Events
// ==========================================

/**
 * Emitted when an error occurs
 */
export interface ErrorEvent {
  event: 'error';
  sessionId?: string;
  stepId?: number;
  error: {
    code: string;
    message: string;
    details?: any;
    stack?: string;
  };
  recoverable: boolean;
}

/**
 * Emitted when an error is recovered
 */
export interface ErrorRecoveredEvent {
  event: 'error:recovered';
  sessionId: string;
  stepId: number;
  originalError: string;
  recoveryAction: string;
}

// ==========================================
// Debug Events
// ==========================================

/**
 * Emitted for debugging purposes
 */
export interface DebugEvent {
  event: 'debug';
  sessionId?: string;
  stepId?: number;
  category: string;
  message: string;
  data?: any;
}

// ==========================================
// Event Union Type
// ==========================================

/**
 * Union type of all possible events
 */
export type WukongEvent =
  // Session events
  | SessionCreatedEvent
  | SessionUpdatedEvent
  | SessionDeletedEvent
  | SessionResumedEvent
  // Plan events
  | PlanGeneratedEvent
  | PlanUpdatedEvent
  // Todo events
  | TodosGeneratedEvent
  | TodoStartedEvent
  | TodoCompletedEvent
  | TodoFailedEvent
  | TodosUpdatedEvent
  // Step events
  | StepStartedEvent
  | StepCompletedEvent
  | StepFailedEvent
  | StepsDiscardedEvent
  // Tool events
  | ToolExecutingEvent
  | ToolRequiresConfirmationEvent
  | ToolCompletedEvent
  | ToolFailedEvent
  // Async tool events
  | AsyncTaskSubmittedEvent
  | AsyncTaskProgressEvent
  | AsyncTaskCompletedEvent
  | AsyncTaskFailedEvent
  // Parallel tool events
  | ParallelToolsSubmittedEvent
  | ParallelToolCompletedEvent
  | ParallelToolFailedEvent
  | ParallelToolsReadyEvent
  // LLM events
  | LLMStartedEvent
  | LLMStreamingEvent
  | LLMCompleteEvent
  | LLMFailedEvent
  // Progress events
  | ProgressUpdatedEvent
  // Reasoning events
  | ReasoningAvailableEvent
  // Task events
  | TaskStartedEvent
  | TaskStoppingEvent
  | TaskStoppedEvent
  | TaskCompletedEvent
  | TaskFailedEvent
  | TaskErrorEvent
  | TaskTimeoutEvent
  // Token events
  | TokensUsedEvent
  | TokensSavedEvent
  // Skills events
  | SkillsMatchedEvent
  | SkillsLoadedEvent
  // Sub-agent events
  | SubAgentStartedEvent
  | SubAgentProgressEvent
  | SubAgentCompletedEvent
  | SubAgentFailedEvent
  // Knowledge events
  | KnowledgeSearchedEvent
  | KnowledgeExtractedEvent
  | KnowledgeIndexedEvent
  // Checkpoint events
  | CheckpointCreatedEvent
  | CheckpointRestoredEvent
  // Error events
  | ErrorEvent
  | ErrorRecoveredEvent
  // Debug events
  | DebugEvent;

/**
 * Event listener function type
 */
export type EventListener<T extends WukongEvent = WukongEvent> = (event: T) => void | Promise<void>;

/**
 * Event emitter interface
 */
export interface EventEmitter {
  /**
   * Register an event listener
   */
  on<T extends WukongEvent['event']>(
    event: T,
    listener: EventListener<Extract<WukongEvent, { event: T }>>,
  ): void;

  /**
   * Register a one-time event listener
   */
  once<T extends WukongEvent['event']>(
    event: T,
    listener: EventListener<Extract<WukongEvent, { event: T }>>,
  ): void;

  /**
   * Remove an event listener
   */
  off<T extends WukongEvent['event']>(
    event: T,
    listener: EventListener<Extract<WukongEvent, { event: T }>>,
  ): void;

  /**
   * Emit an event
   */
  emit<T extends WukongEvent>(event: T): void;

  /**
   * Remove all listeners for an event
   */
  removeAllListeners(event?: WukongEvent['event']): void;

  /**
   * Get listener count for an event
   */
  listenerCount(event: WukongEvent['event']): number;
}

/**
 * Map of event names to their payloads (for simpler event handling)
 */
export interface AgentEvent {
  // Session events
  'session:created': Session;
  'session:updated': { session: Session; changes: Partial<Session> };
  'session:deleted': { sessionId: string };
  'session:resumed': { session: Session; fromStep: number };
  'session:paused': { sessionId: string; timestamp: Date };

  // Step events
  'step:started': Step;
  'step:completed': Step;
  'step:error': { step: Step; error: string };

  // Tool events
  'tool:started': {
    sessionId: string;
    stepId: number;
    toolName: string;
    parameters: Record<string, any>;
    description: string;
  };
  'tool:completed': {
    sessionId: string;
    stepId: number;
    toolName: string;
    result: ToolResult;
    durationMs: number;
  };
  'tool:error': {
    sessionId: string;
    stepId: number;
    toolName: string;
    error: string;
    canRetry: boolean;
  };
  'tool:requiresConfirmation': { sessionId: string; stepId: number; toolCall: ToolCall };

  // LLM events
  'llm:started': { sessionId: string; stepId: number; model: string; promptTokens: number };
  'llm:completed': { sessionId: string; stepId: number; response: LLMResponse };
  'llm:streaming': { sessionId: string; stepId: number; chunk: StreamChunk };
  'llm:error': {
    sessionId: string;
    stepId: number;
    error: string;
    model: string;
    willRetry: boolean;
  };

  // Knowledge events
  'knowledge:searched': {
    sessionId: string;
    stepId: number;
    query: string;
    resultsCount: number;
    durationMs: number;
  };

  // Todo events
  'todo:created': Todo;
  'todo:updated': Todo;

  // Task events
  'task:started': { goal?: string; mode: string; timestamp: Date };
  'task:completed': { sessionId: string; status: string; stepCount: number; timestamp: Date };
  'task:error': { error: Error; timestamp: Date };

  // Stop events
  'stop:requested': { graceful: boolean; timestamp: Date };
}

// ==========================================
// Event Type Guards
// ==========================================

/**
 * Type guard to check if event is a session event
 */
export function isSessionEvent(
  event: WukongEvent,
): event is SessionCreatedEvent | SessionUpdatedEvent | SessionDeletedEvent | SessionResumedEvent {
  return event.event.startsWith('session:');
}

/**
 * Type guard to check if event is a step event
 */
export function isStepEvent(
  event: WukongEvent,
): event is StepStartedEvent | StepCompletedEvent | StepFailedEvent | StepsDiscardedEvent {
  return event.event.startsWith('step:') || event.event.startsWith('steps:');
}

/**
 * Type guard to check if event is a tool event
 */
export function isToolEvent(
  event: WukongEvent,
): event is
  | ToolExecutingEvent
  | ToolRequiresConfirmationEvent
  | ToolCompletedEvent
  | ToolFailedEvent {
  return (
    event.event.startsWith('tool:') &&
    !event.event.includes('async') &&
    !event.event.includes('parallel')
  );
}

/**
 * Type guard to check if event is an LLM event
 */
export function isLLMEvent(
  event: WukongEvent,
): event is LLMStartedEvent | LLMStreamingEvent | LLMCompleteEvent | LLMFailedEvent {
  return event.event.startsWith('llm:');
}

/**
 * Type guard to check if event is a task event
 */
export function isTaskEvent(
  event: WukongEvent,
): event is
  | TaskStartedEvent
  | TaskStoppingEvent
  | TaskStoppedEvent
  | TaskCompletedEvent
  | TaskFailedEvent
  | TaskErrorEvent
  | TaskTimeoutEvent {
  return event.event.startsWith('task:');
}
