/**
 * @wukong/agent - Core Wukong Agent Library
 * @description Main entry point for the Wukong agent framework
 */

// Export all types
export type * from './types/index';
export type * from './types/adapters';
export type * from './types/events';

// Export core classes
export { WukongEventEmitter, createEventEmitter } from './EventEmitter';

// Export LLM utilities
export { MultiModelCaller, createMultiModelCaller } from './llm/MultiModelCaller';
export type { MultiModelCallerConfig } from './llm/MultiModelCaller';

// Export prompt building utilities
export { PromptBuilder, createPromptBuilder } from './prompt/PromptBuilder';
export type { PromptContext, PromptBuilderOptions } from './prompt/PromptBuilder';

// Export response parser
export { ResponseParser, schemas } from './prompt/ResponseParser';

// Export session manager
export { SessionManager } from './session/SessionManager';
export type {
  CreateSessionOptions,
  ResumeSessionOptions,
  CreateCheckpointOptions,
} from './session/SessionManager';

// Export executor components
export { StepExecutor } from './executor/StepExecutor';
export type {
  StepExecutorOptions,
  StepExecutionResult,
} from './executor/StepExecutor';

// Export tool system
export { ToolRegistry } from './tools/ToolRegistry';
export type {
  ToolExecutorDefinition,
  ToolRegistryConfig,
} from './tools/ToolRegistry';
export { ToolExecutor } from './tools/ToolExecutor';
export type {
  ToolExecutorConfig,
  ToolExecutionRequest,
} from './tools/ToolExecutor';

// Export stop controller
export { StopController } from './controller/StopController';

// Export agent implementations
export { InteractiveAgent } from './agents/InteractiveAgent';
export type {
  InteractiveAgentOptions,
  ConfirmationHandler,
} from './agents/InteractiveAgent';

export { AutoAgent } from './agents/AutoAgent';
export type {
  AutoAgentOptions,
  LLMCaller,
  KnowledgeBase,
} from './agents/AutoAgent';

// Export main WukongAgent class
export { WukongAgent, createWukongAgent } from './WukongAgent';
export type {
  WukongAgentConfig,
  ExecuteOptions,
  ExecutionResult,
} from './WukongAgent';

// Export knowledge base manager
export { KnowledgeBaseManager, createKnowledgeBaseManager } from './knowledge/KnowledgeBaseManager';
export type {
  KnowledgeBaseManagerOptions,
  IndexDocumentsOptions,
  IndexingProgress,
  SearchOptions,
  SearchResult,
  UpdateDocumentOptions,
} from './knowledge/KnowledgeBaseManager';

// Export knowledge extractor
export { KnowledgeExtractor, createKnowledgeExtractor } from './knowledge/KnowledgeExtractor';
export type {
  ExtractedKnowledge,
  DeduplicationResult,
  ExtractionOptions,
  ExtractionStats,
} from './knowledge/KnowledgeExtractor';

// Export todo manager
export { TodoManager } from './todo/TodoManager';
export type {
  TodoGenerationOptions,
  TodoUpdateOptions,
  ProgressInfo,
  TodoManagerEvents,
} from './todo/TodoManager';

// Export agent fork
export { AgentFork } from './fork/AgentFork';
export type {
  ForkAgentOptions,
  CompressionOptions,
} from './fork/AgentFork';

// Export execution adapters
export type {
  ExecutionAdapter,
  SubAgentExecutionOptions,
  SubAgentExecutionResult,
} from './fork/ExecutionAdapter';
export { PromiseAdapter } from './fork/PromiseAdapter';
export { InngestAdapter, createInngestAdapter } from './fork/InngestAdapter';
export type {
  InngestClient,
  InngestAdapterConfig,
} from './fork/InngestAdapter';

// Export skills system
export type {
  SkillMetadata,
  MatchedSkill,
  SkillsAdapter,
  MatchOptions,
  SkillsRegistryConfig,
} from './skills/types';
export { SkillsRegistry } from './skills/SkillsRegistry';
export { LocalSkillsAdapter } from './skills/LocalSkillsAdapter';
export type { LocalSkillsAdapterConfig } from './skills/LocalSkillsAdapter';

// Export monitoring utilities
export {
  TokenMonitor,
  CostCalculator,
  DEFAULT_MODEL_PRICING,
  estimateTokens,
  countTokens,
  countTokensForJSON,
} from './monitoring/TokenMonitor';
export type { ModelPricing } from './monitoring/TokenMonitor';

// Export security utilities
export {
  sanitizeString,
  sanitizeToolParameters,
  sanitizePath,
  sanitizeSQLIdentifier,
  sanitizeForDisplay,
  sanitizeEmail,
  sanitizeURL,
  sanitizeCommandArgs,
  deepSanitize,
} from './utils/sanitize';
export type { SanitizeOptions } from './utils/sanitize';

// Version
export const version = '0.1.0';

export default {
  version,
};
