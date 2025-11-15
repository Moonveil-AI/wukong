# Overall Architecture

## Table of Contents
- [Layered Architecture](#layered-architecture)
- [Core Workflows](#core-workflows)
- [Data Flow](#data-flow)

---

## Layered Architecture

The system adopts a layered architecture design, with four layers from top to bottom:

```
┌─────────────────────────────────────────┐
│  User Application Layer (Next.js App)   │
│  - Call Agent interfaces                │
│  - Listen to Agent events               │
│  - Display UI feedback                  │
└────────────┬────────────────────────────┘
             ↓
┌─────────────────────────────────────────┐
│  Wukong Core (Core Engine)              │
│  - Agent main controller                │
│  - Session management (Session)         │
│  - History management (History)         │
│  - Todo manager                         │
└────────────┬────────────────────────────┘
             ↓
┌─────────────────────────────────────────┐
│  Execution Layer                         │
│  - Prompt builder                       │
│  - LLM caller (supports multiple models)│
│  - Tool executor (supports async)       │
│  - Skills registry                      │
└────────────┬────────────────────────────┘
             ↓
┌─────────────────────────────────────────┐
│  Resource Layer                          │
│  - Knowledge Base (vector retrieval)    │
│  - Tools Registry (tool library)        │
│  - Skills Library (capability library)  │
│  - Data persistence (Vercel Postgres/KV)│
└─────────────────────────────────────────┘
```

### Layer Responsibilities

#### 1. User Application Layer
- **Responsibility**: UI display and user interaction
- **Technology**: Next.js App Router / React components
- **Functions**:
  - Call Agent API
  - Listen to real-time events (progress, status)
  - Display results and feedback

#### 2. Wukong Core
- **Responsibility**: Agent core logic and control
- **Core Class**: `WukongAgent`
- **Functions**:
  - Session lifecycle management
  - History record management
  - Todo task scheduling
  - Stop/resume control

#### 3. Execution Layer
- **Responsibility**: Actual execution of reasoning and tool invocation
- **Components**:
  - `PromptBuilder`: Build LLM prompt
  - `LLMCaller`: Call LLM (supports streaming)
  - `ToolExecutor`: Execute tools (supports async)
  - `SkillsRegistry`: Manage Skills

#### 4. Resource Layer
- **Responsibility**: Data storage and retrieval
- **Components**:
  - `KnowledgeBase`: Vector knowledge base
  - `ToolsRegistry`: Tool registry
  - `StorageAdapter`: Data persistence
  - `CacheAdapter`: Cache management

---

## Core Workflows

### Complete Execution Flow

```
User request
  ↓
[Session Manager] Create/resume session
  ↓
[Todo Manager] Generate task list
  ↓
[Agent Controller] Loop execution:
  ├─ Query Knowledge Base (vector search)
  ├─ Match Skills (lazy loading)
  ├─ Build Prompt (structured with examples)
  ├─ Call LLM (with streaming)
  ├─ Parse response (extract <final_output> JSON)
  ├─ Execute action:
  │   ├─ CallTool: Single tool execution
  │   ├─ CallToolsParallel: Multiple tools simultaneously
  │   ├─ ForkAutoAgent: Create sub-agent
  │   ├─ AskUser: Request confirmation
  │   ├─ Plan: Show execution plan
  │   └─ Finish: Complete task
  ├─ Handle async execution (if needed)
  ├─ Update Todo (mark progress)
  ├─ Mark discardable steps (token optimization)
  └─ Check completion condition
  ↓
Return result + Provide undo/edit options
```

### Two Agent Modes

The system supports two distinct agent modes for different use cases:

#### InteractiveAgent (Step-by-Step Mode)
- Every tool call requires user confirmation
- User can modify direction at any time
- Best for creative tasks requiring iteration
- Pattern: `CallTool` → `AskUser` → Continue

```typescript
// Interactive flow
while (not complete) {
  // Agent thinks and proposes action
  const action = await agent.think()
  
  // Show plan to user and wait for confirmation
  const confirmed = await askUser(action)
  if (!confirmed) {
    // User can modify or reject
    continue
  }
  
  // Execute only after confirmation
  await agent.executeAction(action)
}
```

#### AutoAgent (Fully Autonomous Mode)
- Runs continuously until completion
- First step typically searches knowledge base
- Can call multiple tools consecutively
- Best for standardized, repeatable tasks

```typescript
// Auto flow
while (not complete) {
  // Agent decides and executes without waiting
  const action = await agent.think()
  await agent.executeAction(action)
  
  // Check timeout and resource limits
  if (timeout || no_credits) {
    break
  }
}
```

### Detailed Step Description

#### 1. Session Initialization
```typescript
const session = await agent.createSession({
  goal: "User's goal",
  context: { userId: "user-123" }
})
```

#### 2. Generate Task List
```typescript
// Agent automatically decomposes large tasks
const todos = await todoManager.generateTodos(goal)
// Example:
// - Read file
// - Clean data
// - Generate charts
// - Write report
```

#### 3. Execution Loop

Each step includes:

```typescript
while (!isTaskComplete()) {
  // 3.1 Check stop signal
  if (shouldStop()) break
  
  // 3.2 Query knowledge base (vector search, top 5 results)
  const knowledge = await knowledgeBase.search({
    query: currentContext,
    topK: 5,
    minScore: 0.7,
    filters: { userId, orgId }  // Permission filtering
  })
  
  // 3.3 Match Skills (lazy loading only matched ones)
  const skills = await skillsRegistry.match(currentContext)
  
  // 3.4 Build Prompt (structured with XML/JSON format)
  const prompt = promptBuilder.build({
    role: agentRole,
    goal: session.goal,
    history: session.history,  // Excludes discarded steps
    knowledge: knowledge,       // Relevant context
    skills: skills,             // Only matched skills
    tools: toolRegistry.listTools(),  // Tool Executor format (name + params only)
    constraints: agentConstraints,
    examples: promptExamples
  })
  
  // 3.5 Call LLM (streaming with multi-model fallback)
  const response = await llm.callWithStreaming(prompt, {
    models: ['gpt-5.1-instant', 'gemini-2.0-flash', 'gpt-4o'],  // Try in order
    stream: true,
    onChunk: (chunk) => emit('llm:streaming', chunk),
    temperature: 0.7
  })
  
  // 3.6 Parse response (extract <final_output>...</final_output>)
  const action = parseAgentResponse(response)
  // Expected format:
  // {
  //   action: 'CallTool' | 'CallToolsParallel' | 'ForkAutoAgent' | 'AskUser' | 'Finish',
  //   reasoning: string,
  //   selectedTool?: string,
  //   parallelTools?: ToolCall[],
  //   parameters?: any,
  //   discardableSteps?: number[]  // Token optimization
  // }
  
  // 3.7 Execute action
  if (action.type === 'CallTool') {
    // Single tool execution
    const result = await toolExecutor.execute({
      tool: action.tool,
      params: action.parameters,
      async: isAsyncTool(action.tool)
    })
  } else if (action.type === 'CallToolsParallel') {
    // Parallel execution (truly concurrent)
    const results = await toolExecutor.executeParallel({
      tools: action.parallelTools,
      waitStrategy: action.waitStrategy  // 'all' | 'any' | 'majority'
    })
  } else if (action.type === 'ForkAutoAgent') {
    // Create sub-agent for complex sub-task
    const subAgent = await agent.fork({
      goal: action.subGoal,
      contextSummary: compressContext(session.history),
      depth: session.depth + 1,
      maxDepth: 5,  // Prevent infinite recursion
      timeout: 300
    })
    // Returns compressed summary, not full history
  } else if (action.type === 'AskUser') {
    // Wait for user input (InteractiveAgent only)
    await waitForUserResponse()
  }
  
  // 3.8 Discard unnecessary steps (token optimization)
  if (action.discardableSteps?.length > 0) {
    await session.markStepsAsDiscarded(action.discardableSteps)
  }
  
  // 3.9 Update Todo
  await todoManager.updateProgress(action.result)
  
  // 3.10 Save step to database
  await session.saveStep({
    stepId: currentStep++,
    llmPrompt: prompt,
    agentResponse: action,
    stepResult: result,
    discarded: false,
    isParallel: action.type === 'CallToolsParallel',
    waitStrategy: action.waitStrategy
  })
}
```

---

## Data Flow

### 1. Prompt Building Flow

```
User goal
  ↓
[Knowledge Base] → Relevant document fragments
  ↓
[Skills Registry] → Matched capability documents
  ↓
[History] → Recent conversation history
  ↓
[Prompt Builder] → Complete Prompt
  ↓
LLM
```

### 2. Tool Execution Flow

```
LLM response: {"action": "CallTool", "tool": "generate_image", "params": {...}}
  ↓
[Tool Executor] Validate parameters
  ↓
[Tool Handler] Execute tool logic
  ↓
Result summary (Tool Executor mode) or complete result
  ↓
Save to History
  ↓
Trigger next step execution
```

### 3. Async Tool Flow

```
LLM decides to call async tool (e.g. video generation)
  ↓
[Tool Executor] Submit task to external API
  ↓
[Cache Adapter] Save task status (taskId, status)
  ↓
Agent continues with other tasks (non-blocking)
  ↓
[Background Poller] Periodically query task status
  ↓
Notify Agent after task completion
  ↓
Agent continues with subsequent steps
```

### 4. Stop and Resume Flow

```
User clicks stop button
  ↓
[Stop Controller] Mark stop request
  ↓
Agent checks stop signal
  ↓
Graceful stop: complete current step
Force stop: stop immediately
  ↓
Save current state (completed steps, partial results)
  ↓
User can choose:
  - View partial results
  - Continue execution
  - Clean up and abandon
```

---

## Architectural Advantages

### 1. Clear Layering
- Each layer has clear responsibilities
- Easy to test and maintain
- Can be upgraded independently

### 2. Loose Coupling
- Communicate through interfaces and events
- Support different storage backends (Adapter pattern)
- Support multiple LLM Providers

### 3. Extensible
- Tool system is pluggable
- Skills can be dynamically loaded
- Support custom Adapters

### 4. High Performance
- Async tools don't block
- Streaming output reduces latency
- Smart caching reduces redundant computation

[← Previous Chapter: Core Design Principles](./01-core-concepts.md) | [Next Chapter: Core Interface Design →](./03-interfaces.md)

