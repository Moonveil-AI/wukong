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
  MCPToolDefinition,
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

// Version
export const version = '0.1.0';

export default {
  version,
};
