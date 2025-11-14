# Wukong Engine Implementation Plan

> A step-by-step plan to build the Wukong Agent Library from scratch

**Created:** November 12, 2025  
**Status:** Ready for Implementation

---

## Table of Contents

- [Phase 1: Foundation & Setup](#phase-1-foundation--setup) ✅
- [Phase 2: Core Agent System](#phase-2-core-agent-system) ✅
- [Phase 3: Tools & Knowledge Base](#phase-3-tools--knowledge-base)
- [Phase 4: Advanced Features](#phase-4-advanced-features)
- [Phase 5: Optimization & Polish](#phase-5-optimization--polish)
- [Phase 6: Documentation & Examples](#phase-6-documentation--examples)

---

## Phase 1: Foundation & Setup ✅

**Status:** Completed

Established the foundational infrastructure including:
- ✅ Complete monorepo structure with 9 packages
- ✅ TypeScript configuration with strict type checking
- ✅ Build tooling (tsup) and testing framework (Vitest)
- ✅ Linting and formatting (Biome)
- ✅ Core type definitions and interfaces
- ✅ Complete database schema with migrations
- ✅ Support for both Vercel Postgres and local SQLite

**See:** [phase-1-foundation.md](./phase-1-foundation.md) for detailed implementation steps.

---

## Phase 2: Core Agent System ✅

**Status:** Completed

Implemented the core agent execution system including:
- ✅ Event system with typed events and error handling
- ✅ Storage adapters for both Vercel (Postgres/KV/Blob) and Local (SQLite/FS)
- ✅ LLM integrations for OpenAI, Anthropic Claude, and Google Gemini
- ✅ Multi-model fallback system with automatic retries
- ✅ Prompt builder with MCP mode support
- ✅ Response parser with Zod validation
- ✅ Session management with checkpoints
- ✅ Step executor for all action types
- ✅ Stop controller for safe execution control
- ✅ InteractiveAgent and AutoAgent implementations
- ✅ Main WukongAgent class with complete API

**See:** [phase-2-core-agent.md](./phase-2-core-agent.md) for detailed implementation steps

---

## Phase 3: Tools & Knowledge Base ✅

**Status:** Completed

Implemented the complete tools system and knowledge base infrastructure including:
- ✅ Tool registry with auto-discovery and MCP format
- ✅ Tool executor with parameter validation and error handling
- ✅ Async tool executor for long-running operations
- ✅ Parallel tool executor with multiple wait strategies
- ✅ Document processor supporting PDF, DOCX, MD, HTML, TXT
- ✅ Document chunker with overlap and metadata preservation
- ✅ Embedding generator using OpenAI API
- ✅ Vector storage adapter with pgvector and similarity search
- ✅ Knowledge base manager for indexing and searching
- ✅ Knowledge extractor for automated learning from sessions

**See:** [phase-3-tools-knowledge-base.md](./phase-3-tools-knowledge-base.md) for detailed implementation steps

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

