# Wukong Engine Implementation Plan

> A step-by-step plan to build the Wukong Agent Library from scratch

**Created:** November 12, 2025  
**Status:** Ready for Implementation

---

## Table of Contents

- [Phase 1: Foundation & Setup](#phase-1-foundation--setup)
- [Phase 2: Core Agent System](#phase-2-core-agent-system)
- [Phase 3: Tools & Knowledge Base](#phase-3-tools--knowledge-base)
- [Phase 4: Advanced Features](#phase-4-advanced-features)
- [Phase 5: Optimization & Polish](#phase-5-optimization--polish)
- [Phase 6: Documentation & Examples](#phase-6-documentation--examples)

---

## Phase 1: Foundation & Setup

### Task 1.1: Project Initialization ✅

**Purpose:** Set up the monorepo structure with all necessary packages and development tools.

**Referenced Documentation:**
- `docs/implementation/recommended-libraries.md` - Package architecture
- `docs/design/02-architecture.md` - Layered architecture

**Steps:**
1. Initialize pnpm workspace with the following packages:
   - `packages/agent` (core library)
   - `packages/llm-openai`
   - `packages/llm-anthropic`
   - `packages/llm-google`
   - `packages/adapter-vercel`
   - `packages/adapter-local`
   - `packages/documents` (optional)
   - `packages/embeddings` (optional)
   - `packages/ui` (optional)

2. Configure TypeScript with strict settings
3. Set up tsup for building
4. Configure Vitest for testing
5. Set up Biome for linting and formatting

**Tests:**
- Build all packages successfully
- Run linters without errors
- Type checking passes

**Verify Steps:**
```bash
pnpm install
pnpm build
pnpm test
pnpm lint
```

---

### Task 1.2: Core Types and Interfaces ✅

**Purpose:** Define TypeScript types and interfaces that will be used throughout the system.

**Referenced Documentation:**
- `docs/design/03-interfaces.md` - Core interface design
- `docs/design/02-architecture.md` - Component interfaces

**Implementation:**
1. Create `packages/agent/src/types/index.ts`:
   - `Session` interface
   - `Step` interface
   - `Todo` interface
   - `Tool` interface
   - `AgentConfig` interface
   - `TaskOptions` interface
   - Action types (`CallTool`, `CallToolsParallel`, `ForkAutoAgent`, etc.)

2. Create `packages/agent/src/types/adapters.ts`:
   - `StorageAdapter` interface
   - `CacheAdapter` interface
   - `FilesAdapter` interface
   - `VectorAdapter` interface

3. Create `packages/agent/src/types/events.ts`:
   - All event types with their payloads

**Tests:**
- Type definitions compile without errors
- Example usage compiles correctly
- All interfaces are properly exported

**Verify Steps:**
```typescript
// Create test file that imports and uses all types
import { Session, Step, Todo, Tool } from '@wukong/agent'
// Should compile without errors
```

---

### Task 1.3: Database Schema Implementation ✅

**Purpose:** Create database tables and indexes for data persistence.

**Referenced Documentation:**
- `docs/design/13-database-design.md` - Complete database schema

**Implementation:**
1. Create migration files in `packages/adapter-vercel/migrations/`:
   - `001_initial_schema.sql` - sessions, steps, todos, checkpoints
   - `002_parallel_execution.sql` - parallel_tool_calls
   - `003_agent_fork.sql` - fork_agent_tasks
   - `004_knowledge_base.sql` - knowledge_entities, knowledge_feedback

2. Create `packages/adapter-local/migrations/` with SQLite-compatible versions

3. Implement migration runner utility

**Tests:**
- Migrations run successfully on fresh database
- All indexes are created
- Foreign key constraints work correctly
- Can rollback migrations

**Verify Steps:**
```bash
# Test with Vercel Postgres
cd packages/adapter-vercel
pnpm migrate

# Test with local SQLite
cd packages/adapter-local
pnpm migrate

# Verify schema
pnpm migrate:status
```


---

## Phase 2: Core Agent System

### Task 2.1: Event System ✅

**Purpose:** Implement the event emission and listening system for agent visibility.

**Referenced Documentation:**
- `docs/design/03-interfaces.md` - Event listening
- `docs/design/01-core-concepts.md` - Visibility principle

**Implementation:**
1. Create `packages/agent/src/EventEmitter.ts`:
   - Extend `eventemitter3`
   - Add typed event methods
   - Implement error handling for listeners

2. Define all event types in `src/events/types.ts`

3. Create event helper utilities

**Tests:**
- Event emission works correctly
- Multiple listeners can subscribe to same event
- Event payloads have correct types
- Error in one listener doesn't affect others
- Memory leaks are prevented (listeners cleanup)

**Verify Steps:**
```typescript
const agent = new WukongAgent(config)

// Test event listening
agent.on('step:started', (step) => {
  console.log('Step started:', step)
})

agent.on('step:completed', (step) => {
  console.log('Step completed:', step)
})

// Should emit events during execution
await agent.execute({ goal: 'test' })
```


---

### Task 2.2: Storage Adapter - Vercel ✅

**Purpose:** Implement Vercel Postgres + KV adapter for production deployment.

**Referenced Documentation:**
- `docs/design/10-implementation.md` - Data persistence
- `docs/design/appendix-adapters.md` (if exists)

**Implementation:**
1. Create `packages/adapter-vercel/src/VercelStorageAdapter.ts`:
   - Implement `StorageAdapter` interface
   - Use `@vercel/postgres` for structured data
   - Session CRUD operations
   - Steps CRUD operations
   - Todos CRUD operations

2. Create `packages/adapter-vercel/src/VercelCacheAdapter.ts`:
   - Implement `CacheAdapter` interface
   - Use `@vercel/kv` for temporary state
   - Async task queue support

3. Create `packages/adapter-vercel/src/VercelBlobAdapter.ts`:
   - Implement `FilesAdapter` interface
   - Use `@vercel/blob` for file storage

**Tests:**
- Save and retrieve sessions
- Save and retrieve steps with JSONB
- Cache operations (set, get, delete, expire)
- Transaction support for atomic operations
- Connection pooling works correctly

**Verify Steps:**
```typescript
const adapter = new VercelStorageAdapter({
  postgres: process.env.POSTGRES_URL,
  kv: process.env.KV_URL,
  blob: process.env.BLOB_READ_WRITE_TOKEN
})

// Test CRUD operations
const sessionId = await adapter.createSession({ goal: 'test' })
const session = await adapter.getSession(sessionId)
expect(session.goal).toBe('test')
```


---

### Task 2.3: Storage Adapter - Local ✅

**Purpose:** Implement SQLite + file system adapter for local development.

**Referenced Documentation:**
- `docs/design/10-implementation.md` - Data persistence

**Implementation:**
1. Create `packages/adapter-local/src/LocalStorageAdapter.ts`:
   - Use `better-sqlite3` for SQLite
   - Implement same interface as Vercel adapter
   - Use in-memory cache as fallback

2. Create `packages/adapter-local/src/LocalFilesAdapter.ts`:
   - Use Node.js `fs` for file operations

**Tests:**
- Same test suite as Vercel adapter
- Works without external dependencies
- Data persists between restarts
- File operations are atomic

**Verify Steps:**
```typescript
const adapter = new LocalStorageAdapter({
  dbPath: './data/wukong.db',
  filesPath: './data/files'
})

// Should work identically to Vercel adapter
const sessionId = await adapter.createSession({ goal: 'test' })
```


---

### Task 2.4: LLM Integration - OpenAI ✅

**Purpose:** Implement OpenAI LLM caller with streaming support.

**Referenced Documentation:**
- `docs/design/10-implementation.md` - LLM streaming output
- `docs/design/14-implementation-patterns.md` - Multi-model calling

**Implementation:**
1. Create `packages/llm-openai/src/OpenAIAdapter.ts`:
   - Implement `LLMAdapter` interface
   - Support streaming responses
   - Handle rate limits and retries
   - Token counting with tiktoken

2. Add response parsing utilities

**Tests:**
- Call OpenAI API successfully
- Streaming chunks are emitted correctly
- Retries on rate limits
- Token counting is accurate
- Error handling for invalid API keys

**Verify Steps:**
```typescript
const llm = new OpenAILLMAdapter({
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-5.1-instant'
})

const response = await llm.call('Test prompt')
expect(response).toBeDefined()

// Test streaming
let chunks = []
await llm.callWithStreaming('Test', {
  onChunk: (chunk) => chunks.push(chunk),
  onComplete: (full) => console.log('Done')
})
expect(chunks.length).toBeGreaterThan(0)
```


---

### Task 2.5: LLM Integration - Anthropic Claude ✅

**Purpose:** Implement Anthropic Claude as premium LLM provider with best-in-class coding capabilities.

**Referenced Documentation:**
- `docs/design/10-implementation.md` - LLM streaming output
- `docs/design/14-implementation-patterns.md` - Multi-model calling

**Implementation:**
1. Create `packages/llm-anthropic/src/ClaudeAdapter.ts`:
   - Implement `LLMAdapter` interface
   - Use `@anthropic-ai/sdk` official SDK
   - Support streaming responses
   - Handle Claude-specific features (200K context window)
   - Support both Claude Sonnet 4.5 and Haiku 4.5

2. Add response parsing utilities
3. Handle rate limits and retries

**Tests:**
- Call Anthropic API successfully
- Streaming chunks are emitted correctly
- Retries on rate limits
- Token counting is accurate
- Error handling for invalid API keys
- Both Sonnet and Haiku models work

**Verify Steps:**
```typescript
const llm = new ClaudeAdapter({
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-sonnet-4.5'
})

const response = await llm.call('Test prompt')
expect(response).toBeDefined()

// Test streaming
let chunks = []
await llm.callWithStreaming('Test', {
  onChunk: (chunk) => chunks.push(chunk),
  onComplete: (full) => console.log('Done')
})
expect(chunks.length).toBeGreaterThan(0)

// Test Haiku model
const haikuLLM = new ClaudeAdapter({
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-haiku-4.5'
})
const haikuResponse = await haikuLLM.call('Quick test')
expect(haikuResponse).toBeDefined()
```

**Key Features:**
- Claude Sonnet 4.5: Best coding performance (82% on SWE-bench)
- Claude Haiku 4.5: 2x faster, 1/3 cost of Sonnet
- 200K context window support
- Extended autonomous working time (30+ hours)
- Message batching support
- System prompt support

---

### Task 2.6: LLM Integration - Google Gemini ✅

**Purpose:** Implement Google Gemini as alternative LLM provider.

**Referenced Documentation:**
- `docs/design/14-implementation-patterns.md` - Multi-model fallback

**Implementation:**
1. Create `packages/llm-google/src/GeminiAdapter.ts`:
   - Implement same `LLMAdapter` interface
   - Use `@google/generative-ai`
   - Handle Gemini-specific features (2M context)
   - Support streaming responses
   - Token counting with Gemini API
   - Support both Gemini 2.0 and 1.5 models

**Tests:**
- Same test suite as OpenAI adapter
- Falls back correctly in multi-model setup

**Verify Steps:**
```typescript
const llm = new GeminiAdapter({
  apiKey: process.env.GOOGLE_AI_API_KEY,
  model: 'gemini-2.0-flash-exp'
})

const response = await llm.call('Test prompt')
expect(response).toBeDefined()

// Test streaming
let chunks = []
await llm.callWithStreaming('Test', {
  streaming: {
    onChunk: (chunk) => chunks.push(chunk),
    onComplete: (full) => console.log('Done')
  }
})
expect(chunks.length).toBeGreaterThan(0)
```

**Key Features:**
- **Gemini 2.5 Pro**: Latest model with 2M context window, 40% faster inference, 25% higher accuracy
- Gemini 2.0 Flash: 1M context window (experimental)
- Gemini 2.0 Pro: 2M context window (experimental)
- Enhanced multimodal support (text, images, audio, video, code)
- Function calling support
- System instruction support
- Superior coding capabilities
- **Note**: Only supports Gemini 2.0+ models (1.5 models deprecated)

---

### Task 2.7: Multi-Model LLM Caller ✅

**Purpose:** Implement fallback mechanism for calling multiple LLM providers.

**Referenced Documentation:**
- `docs/design/14-implementation-patterns.md` - Multi-model LLM calling

**Implementation:**
1. Create `packages/agent/src/llm/MultiModelCaller.ts`:
   - Try models in order
   - Fallback on failures
   - Response validation
   - JSON extraction from various formats

**Tests:**
- Falls back to next model on failure
- Returns first successful response
- All models failing throws error
- Response validation works

**Verify Steps:**
```typescript
const caller = new MultiModelCaller({
  models: [
    new ClaudeAdapter({ apiKey: '...', model: 'claude-sonnet-4.5' }),
    new GeminiAdapter({ apiKey: '...', model: 'gemini-2.0-flash-exp' }),
    new OpenAIAdapter({ apiKey: '...', model: 'gpt-5.1-instant' })
  ]
})

// Should try Claude first, fall back to Gemini, then OpenAI if needed
const response = await caller.call('Test prompt')
```

**Key Features:**
- Automatic fallback on LLM failures
- Error classification (retryable vs non-retryable)
- Exponential backoff retry logic
- Response validation
- JSON extraction from XML tags, code blocks, and plain JSON
- Support for both simple prompts and chat messages

---

### Task 2.8: Prompt Builder ✅

**Purpose:** Build structured prompts for LLM with all required context.

**Referenced Documentation:**
- `docs/design/12-prompt-engineering.md` - Complete prompt structure
- `docs/design/08-token-optimization.md` - Token efficiency

**Implementation:**
1. Create `packages/agent/src/prompt/PromptBuilder.ts`:
   - Build complete prompt from context
   - Include system instructions
   - Format tools list (MCP mode)
   - Include knowledge snippets
   - Format history (exclude discarded steps)
   - Add examples

2. Create prompt templates for:
   - InteractiveAgent
   - AutoAgent
   - Different action types

**Tests:**
- Prompt includes all required sections
- MCP mode reduces token count
- History formatting is correct
- Examples are included appropriately
- Token count estimation is accurate

**Verify Steps:**
```typescript
const builder = new PromptBuilder({
  agentType: 'AutoAgent',
  enableMCP: true
})

const prompt = builder.build({
  goal: 'Test goal',
  history: steps,
  knowledge: knowledgeResults,
  tools: availableTools
})

// Verify prompt structure
expect(prompt).toContain('<goal_description>')
expect(prompt).toContain('<all_tool_list>')
expect(prompt).toContain('<history>')
```

---

### Task 2.9: Agent Response Parser

**Purpose:** Parse and validate LLM responses to extract agent decisions.

**Referenced Documentation:**
- `docs/design/12-prompt-engineering.md` - Response format
- `docs/design/14-implementation-patterns.md` - Response extraction

**Implementation:**
1. Create `packages/agent/src/parser/ResponseParser.ts`:
   - Extract JSON from `<final_output>` tags
   - Validate required fields
   - Validate action-specific fields
   - Use Zod for schema validation

2. Create Zod schemas for each action type

**Tests:**
- Extracts JSON from XML tags correctly
- Extracts JSON from code blocks
- Validates required fields
- Throws descriptive errors for invalid responses
- Handles edge cases (malformed JSON, missing tags)

**Verify Steps:**
```typescript
const parser = new ResponseParser()

const llmOutput = `
<final_output>
{
  "action": "CallTool",
  "reasoning": "Test",
  "selected_tool": "test_tool",
  "parameters": {}
}
</final_output>
`

const parsed = parser.parse(llmOutput)
expect(parsed.action).toBe('CallTool')
expect(parsed.selected_tool).toBe('test_tool')
```

---

### Task 2.10: Session Manager

**Purpose:** Manage agent session lifecycle (create, resume, stop, restore).

**Referenced Documentation:**
- `docs/design/03-interfaces.md` - Session management
- `docs/design/02-architecture.md` - Session lifecycle

**Implementation:**
1. Create `packages/agent/src/session/SessionManager.ts`:
   - Create new sessions
   - Resume existing sessions
   - Save session state
   - Load session history
   - Handle session cleanup

2. Implement checkpoint system for undo/restore

**Tests:**
- Create and retrieve sessions
- Resume sessions with correct state
- Session history is preserved
- Checkpoints work correctly
- Concurrent session access is safe

**Verify Steps:**
```typescript
const manager = new SessionManager(storageAdapter)

// Create session
const session = await manager.createSession({
  goal: 'Test goal',
  userId: 'user-123'
})

// Resume session
const resumed = await manager.resumeSession(session.id)
expect(resumed.goal).toBe('Test goal')

// Create checkpoint
await manager.createCheckpoint(session.id, { name: 'Test checkpoint' })
```

---

### Task 2.11: Step Executor

**Purpose:** Execute individual steps including tool calls and LLM interactions.

**Referenced Documentation:**
- `docs/design/02-architecture.md` - Core workflows
- `docs/design/03-interfaces.md` - Task execution

**Implementation:**
1. Create `packages/agent/src/executor/StepExecutor.ts`:
   - Execute `CallTool` action
   - Execute `CallToolsParallel` action
   - Execute `ForkAutoAgent` action
   - Execute `AskUser` action (InteractiveAgent)
   - Execute `Plan` action
   - Execute `Finish` action

2. Save step results to database
3. Emit events for each step

**Tests:**
- Each action type executes correctly
- Step results are saved
- Events are emitted
- Errors are handled gracefully
- State is consistent after errors

**Verify Steps:**
```typescript
const executor = new StepExecutor(storageAdapter, toolRegistry)

const step: Step = {
  action: 'CallTool',
  selected_tool: 'test_tool',
  parameters: { test: 'value' }
}

const result = await executor.execute(session.id, step)
expect(result.success).toBe(true)
```

---

### Task 2.12: Stop Controller

**Purpose:** Allow users to safely stop agent execution at any time.

**Referenced Documentation:**
- `docs/design/09-trustworthiness.md` - Stop button anytime
- `docs/design/10-implementation.md` - Stop mechanism

**Implementation:**
1. Create `packages/agent/src/controller/StopController.ts`:
   - Request stop (graceful or immediate)
   - Check if should stop
   - Confirm stop after completing step
   - Save partial results

**Tests:**
- Graceful stop completes current step
- Immediate stop stops right away
- Partial results are saved
- Session can be resumed after stop

**Verify Steps:**
```typescript
const controller = new StopController()

// In agent execution loop
if (controller.shouldStop()) {
  // Stop execution
  break
}

// User requests stop
controller.requestStop(graceful: true)

// Agent checks and confirms
if (controller.hasStopRequest()) {
  controller.confirmStop()
}
```

---

### Task 2.13: InteractiveAgent Implementation

**Purpose:** Implement the interactive agent that requires user confirmation after each step.

**Referenced Documentation:**
- `docs/design/02-architecture.md` - InteractiveAgent mode
- `docs/design/12-prompt-engineering.md` - InteractiveAgent prompts

**Implementation:**
1. Create `packages/agent/src/agents/InteractiveAgent.ts`:
   - Main execution loop
   - Wait for user confirmation after each tool call
   - Handle user modifications to plan
   - Emit `AskUser` events

**Tests:**
- Execution pauses after each tool call
- User confirmation is required
- User can modify direction
- User can stop at any time
- State is preserved during pauses

**Verify Steps:**
```typescript
const agent = new InteractiveAgent(config)

let confirmations = 0
agent.on('tool:requiresConfirmation', async () => {
  confirmations++
  return true // User confirms
})

await agent.execute({ goal: 'Test goal' })
expect(confirmations).toBeGreaterThan(0)
```

---

### Task 2.14: AutoAgent Implementation

**Purpose:** Implement the autonomous agent that runs continuously until completion.

**Referenced Documentation:**
- `docs/design/02-architecture.md` - AutoAgent mode
- `docs/design/12-prompt-engineering.md` - AutoAgent prompts

**Implementation:**
1. Create `packages/agent/src/agents/AutoAgent.ts`:
   - Main execution loop
   - First step always searches knowledge base
   - No user confirmation needed
   - Respects maxSteps limit
   - Handles timeout

**Tests:**
- Runs autonomously without user input
- First step searches knowledge base
- Respects maxSteps limit
- Stops on timeout
- Can be stopped manually

**Verify Steps:**
```typescript
const agent = new AutoAgent(config)

// Should run to completion without interaction
const result = await agent.execute({
  goal: 'Analyze data',
  maxSteps: 20,
  timeout: 300
})

expect(result.status).toBe('completed')
```

---

### Task 2.15: Main WukongAgent Class

**Purpose:** Create the main agent class that ties everything together.

**Referenced Documentation:**
- `docs/design/03-interfaces.md` - Agent initialization and interfaces
- `docs/design/02-architecture.md` - Wukong Core

**Implementation:**
1. Create `packages/agent/src/WukongAgent.ts`:
   - Initialize all components
   - Choose InteractiveAgent or AutoAgent based on mode
   - Expose public API
   - Emit events
   - Handle configuration

2. Export as main entry point

**Tests:**
- Agent initializes correctly
- Can execute tasks in both modes
- Events are emitted correctly
- Configuration is validated
- All features are accessible

**Verify Steps:**
```typescript
import { WukongAgent } from '@wukong/agent'

const agent = new WukongAgent({
  llmKey: process.env.OPENAI_API_KEY,
  adapter: storageAdapter,
  tools: { path: './tools' }
})

const result = await agent.execute({
  goal: 'Test goal',
  mode: 'interactive'
})

expect(result).toBeDefined()
```

---

## Phase 3: Tools & Knowledge Base

### Task 3.1: Tool Registry

**Purpose:** Discover, register, and manage available tools.

**Referenced Documentation:**
- `docs/design/05-tools-system.md` - Tool definition and discovery
- `docs/design/08-token-optimization.md` - MCP Code Execution

**Implementation:**
1. Create `packages/agent/src/tools/ToolRegistry.ts`:
   - Auto-discover tools from directory
   - Load tool metadata
   - Load tool schemas
   - Register tools dynamically
   - List available tools (MCP format)

2. Create tool loader utilities

**Tests:**
- Auto-discovers tools in directory
- Loads metadata and schemas correctly
- Can register tools dynamically
- Lists tools in MCP format (names + params only)
- Validates tool definitions

**Verify Steps:**
```typescript
const registry = new ToolRegistry({ path: './tools' })

await registry.discover()

const tools = registry.listTools()
expect(tools.length).toBeGreaterThan(0)

const tool = registry.getTool('test_tool')
expect(tool.metadata).toBeDefined()
expect(tool.schema).toBeDefined()
```

---

### Task 3.2: Tool Executor

**Purpose:** Execute tools with parameter validation and error handling.

**Referenced Documentation:**
- `docs/design/05-tools-system.md` - Tool execution
- `docs/design/08-token-optimization.md` - MCP result summary

**Implementation:**
1. Create `packages/agent/src/tools/ToolExecutor.ts`:
   - Validate parameters against schema
   - Execute tool handler
   - Generate result summary (for MCP mode)
   - Handle errors
   - Support async tools

**Tests:**
- Parameter validation works
- Tool execution succeeds
- Result summary is generated
- Errors are caught and sanitized
- Async tools return task IDs

**Verify Steps:**
```typescript
const executor = new ToolExecutor(registry)

const result = await executor.execute({
  tool: 'test_tool',
  params: { test: 'value' }
})

expect(result.success).toBe(true)
expect(result.summary).toBeDefined()
```

---

### Task 3.3: Async Tool Executor

**Purpose:** Handle long-running tools that execute asynchronously.

**Referenced Documentation:**
- `docs/design/05-tools-system.md` - Async tool execution
- `docs/design/14-implementation-patterns.md` - Async tool patterns

**Implementation:**
1. Create `packages/agent/src/tools/AsyncToolExecutor.ts`:
   - Submit async tasks
   - Track task status in cache
   - Poll external APIs
   - Handle webhooks
   - Notify on completion

2. Create polling worker utilities

**Tests:**
- Task submission works
- Polling updates status correctly
- Webhooks are handled
- Completion notification fires
- Failed tasks are handled

**Verify Steps:**
```typescript
const executor = new AsyncToolExecutor(cacheAdapter)

const taskId = await executor.executeAsync(
  asyncTool,
  params,
  { sessionId, stepId }
)

// Poll until complete
const task = await executor.pollTask(taskId)
expect(task.status).toBe('completed')
```

---

### Task 3.4: Parallel Tool Executor

**Purpose:** Execute multiple tools simultaneously with different wait strategies.

**Referenced Documentation:**
- `docs/design/06-advanced-features.md` - Parallel tool execution
- `docs/design/13-database-design.md` - parallel_tool_calls table

**Implementation:**
1. Create `packages/agent/src/tools/ParallelToolExecutor.ts`:
   - Launch multiple tools in parallel
   - Track individual tool status
   - Check wait strategy (`all`, `any`, `majority`)
   - Collect results when condition is met

**Tests:**
- Multiple tools execute in parallel
- `all` strategy waits for all tools
- `any` strategy continues after first completion
- `majority` strategy waits for >50%
- Failed tools are handled correctly

**Verify Steps:**
```typescript
const executor = new ParallelToolExecutor(toolExecutor)

const results = await executor.executeParallel({
  tools: [
    { toolName: 'tool1', params: {}, toolId: 't1' },
    { toolName: 'tool2', params: {}, toolId: 't2' },
    { toolName: 'tool3', params: {}, toolId: 't3' }
  ],
  waitStrategy: 'all'
})

expect(results.completed.length).toBe(3)
```

---

### Task 3.5: Document Processor (Optional Package)

**Purpose:** Extract text from various document formats for knowledge base indexing.

**Referenced Documentation:**
- `docs/design/04-knowledge-base.md` - Supported document formats
- `docs/implementation/recommended-libraries.md` - Document processing

**Implementation:**
1. Create `packages/documents/src/extractors/`:
   - `PdfExtractor.ts` - Extract text from PDFs
   - `DocxExtractor.ts` - Extract text from Word docs
   - `MarkdownExtractor.ts` - Parse markdown with frontmatter
   - `HtmlExtractor.ts` - Extract text from HTML
   - `TxtExtractor.ts` - Read plain text

2. Create unified `DocumentProcessor` class

**Tests:**
- Each extractor handles its format correctly
- Text extraction preserves structure
- Metadata is extracted (title, author, etc.)
- Large documents are handled efficiently

**Verify Steps:**
```typescript
const processor = new DocumentProcessor()

const text = await processor.extract('./test.pdf')
expect(text).toBeDefined()
expect(text.length).toBeGreaterThan(0)
```

---

### Task 3.6: Document Chunker

**Purpose:** Split documents into chunks with overlap for vector indexing.

**Referenced Documentation:**
- `docs/design/04-knowledge-base.md` - Chunking strategy

**Implementation:**
1. Create `packages/documents/src/chunking/DocumentChunker.ts`:
   - Split by character count
   - Preserve paragraph boundaries
   - Add overlap between chunks
   - Preserve metadata for each chunk

**Tests:**
- Documents are split correctly
- Overlap is applied
- Chunk size respects limits
- Metadata is preserved
- Headers/structure is preserved

**Verify Steps:**
```typescript
const chunker = new DocumentChunker({
  chunkSize: 1000,
  overlap: 200
})

const chunks = await chunker.chunk(documentText)
expect(chunks.length).toBeGreaterThan(0)
expect(chunks[0].text.length).toBeLessThanOrEqual(1000)
```

---

### Task 3.7: Embedding Generator (Optional Package)

**Purpose:** Generate vector embeddings for semantic search.

**Referenced Documentation:**
- `docs/design/04-knowledge-base.md` - Generate embeddings
- `docs/implementation/recommended-libraries.md` - Embedding generation

**Implementation:**
1. Create `packages/embeddings/src/OpenAIEmbeddings.ts`:
   - Use OpenAI embeddings API
   - Batch multiple texts
   - Handle rate limits

2. Create unified `EmbeddingGenerator` interface

**Tests:**
- Embeddings are generated correctly
- Batch processing works
- Rate limits are handled
- Vector dimensions are correct (1536 for ada-002)

**Verify Steps:**
```typescript
const generator = new OpenAIEmbeddings({
  apiKey: process.env.OPENAI_API_KEY
})

const embedding = await generator.generate('Test text')
expect(embedding.length).toBe(1536)
```

---

### Task 3.8: Vector Storage Adapter

**Purpose:** Store and search vectors using pgvector or alternative vector database.

**Referenced Documentation:**
- `docs/design/04-knowledge-base.md` - Vector retrieval
- `docs/design/10-implementation.md` - Vector retrieval implementation

**Implementation:**
1. Create `packages/adapter-vercel/src/VectorAdapter.ts`:
   - Store vectors in Postgres with pgvector
   - Vector similarity search
   - Filter by permissions
   - Hybrid search (vector + keyword)

**Tests:**
- Vectors are stored correctly
- Similarity search returns relevant results
- Filters work (user, org, public)
- Performance is acceptable (< 100ms for search)

**Verify Steps:**
```typescript
const adapter = new VercelVectorAdapter(postgresUrl)

await adapter.upsert({
  id: 'doc1',
  vector: embedding,
  metadata: { content: 'test', level: 'public' }
})

const results = await adapter.search(queryEmbedding, { topK: 5 })
expect(results.length).toBeLessThanOrEqual(5)
```

---

### Task 3.9: Knowledge Base Manager

**Purpose:** High-level interface for indexing and searching knowledge.

**Referenced Documentation:**
- `docs/design/04-knowledge-base.md` - Complete knowledge base system

**Implementation:**
1. Create `packages/agent/src/knowledge/KnowledgeBaseManager.ts`:
   - Index documents (scan, chunk, embed, store)
   - Search for relevant knowledge
   - Update and delete documents
   - Handle permissions

**Tests:**
- Documents are indexed correctly
- Search returns relevant results
- Permissions are enforced
- Incremental updates work
- Deduplication works

**Verify Steps:**
```typescript
const kb = new KnowledgeBaseManager({
  filesAdapter,
  vectorAdapter,
  embeddingGenerator
})

// Index documents
await kb.indexDocuments('./knowledge')

// Search
const results = await kb.search({
  query: 'How to use tools',
  topK: 5,
  filters: { userId: 'user-123' }
})

expect(results.length).toBeGreaterThan(0)
```

---

### Task 3.10: Knowledge Extraction

**Purpose:** Automatically extract knowledge from completed sessions.

**Referenced Documentation:**
- `docs/design/04-knowledge-base.md` - Automated knowledge extraction

**Implementation:**
1. Create `packages/agent/src/knowledge/KnowledgeExtractor.ts`:
   - Extract knowledge from conversation history
   - Classify by level (public, organization, individual)
   - Generate embeddings
   - Deduplicate with existing knowledge
   - Store to knowledge base

**Tests:**
- Knowledge is extracted from sessions
- Classification is correct
- Deduplication works
- Only valuable knowledge is stored

**Verify Steps:**
```typescript
const extractor = new KnowledgeExtractor(kb, llm)

await extractor.extractFromSession(sessionId)

// Verify knowledge was stored
const knowledge = await kb.search({
  query: 'test',
  filters: { sessionId }
})
expect(knowledge.length).toBeGreaterThan(0)
```

---

## Phase 4: Advanced Features

### Task 4.1: Todo Manager

**Purpose:** Generate, track, and update task lists.

**Referenced Documentation:**
- `docs/design/07-todo-list.md` - Complete todo system
- `docs/design/13-database-design.md` - todos table

**Implementation:**
1. Create `packages/agent/src/todo/TodoManager.ts`:
   - Generate todos from goal (using LLM)
   - Track progress
   - Update todo status
   - Calculate overall progress
   - Handle dependencies

**Tests:**
- Todos are generated from goals
- Progress tracking is accurate
- Dependencies are respected
- Events are emitted
- Dynamic updates work

**Verify Steps:**
```typescript
const manager = new TodoManager(storageAdapter, llm)

const todos = await manager.generateTodos('Analyze sales.csv')
expect(todos.length).toBeGreaterThan(0)

await manager.markCompleted(todos[0].id)
const progress = await manager.getProgress(sessionId)
expect(progress).toBeGreaterThan(0)
```

---

### Task 4.2: Agent Fork Implementation

**Purpose:** Allow agents to spawn sub-agents for complex sub-tasks.

**Referenced Documentation:**
- `docs/design/06-advanced-features.md` - Agent Fork
- `docs/design/13-database-design.md` - fork_agent_tasks table

**Implementation:**
1. Create `packages/agent/src/fork/AgentFork.ts`:
   - Create sub-agent with compressed context
   - Track sub-agent execution
   - Compress results for parent
   - Handle depth limits
   - Handle timeouts

**Tests:**
- Sub-agent is created correctly
- Context is compressed
- Sub-agent executes independently
- Results are compressed
- Depth limits are enforced
- Parent receives sub-agent results

**Verify Steps:**
```typescript
const subAgentId = await agent.forkAutoAgent({
  goal: 'Generate video script',
  contextSummary: 'Product is AI assistant',
  maxDepth: 3,
  maxSteps: 20,
  timeout: 300
})

// Wait for sub-agent
agent.on('subagent:completed', (result) => {
  expect(result.summary).toBeDefined()
})
```

---

### Task 4.3: Context Compression

**Purpose:** Compress conversation history for sub-agents and token optimization.

**Referenced Documentation:**
- `docs/design/14-implementation-patterns.md` - Context compression

**Implementation:**
1. Create `packages/agent/src/compression/ContextCompressor.ts`:
   - Use LLM to summarize history
   - Extract key facts and decisions
   - Maintain critical information
   - Target specific token count

**Tests:**
- Compression reduces token count significantly
- Key information is preserved
- Summary is coherent
- Different compression ratios work

**Verify Steps:**
```typescript
const compressor = new ContextCompressor(llm)

const compressed = await compressor.compress(history, {
  maxTokens: 500
})

expect(compressed.length).toBeLessThan(originalLength)
// Verify key information is preserved
expect(compressed).toContain('key decision')
```

---

### Task 4.4: Step Discarding

**Purpose:** Allow LLM to mark unnecessary steps for token optimization.

**Referenced Documentation:**
- `docs/design/08-token-optimization.md` - Smart step discarding
- `docs/design/12-prompt-engineering.md` - Step discarding rules

**Implementation:**
1. Implement in `PromptBuilder`:
   - Include step discarding instructions in prompt
   - Explain what can/cannot be discarded

2. Implement in `SessionManager`:
   - Process `discardableSteps` from LLM response
   - Mark steps as discarded in database
   - Exclude discarded steps from future prompts

**Tests:**
- LLM marks steps as discardable
- Discarded steps are excluded from prompts
- Token count is reduced
- Important steps are never discarded

**Verify Steps:**
```typescript
// In agent execution
const response = await llm.call(prompt)
const parsed = parser.parse(response)

if (parsed.discardableSteps) {
  await sessionManager.markStepsAsDiscarded(
    sessionId,
    parsed.discardableSteps
  )
}

// Verify discarded steps not in next prompt
const nextPrompt = promptBuilder.build(context)
expect(nextPrompt).not.toContain('discarded step content')
```

---

### Task 4.5: MCP Code Execution Mode

**Purpose:** Reduce token usage by sending tool names only, not full schemas.

**Referenced Documentation:**
- `docs/design/08-token-optimization.md` - MCP Code Execution

**Implementation:**
1. Update `PromptBuilder`:
   - MCP mode: send only tool names and brief descriptions
   - Traditional mode: send full schemas

2. Update `ToolExecutor`:
   - Validate parameters using local schema

**Tests:**
- MCP mode reduces token count significantly (>90%)
- Tool execution still works correctly
- Parameter validation catches errors
- Both modes produce same results

**Verify Steps:**
```typescript
const builder = new PromptBuilder({ enableMCP: true })
const prompt = builder.build(context)

// Count tokens
const mcpTokens = countTokens(prompt)

// Compare with traditional mode
const traditionalBuilder = new PromptBuilder({ enableMCP: false })
const traditionalPrompt = traditionalBuilder.build(context)
const traditionalTokens = countTokens(traditionalPrompt)

expect(mcpTokens).toBeLessThan(traditionalTokens * 0.1)
```

---

### Task 4.6: Skills System (Optional)

**Purpose:** Lazy-load relevant skills documentation to reduce token usage.

**Referenced Documentation:**
- `docs/design/08-token-optimization.md` - Skills lazy loading

**Implementation:**
1. Create `packages/agent/src/skills/SkillsRegistry.ts`:
   - Load skill metadata at startup
   - Match relevant skills based on query
   - Lazy load skill documentation
   - Include only matched skills in prompt

**Tests:**
- Skills are discovered correctly
- Matching works (keyword + semantic)
- Only matched skills are loaded
- Token count is reduced significantly

**Verify Steps:**
```typescript
const registry = new SkillsRegistry({ path: './skills' })

const matched = await registry.match('analyze Excel data')
expect(matched.length).toBeLessThan(totalSkills.length)
expect(matched.some(s => s.name === 'excel-handler')).toBe(true)
```

---

## Phase 5: Optimization & Polish

### Task 5.1: Error Handling and Retry

**Purpose:** Implement robust error handling with automatic retries.

**Referenced Documentation:**
- `docs/design/14-implementation-patterns.md` - Error handling and retry

**Implementation:**
1. Create `packages/agent/src/utils/retry.ts`:
   - Retry decorator with exponential backoff
   - Error classification (retryable vs non-retryable)
   - Error sanitization

2. Apply to all external API calls

**Tests:**
- Retries on transient errors
- Doesn't retry on permanent errors
- Backoff timing is correct
- Error messages are sanitized
- Max retries is respected

**Verify Steps:**
```typescript
const result = await withRetry(
  () => unreliableAPICall(),
  {
    maxAttempts: 3,
    backoffMs: 1000,
    backoffMultiplier: 2,
    retryableErrors: (error) => error.code === 'NETWORK_ERROR'
  }
)
```

---

### Task 5.2: Rate Limiting

**Purpose:** Prevent abuse and respect API rate limits.

**Referenced Documentation:**
- `docs/design/14-implementation-patterns.md` - Rate limiting

**Implementation:**
1. Create `packages/agent/src/utils/RateLimiter.ts`:
   - Track requests per user/action
   - Sliding window algorithm
   - Store state in cache

**Tests:**
- Rate limits are enforced
- Sliding window works correctly
- Different actions have different limits
- Resets after time window

**Verify Steps:**
```typescript
const limiter = new RateLimiter(cacheAdapter)

const allowed = await limiter.checkLimit(
  'user-123',
  'create_session',
  { requests: 10, windowSeconds: 60 }
)

expect(allowed).toBe(true)
```

---

### Task 5.3: Caching Strategy

**Purpose:** Cache expensive operations to improve performance.

**Referenced Documentation:**
- `docs/design/14-implementation-patterns.md` - Performance optimization

**Implementation:**
1. Create `packages/agent/src/utils/cache.ts`:
   - Cached decorator function
   - TTL support
   - Cache invalidation
   - Key generation

2. Apply to:
   - Knowledge base searches
   - Embedding generation
   - LLM calls (when appropriate)

**Tests:**
- Cache hit returns cached value
- Cache miss executes function
- TTL expiration works
- Cache invalidation works

**Verify Steps:**
```typescript
const cachedSearch = cached(
  async (query: string) => await kb.search(query),
  { ttl: 3600, keyPrefix: 'search' }
)

// First call executes
const result1 = await cachedSearch('test')

// Second call returns from cache
const result2 = await cachedSearch('test')
```

---

### Task 5.4: Token Counting and Monitoring

**Purpose:** Track token usage and cost for optimization.

**Referenced Documentation:**
- `docs/design/08-token-optimization.md` - Token usage monitoring

**Implementation:**
1. Create `packages/agent/src/monitoring/TokenMonitor.ts`:
   - Count tokens for prompts
   - Count tokens for responses
   - Calculate costs
   - Track savings from optimizations
   - Emit `tokens:used` events

**Tests:**
- Token counting is accurate
- Cost calculation is correct
- Savings are tracked
- Events are emitted

**Verify Steps:**
```typescript
const monitor = new TokenMonitor()

agent.on('tokens:used', (usage) => {
  console.log('Tokens:', usage.totalTokens)
  console.log('Cost:', usage.estimatedCost)
  console.log('Savings:', usage.savings)
})

await agent.execute({ goal: 'test' })
```

---

### Task 5.5: Concurrency Control

**Purpose:** Prevent race conditions and ensure data consistency.

**Referenced Documentation:**
- `docs/design/14-implementation-patterns.md` - Concurrency control

**Implementation:**
1. Create distributed locks using cache adapter
2. Implement database row locking where needed
3. Add lock utilities

**Tests:**
- Locks prevent concurrent modifications
- Locks are released on errors
- Lock timeouts work
- Deadlocks are prevented

**Verify Steps:**
```typescript
const lock = new DistributedLock(cacheAdapter)

await lock.withLock(`session:${sessionId}`, async () => {
  // Critical section - only one process at a time
  const session = await getSession(sessionId)
  session.status = 'running'
  await saveSession(session)
})
```

---

### Task 5.6: Batch Processing

**Purpose:** Batch multiple operations for better performance.

**Referenced Documentation:**
- `docs/design/14-implementation-patterns.md` - Batch operations

**Implementation:**
1. Create `packages/agent/src/utils/BatchProcessor.ts`:
   - Queue operations
   - Flush on batch size or timeout
   - Handle errors

2. Apply to embedding generation

**Tests:**
- Multiple calls are batched
- Flush on size works
- Flush on timeout works
- Errors don't affect other items

**Verify Steps:**
```typescript
const batcher = new BatchProcessor(
  async (items) => await generateEmbeddings(items),
  { maxBatchSize: 100, maxWaitMs: 100 }
)

// These three calls are batched into one API call
const e1 = await batcher.add('text 1')
const e2 = await batcher.add('text 2')
const e3 = await batcher.add('text 3')
```

---

### Task 5.7: Input Sanitization

**Purpose:** Prevent injection attacks and validate all inputs.

**Referenced Documentation:**
- `docs/design/14-implementation-patterns.md` - Security best practices

**Implementation:**
1. Create sanitization utilities
2. Apply to all user inputs
3. Apply to tool parameters
4. Apply to database queries

**Tests:**
- Malicious inputs are sanitized
- Valid inputs pass through
- SQL injection is prevented
- XSS is prevented

**Verify Steps:**
```typescript
const sanitized = sanitizeToolParameters(
  { prompt: '<script>alert("xss")</script>' },
  schema
)

expect(sanitized.prompt).not.toContain('<script>')
```

---

## Phase 6: Documentation & Examples

### Task 6.1: API Documentation

**Purpose:** Generate comprehensive API documentation for all public interfaces.

**Implementation:**
1. Add JSDoc comments to all public APIs
2. Generate documentation with TypeDoc
3. Create API reference website

**Verify Steps:**
- All public methods have JSDoc comments
- Documentation generates without errors
- Examples are included
- Type signatures are correct

---

### Task 6.2: Usage Examples

**Purpose:** Provide working examples for common use cases.

**Referenced Documentation:**
- `docs/design/11-examples.md` - Usage examples

**Implementation:**
1. Create example applications in `examples/`:
   - `examples/basic` - Simple agent usage
   - `examples/interactive` - InteractiveAgent with UI
   - `examples/auto` - AutoAgent with knowledge base
   - `examples/custom-adapter` - Custom storage adapter
   - `examples/custom-tools` - Custom tool creation

**Verify Steps:**
```bash
cd examples/basic
pnpm install
pnpm dev
# Should run successfully
```

---

### Task 6.3: Migration Guide

**Purpose:** Help users migrate from other agent frameworks.

**Implementation:**
1. Create migration guides:
   - From LangChain
   - From raw OpenAI API
   - From other agent frameworks

---

### Task 6.4: Tutorial Series

**Purpose:** Guide users through building real applications.

**Implementation:**
1. Create tutorials:
   - Building a document Q&A agent
   - Building a data analysis agent
   - Building a multi-agent system
   - Building custom tools
   - Deploying to production

---

## Testing Strategy

### Unit Tests

For each component:
- Test all public methods
- Test error cases
- Test edge cases
- Mock external dependencies
- Aim for >80% coverage

### Integration Tests

Test component interactions:
- Agent + Storage + LLM
- Agent + Tools + Knowledge Base
- Complete execution flows
- Error recovery scenarios

### End-to-End Tests

Test complete user scenarios:
- Create session → Execute task → Get result
- Interactive mode with user confirmations
- Auto mode with knowledge base search
- Agent fork with sub-tasks
- Stop and resume

### Performance Tests

- Token counting accuracy
- Cache hit rate
- Database query performance
- Vector search latency
- Concurrent request handling

---

## Deployment Checklist

### Before Production

- [ ] All tests pass
- [ ] Documentation is complete
- [ ] Examples work
- [ ] Security audit completed
- [ ] Performance benchmarks met
- [ ] Error handling is robust
- [ ] Monitoring is configured
- [ ] Rate limiting is enabled

### Production Deployment

1. Deploy to staging environment
2. Run smoke tests
3. Monitor for errors
4. Deploy to production
5. Monitor metrics:
   - Request rate
   - Error rate
   - Token usage
   - Response times
   - Cache hit rate

---

## Success Metrics

### Functionality
- All core features work as designed
- Test coverage >80%
- No critical bugs

### Performance
- Average response time < 2s
- Token optimization >90% vs traditional
- Cache hit rate >60%

### Developer Experience
- Easy to install (< 5 min)
- Easy to configure (< 10 lines)
- Good documentation
- Working examples

---


---

## Priority Levels

### P0 (Must Have - Minimum Viable Product)
- Phase 1: All tasks
- Phase 2: Tasks 2.1-2.15
- Phase 3: Tasks 3.1-3.3, 3.9
- Core agent functionality without advanced features

### P1 (Should Have - Full Feature Set)
- Phase 3: Tasks 3.4-3.8, 3.10
- Phase 4: All tasks
- Complete feature set as designed

### P2 (Nice to Have - Polish)
- Phase 5: All tasks
- Phase 6: All tasks
- Optimization and documentation

---

## Next Steps

1. **Review this plan** with the team
2. **Set up development environment** (Task 1.1)
3. **Start with Phase 1** foundation tasks
4. **Implement incrementally** and test thoroughly
5. **Iterate based on feedback**

---

## Questions to Resolve

Before starting implementation, clarify:

1. **Target Node.js version?** (Recommend: Node 18+)
2. **Browser support needed?** (Or Node.js only?)
3. **License?** (MIT recommended for library)
4. **Package registry?** (npm public or private?)
5. **Monorepo tool?** (pnpm workspaces recommended)
6. **CI/CD platform?** (GitHub Actions, GitLab CI, etc.)
7. **Hosting for docs?** (Vercel, Netlify, GitHub Pages?)

---

## Related Documentation

- [Core Design Principles](../design/01-core-concepts.md)
- [Architecture](../design/02-architecture.md)
- [Interfaces](../design/03-interfaces.md)
- [Knowledge Base](../design/04-knowledge-base.md)
- [Tools System](../design/05-tools-system.md)
- [Advanced Features](../design/06-advanced-features.md)
- [Todo List](../design/07-todo-list.md)
- [Token Optimization](../design/08-token-optimization.md)
- [Trustworthiness](../design/09-trustworthiness.md)
- [Implementation Details](../design/10-implementation.md)
- [Prompt Engineering](../design/12-prompt-engineering.md)
- [Database Design](../design/13-database-design.md)
- [Implementation Patterns](../design/14-implementation-patterns.md)
- [Recommended Libraries](./recommended-libraries.md)

---

**Ready to start building!** 🚀

