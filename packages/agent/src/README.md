# /packages/agent/src

Core agent library - execution engine, state management, event system, and orchestration.

<!-- SYNC: When files in this directory change, update this document. -->

## Architecture

This is the heart of the Wukong agent system. It orchestrates LLM calls, tool execution, knowledge retrieval, session management, and provides a comprehensive event-driven API for monitoring and control.

## Module Structure

| Directory/File | Role | Purpose |
|----------------|------|---------|
| `WukongAgent.ts` | Entry | Main agent class, public API entry point |
| `index.ts` | Export | Central export point for public interfaces |
| `agents/` | Core | Agent execution modes (Interactive, Auto) |
| `executor/` | Core | Step-by-step execution logic |
| `controller/` | Core | Stop/pause/resume control mechanisms |
| `session/` | Core | Session state management and persistence |
| `prompt/` | Core | Prompt building and response parsing |
| `llm/` | Integration | Multi-model LLM caller with fallback |
| `tools/` | Integration | Tool registry and execution (sync/async/parallel) |
| `knowledge/` | Integration | Knowledge base manager and extractor |
| `skills/` | Integration | Skills registry and lazy loading |
| `todo/` | Feature | Todo list task decomposition and tracking |
| `fork/` | Feature | Agent forking for parallel execution |
| `monitoring/` | Support | Token usage monitoring |
| `types/` | Support | TypeScript type definitions |
| `utils/` | Support | Utility functions (sanitization, etc.) |
| `EventEmitter.ts` | Support | Event system for agent lifecycle |

## Key Files

### WukongAgent.ts
- **Purpose**: Main agent class with initialization, execution, and lifecycle methods
- **Exports**: `WukongAgent` class
- **Dependencies**: All subsystems

### EventEmitter.ts
- **Purpose**: Custom event emitter for agent events
- **Exports**: `EventEmitter` class
- **Consumers**: All components emit events through this

### agents/
- **InteractiveAgent.ts**: User-controlled step-by-step execution
- **AutoAgent.ts**: Fully autonomous execution mode

### executor/
- **StepExecutor.ts**: Core logic for executing a single agent step

### session/
- **SessionManager.ts**: Manages session state, checkpoints, and history

### prompt/
- **PromptBuilder.ts**: Constructs prompts with context, tools, and history
- **ResponseParser.ts**: Parses LLM responses into structured actions

### tools/
- **ToolRegistry.ts**: Registry for available tools
- **ToolExecutor.ts**: Synchronous tool execution
- **AsyncToolExecutor.ts**: Long-running async tool execution
- **ParallelToolExecutor.ts**: Parallel tool execution optimization

### knowledge/
- **KnowledgeBaseManager.ts**: Manages knowledge retrieval and caching
- **KnowledgeExtractor.ts**: Extracts relevant knowledge for prompts

### skills/
- **SkillsRegistry.ts**: Registry for agent skills
- **LocalSkillsAdapter.ts**: Local filesystem-based skills loader

### todo/
- **TodoManager.ts**: Task decomposition and progress tracking

### fork/
- **AgentFork.ts**: Fork agent execution for parallel tasks
- **ExecutionAdapter.ts**: Base adapter interface
- **PromiseAdapter.ts**: Promise-based fork adapter
- **InngestAdapter.ts**: Inngest-based async fork adapter

### llm/
- **MultiModelCaller.ts**: Calls multiple LLM providers with fallback

### monitoring/
- **TokenMonitor.ts**: Tracks token usage and costs

### controller/
- **StopController.ts**: Handles stop/pause/resume signals

