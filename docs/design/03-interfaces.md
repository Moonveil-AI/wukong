# Core Interface Design

## Table of Contents
- [Agent Initialization](#agent-initialization)
- [Task Execution](#task-execution)
- [Event Listening](#event-listening)
- [Session Management](#session-management)
- [Undo and History Management](#undo-and-history-management)

---

## Agent Initialization

### Configuration Interface

```typescript
interface WukongAgentConfig {
  // LLM configuration
  llmKey: string                    // User-provided API key
  llmModel?: 'gpt-4' | 'claude-3'  // Optional model
  
  // 🆕 Adapter configuration (platform-agnostic)
  adapter: StorageAdapter & CacheAdapter & Partial<FilesAdapter & VectorAdapter>
  // Or use official adapter: VercelAdapter | AWSAdapter | SupabaseAdapter | LocalAdapter
  
  // Knowledge base configuration
  knowledgeBase?: {
    path: string                    // File path (uses FilesAdapter)
    embedModel?: string             // Optional embedding model
  }
  
  // Tools configuration
  tools: {
    path: string                    // Tools directory path
    autoDiscover?: boolean          // Auto-discover tools
  }
  
  // Trustworthiness configuration
  trustConfig?: {
    requireConfirmation?: string[]  // Operation types requiring confirmation
    showPlan?: boolean              // Whether to show execution plan
    enableUndo?: boolean            // Whether to enable undo
    maxSteps?: number               // Maximum execution steps
  }
  
  // Token optimization configuration
  tokenConfig?: {
    enableToolExecutor?: boolean    // Enable Tool Executor mode
    enableSkills?: boolean          // Enable Skills lazy loading
    autoDiscard?: boolean           // Auto-discard useless steps
  }
}
```

### Usage Examples

#### Vercel Example

```typescript
import { WukongAgent } from '@wukong/agent'
import { VercelAdapter } from '@wukong/adapter-vercel'

const agent = new WukongAgent({
  llmKey: process.env.OPENAI_API_KEY,
  adapter: new VercelAdapter({
    postgres: process.env.POSTGRES_URL,
    kv: process.env.KV_URL,
    blob: process.env.BLOB_READ_WRITE_TOKEN
  }),
  knowledgeBase: { path: './knowledge' },
  tools: { path: './tools' }
})
```

#### Local Development Example

```typescript
import { LocalAdapter } from '@wukong/adapter-local'

const agent = new WukongAgent({
  llmKey: process.env.OPENAI_API_KEY,
  adapter: new LocalAdapter({
    dbPath: './data/wukong.db',
    filesPath: './data/files'
  }),
  knowledgeBase: { path: './knowledge' },
  tools: { path: './tools' }
})
```

---

## Task Execution

### Task Options

```typescript
interface TaskOptions {
  goal: string                      // User goal
  mode?: 'interactive' | 'auto'     // Interactive or auto mode
  showProgress?: boolean            // Show progress
  onProgress?: (event: ProgressEvent) => void
  onPlanReady?: (plan: ExecutionPlan) => Promise<boolean>
  onToolCall?: (call: ToolCall) => Promise<boolean>
}
```

### Execution Example

```typescript
const result = await agent.execute({
  goal: "Analyze sales.csv file and generate report",
  mode: 'interactive',
  showProgress: true,
  
  // Let user confirm when plan is ready
  onPlanReady: async (plan) => {
    console.log("Execution plan:", plan.steps)
    return await askUserConfirmation(plan)
  },
  
  // Let user confirm before tool call
  onToolCall: async (call) => {
    if (call.isHighRisk) {
      return await askUserConfirmation(call)
    }
    return true
  }
})
```

---

## Event Listening

The Agent provides real-time status updates through an event system:

### Session Events

```typescript
agent.on('session:created', (session) => {
  console.log("Session created:", session.id)
})
```

### Plan Events

```typescript
agent.on('plan:generated', (plan) => {
  console.log("Generated plan:", plan)
  showPlanToUser(plan)
})
```

### Step Events

```typescript
agent.on('step:started', (step) => {
  console.log("Step started:", step.action)
  updateProgress(step)
})

agent.on('step:completed', (step) => {
  console.log("Step completed:", step.result)
  showResult(step.result)
})
```

### Tool Execution Events

```typescript
agent.on('tool:executing', (tool) => {
  console.log("Executing tool:", tool.name)
  showStatus(`${tool.description}...`)
})
```

### Task Completion Events

```typescript
agent.on('task:completed', (result) => {
  console.log("Task completed:", result)
  showFinalResult(result, { 
    allowUndo: true,
    allowEdit: true 
  })
})
```

### 🆕 LLM Streaming Output Events

```typescript
agent.on('llm:streaming', (chunk) => {
  console.log("LLM output:", chunk.text)
  // Real-time display of LLM's thinking process
  appendToThinkingBox(chunk.text)
})

agent.on('llm:complete', (response) => {
  console.log("LLM finished thinking")
  showFullReasoning(response)
})
```

### 🆕 Stop-Related Events

```typescript
agent.on('task:stopping', () => {
  console.log("Stopping task...")
  showStatus("Safely stopping...")
})

agent.on('task:stopped', (state) => {
  console.log("Task stopped", state)
  showStoppedState({
    completedSteps: state.completedSteps,
    partialResult: state.partialResult,
    canResume: state.canResume
  })
})
```

---

## Session Management

### Create Session

```typescript
const session = await agent.createSession({
  goal: "Help me analyze data",
  context: { userId: "user-123" }
})
```

### Resume Session

```typescript
const session = await agent.resumeSession(sessionId)
```

### Get Session State

```typescript
const state = await agent.getSessionState(sessionId)
console.log("Current step:", state.currentStep)
console.log("Completion progress:", state.progress)
console.log("Pending todos:", state.todos)
```

### Get Session History

```typescript
const history = await agent.getHistory(sessionId)
```

### 🆕 Stop Task

#### Graceful Stop

```typescript
await agent.stop(sessionId, {
  graceful: true,  // Complete current step before stopping
  saveState: true  // Save state for resumption
})
```

#### Force Stop

```typescript
await agent.forceStop(sessionId)
```

### 🆕 Resume Task

```typescript
await agent.resume(sessionId, {
  fromStep: 5  // Optional: resume from specific step
})
```

---

## Undo and History Management

### Undo Operations

```typescript
// Undo last step
await agent.undo(sessionId)

// Undo to specific step
await agent.undoToStep(sessionId, stepId)
```

### View History

```typescript
// View step history
const steps = await agent.getSteps(sessionId)

// Get version history
const versions = await agent.getVersionHistory(sessionId)
```

### Checkpoint Management

```typescript
// Create checkpoint
const checkpoint = await agent.createCheckpoint(sessionId)

// Restore checkpoint
await agent.restoreCheckpoint(sessionId, checkpoint)
```

### Step Management

```typescript
// Discard unneeded steps (save tokens)
await agent.discardSteps(sessionId, [step1, step2])
```

---

## Complete Event List

| Event Name | Parameters | Description |
|-----------|------------|-------------|
| `session:created` | `Session` | Session created |
| `plan:generated` | `ExecutionPlan` | Execution plan generated |
| `todos:generated` | `Todo[]` | Task list generated |
| `todo:started` | `Todo` | Task started |
| `todo:completed` | `Todo` | Task completed |
| `todo:failed` | `Todo` | Task failed |
| `todos:updated` | `TodoChange` | Task list updated |
| `step:started` | `Step` | Step started |
| `step:completed` | `Step` | Step completed |
| `tool:executing` | `ToolCall` | Tool executing |
| `tool:requiresConfirmation` | `ToolCall` | Tool requires confirmation |
| `tool:async:submitted` | `AsyncTask` | Async task submitted |
| `tool:async:progress` | `TaskProgress` | Async task progress |
| `tool:async:completed` | `TaskResult` | Async task completed |
| `tool:async:failed` | `TaskError` | Async task failed |
| `tools:parallel:submitted` | `ParallelInfo` | Parallel tools submitted |
| `tool:parallel:completed` | `ToolResult` | Parallel tool completed |
| `tool:parallel:failed` | `ToolError` | Parallel tool failed |
| `tools:parallel:ready` | `ParallelResults` | Parallel tools condition met |
| `llm:streaming` | `StreamChunk` | LLM streaming output |
| `llm:complete` | `LLMResponse` | LLM complete |
| `progress:updated` | `number` | Progress updated |
| `reasoning:available` | `Reasoning` | Reasoning process available |
| `task:stopping` | - | Task stopping |
| `task:stopped` | `StopState` | Task stopped |
| `task:completed` | `TaskResult` | Task completed |
| `tokens:used` | `TokenUsage` | Token usage |
| `skills:matched` | `Skill[]` | Skills matched |
| `subagent:started` | `SubAgentInfo` | Sub-agent started |
| `subagent:progress` | `SubAgentProgress` | Sub-agent progress |
| `subagent:completed` | `SubAgentResult` | Sub-agent completed |
| `subagent:failed` | `SubAgentError` | Sub-agent failed |

[← Previous Chapter: Overall Architecture](./02-architecture.md) | [Next Chapter: Knowledge Base System →](./04-knowledge-base.md)

