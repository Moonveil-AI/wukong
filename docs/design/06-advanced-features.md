# Advanced Features

## Table of Contents
- [Agent Fork (Sub-task Parallelism)](#agent-fork-sub-task-parallelism)
- [Parallel Tool Execution](#parallel-tool-execution)
- [Fork vs Parallel Tools Comparison](#fork-vs-parallel-tools-comparison)

---

## Agent Fork (Sub-task Parallelism)

### Core Concept

AutoAgent can fork itself, creating sub-agents to process complex sub-tasks in parallel.

### Use Cases

```typescript
// Scenario 1: Batch generate similar content
"Generate 5 product video scripts in different styles"
→ Main Agent forks 5 sub-agents for parallel execution
→ Each sub-agent thinks and generates independently
→ Main Agent collects all results

// Scenario 2: Complex sub-task decomposition
"Analyze competitor's social media strategy"
→ Main Agent forks 3 sub-agents
  - Sub-agent 1: Analyze Twitter
  - Sub-agent 2: Analyze LinkedIn
  - Sub-agent 3: Analyze YouTube
→ Main Agent aggregates analysis results

// Scenario 3: Avoid main conversation clutter
"By the way, help me research quantum computing applications"
→ Fork sub-agent to handle research task
→ Main Agent continues current work
→ Report summary after research complete
```

### Interface Design

#### 1. Fork Sub-Agent

```typescript
const subAgentId = await agent.forkAutoAgent({
  goal: "Generate a tech-style product video script",
  contextSummary: "Product is an AI writing assistant, target users are content creators",
  maxDepth: 3,  // Prevent infinite recursion
  maxSteps: 20,  // Sub-agent step limit
  timeout: 300   // Timeout (seconds)
})
```

#### 2. Listen to Sub-Agent Status

```typescript
agent.on('subagent:started', (info) => {
  console.log(`Sub-agent ${info.id} started`)
  console.log(`Goal: ${info.goal}`)
})

agent.on('subagent:progress', (update) => {
  console.log(`Sub-agent ${update.id}: ${update.currentStep}/${update.totalSteps}`)
})

agent.on('subagent:completed', (result) => {
  console.log(`Sub-agent ${result.id} completed`)
  console.log(`Result summary: ${result.summary}`)
  // Complete result is compressed, only key information returned
})

agent.on('subagent:failed', (error) => {
  console.error(`Sub-agent ${error.id} failed: ${error.message}`)
})
```

#### 3. Batch Fork (Parallel Execution)

```typescript
const subAgentIds = await agent.forkMultiple({
  template: "Generate a {style} style video script",
  variations: [
    { style: "tech" },
    { style: "warm" },
    { style: "humorous" },
    { style: "professional" },
    { style: "youthful" }
  ],
  contextSummary: "Product is an AI writing assistant...",
  parallelLimit: 3  // Number of simultaneous sub-agents
})

// Wait for all sub-agents to complete
const results = await agent.waitForSubAgents(subAgentIds)
console.log("All sub-agents completed, results:", results)
```

### Database Design

```typescript
// Sessions table extension
interface Session {
  id: string
  // ... other fields
  
  // Fork support
  parentSessionId?: string  // Parent Session ID
  depth: number             // Nesting depth (prevent infinite recursion)
  inheritedContext?: string // Context summary inherited from parent
  isSubAgent: boolean       // Whether is sub-agent
}

// Query parent-child relationships
await agent.getSubAgents(sessionId)  // Get all sub-agents
await agent.getParentAgent(sessionId)  // Get parent agent
```

### Key Design Points

#### 1. Context Compression

```typescript
// Don't pass complete history, only key information
interface ForkContext {
  goal: string              // Sub-task goal
  relevantFacts: string[]   // Relevant facts
  constraints: string[]     // Constraints
  // Excludes: complete conversation history, intermediate steps
}
```

#### 2. Result Compression

```typescript
// Sub-agent returns summary, not complete steps
interface SubAgentResult {
  goal: string
  status: 'completed' | 'failed'
  summary: string          // Compressed result summary
  keyFindings: string[]    // Key findings
  artifacts: Artifact[]    // Generated files/images etc
  tokenUsed: number
  stepsCount: number
  // Excludes: complete step history
}
```

#### 3. Recursion Depth Control

```typescript
// Prevent infinite recursion
const MAX_FORK_DEPTH = 3

if (session.depth >= MAX_FORK_DEPTH) {
  throw new Error("Exceeded maximum Fork depth limit")
}
```

---

## Parallel Tool Execution

### Core Concept

Agent can simultaneously launch multiple independent tools in one step, then wait for results based on strategy.

### Use Cases

```typescript
// Scenario 1: Batch generate similar content
"Generate 3 different scene images for the product"
→ Parallel call image generation 3 times
→ Wait for all to complete
→ Display all images

// Scenario 2: Multi-source data collection
"Search for information about AI Agents"
→ Parallel search: knowledge base + Google + Twitter
→ Wait for at least 1 to complete (any strategy)
→ Integrate results

// Scenario 3: A/B testing
"Generate 2 versions of copy"
→ Parallel generate 2 copies
→ Wait for all to complete
→ Let user choose
```

### Interface Design

```typescript
// Agent decision: parallel execute multiple tools
interface ParallelToolsAction {
  action: 'CallToolsParallel'
  reasoning: string
  parallelTools: Array<{
    toolName: string
    parameters: any
    toolId: string  // Unique identifier for tracking
  }>
  waitStrategy: 'all' | 'any' | 'majority'
  timeout?: number  // Total timeout
}

// Example
{
  action: 'CallToolsParallel',
  reasoning: 'Generate 3 scene images simultaneously to improve efficiency',
  parallelTools: [
    {
      toolName: 'generateImage',
      parameters: { prompt: 'Tech-style office' },
      toolId: 'img_1'
    },
    {
      toolName: 'generateImage',
      parameters: { prompt: 'Cozy cafe' },
      toolId: 'img_2'
    },
    {
      toolName: 'generateImage',
      parameters: { prompt: 'Modern conference room' },
      toolId: 'img_3'
    }
  ],
  waitStrategy: 'all'  // Wait for all image generation to complete
}
```

### Wait Strategies

| Strategy | Description | Applicable Scenarios |
|----------|-------------|---------------------|
| **all** | Wait for all tools to complete | All results needed (e.g. batch generate images) |
| **any** | Continue when any one completes | Multi-source search, only need one return |
| **majority** | Continue when majority completes | Need multiple validations, but not all |

### Event Listening

```typescript
// Parallel tools submitted
agent.on('tools:parallel:submitted', (info) => {
  console.log(`Submitted ${info.count} parallel tools`)
  console.log(`Wait strategy: ${info.waitStrategy}`)
})

// Single tool completed
agent.on('tool:parallel:completed', (result) => {
  console.log(`Tool ${result.toolId} completed`)
  updateProgress(result.toolId, 100)
})

// Single tool failed
agent.on('tool:parallel:failed', (error) => {
  console.error(`Tool ${error.toolId} failed: ${error.message}`)
  markAsFailed(error.toolId)
})

// All tools completed (based on strategy)
agent.on('tools:parallel:ready', (results) => {
  console.log('Parallel tools reached wait condition, Agent continues execution')
  console.log(`Completed: ${results.completed.length}`)
  console.log(`Failed: ${results.failed.length}`)
  console.log(`In progress: ${results.running.length}`)
})
```

### Database Design

```typescript
// ParallelToolCall table
interface ParallelToolCall {
  id: string
  stepId: string        // Belonging step
  toolId: string        // Unique tool ID (user-defined)
  toolName: string
  parameters: any
  status: 'pending' | 'running' | 'completed' | 'failed'
  result?: any
  error?: string
  startedAt?: Date
  completedAt?: Date
  createdAt: Date
  updatedAt: Date
}

// Steps table extension
interface Step {
  // ... other fields
  
  // Parallel support
  isParallel: boolean           // Whether is parallel step
  waitStrategy?: 'all' | 'any' | 'majority'
  parallelStatus?: 'waiting' | 'partial' | 'completed'
}
```

### Implementation Points

#### 1. Status Check

```typescript
async function checkParallelResults(stepId: string): Promise<boolean> {
  const tools = await getParallelTools(stepId)
  const step = await getStep(stepId)
  
  const completed = tools.filter(t => t.status === 'completed')
  const failed = tools.filter(t => t.status === 'failed')
  const running = tools.filter(t => t.status === 'running')
  
  // Determine whether to continue based on strategy
  switch (step.waitStrategy) {
    case 'all':
      return completed.length + failed.length === tools.length
    case 'any':
      return completed.length > 0
    case 'majority':
      return completed.length > tools.length / 2
  }
}
```

#### 2. Tool Completion Callback

```typescript
async function onToolCompleted(toolCallId: string) {
  // Update tool status
  await updateToolStatus(toolCallId, 'completed')
  
  // Check if wait condition is met
  const stepId = await getStepIdByToolCall(toolCallId)
  const ready = await checkParallelResults(stepId)
  
  if (ready) {
    // Trigger Agent to continue execution
    await agent.continueExecution(stepId)
  }
}
```

### Vercel Serverless Implementation with Inngest

For production deployment on Vercel, traditional threading doesn't work due to serverless constraints. Use Inngest for event-driven async execution:

#### Key Constraints

- **Serverless Functions**: Stateless, max 300s execution (Enterprise)
- **No Background Threads**: Function ends = all state lost
- **Solution**: Delegate long-running tasks to external service (Inngest)

#### Inngest Configuration

```typescript
// lib/inngest/client.ts
import { Inngest } from 'inngest'

export const inngest = new Inngest({ 
  id: 'wukong-agent',
  eventKey: process.env.INNGEST_EVENT_KEY 
})

// app/api/inngest/route.ts
import { serve } from 'inngest/next'
import { inngest } from '@/lib/inngest/client'
import { forkAgentFunction, parallelToolsFunction, toolExecutorFunction } from '@/lib/inngest/functions'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    forkAgentFunction,
    parallelToolsFunction,
    toolExecutorFunction
  ]
})
```

#### Agent Fork with Inngest

```typescript
// lib/inngest/functions/fork-agent.ts
import { inngest } from '../client'

export const forkAgentFunction = inngest.createFunction(
  { 
    id: 'fork-agent',
    retries: 3,
    timeout: '10m'
  },
  { event: 'agent/fork.requested' },
  async ({ event, step }) => {
    const { taskId, parentSessionId, goal, contextSummary, depth } = event.data
    
    // Step 1: Update task status to 'running'
    await step.run('update-status', async () => {
      await updateTaskStatus(taskId, 'running')
    })
    
    // Step 2: Execute sub-agent (can run for minutes)
    const result = await step.run('execute-agent', async () => {
      return await AutoAgent.runAsSubAgent({
        parentSessionId,
        goal,
        inheritedContext: contextSummary,
        depth: depth + 1,
        timeout: 600  // 10 minutes
      })
    })
    
    // Step 3: Compress result
    const compressed = await step.run('compress-result', async () => {
      return await compressAgentResult(result)
    })
    
    // Step 4: Save and notify
    await step.run('save-result', async () => {
      await saveTaskResult(taskId, compressed)
      await inngest.send({
        name: 'agent/fork.completed',
        data: { taskId, result: compressed }
      })
    })
    
    return { success: true, taskId }
  }
)
```

#### Parallel Tools with Inngest

```typescript
// lib/inngest/functions/parallel-tools.ts
export const parallelToolsFunction = inngest.createFunction(
  { id: 'parallel-tools-orchestrator' },
  { event: 'agent/tools.parallel' },
  async ({ event, step }) => {
    const { stepId, tools, waitStrategy } = event.data
    
    // Step 1: Launch all tools in parallel
    const toolPromises = tools.map(tool => 
      inngest.send({
        name: 'agent/tool.execute',
        data: { 
          toolId: tool.toolId,
          stepId,
          toolName: tool.toolName,
          parameters: tool.parameters
        }
      })
    )
    await Promise.all(toolPromises)
    
    // Step 2: Wait for tools based on strategy
    const completedTools = await step.waitForEvent(
      'wait-for-tools',
      {
        event: 'agent/tool.completed',
        timeout: '10m',
        match: 'data.stepId',
        
        // Smart waiting based on strategy
        if: waitStrategy === 'all' 
          ? `async.data.completedCount >= ${tools.length}`
          : waitStrategy === 'any'
          ? `async.data.completedCount >= 1`
          : `async.data.completedCount >= ${Math.ceil(tools.length / 2)}`
      }
    )
    
    // Step 3: Collect all results
    const allResults = await step.run('collect-results', async () => {
      return await getAllToolResults(stepId)
    })
    
    // Step 4: Notify Agent to continue
    await inngest.send({
      name: 'agent/tools.all-completed',
      data: { stepId, results: allResults }
    })
  }
)

// Individual tool executor
export const toolExecutorFunction = inngest.createFunction(
  { id: 'tool-executor', retries: 3 },
  { event: 'agent/tool.execute' },
  async ({ event, step }) => {
    const { toolId, stepId, toolName, parameters } = event.data
    
    // Update status to running
    await updateToolStatus(toolId, 'running')
    
    try {
      // Execute tool (can take minutes)
      const result = await step.run('execute', async () => {
        const tool = getToolByName(toolName)
        return await tool.execute(parameters)
      })
      
      // Save result
      await updateToolStatus(toolId, 'completed', result)
      
      // Notify completion
      await inngest.send({
        name: 'agent/tool.completed',
        data: { toolId, stepId, result }
      })
      
    } catch (error) {
      await updateToolStatus(toolId, 'failed', null, error.message)
      
      await inngest.send({
        name: 'agent/tool.failed',
        data: { toolId, stepId, error: error.message }
      })
    }
  }
)
```

#### Frontend Integration

```typescript
// Trigger Agent Fork
async function forkAgent(goal: string, contextSummary: string) {
  const response = await fetch('/api/agent/fork', {
    method: 'POST',
    body: JSON.stringify({ goal, contextSummary })
  })
  
  const { taskId } = await response.json()
  
  // Poll for results (or use WebSocket/SSE)
  const result = await pollTaskResult(taskId)
  return result
}

// Polling implementation
async function pollTaskResult(taskId: string) {
  while (true) {
    const response = await fetch(`/api/tasks/${taskId}`)
    const task = await response.json()
    
    if (task.status === 'completed') {
      return task.result
    } else if (task.status === 'failed') {
      throw new Error(task.error)
    }
    
    // Wait 2 seconds before next poll
    await new Promise(resolve => setTimeout(resolve, 2000))
  }
}
```

#### Cost Estimation

- **Free tier**: 50K events/month (enough for ~1000 tasks/day)
- **Paid**: ~$1 per 1K events (very affordable for production)
- **Advantage**: No need to manage workers, queues, or polling infrastructure

---

## Fork vs Parallel Tools Comparison

| Feature | Agent Fork | Parallel Tool Execution |
|---------|-----------|------------------------|
| **Purpose** | Complex sub-tasks, need multiple steps | Simple independent tasks, single step completion |
| **Independence** | Fully independent Agent | Parallel tools of same Agent |
| **Context** | Has own History | Shares main Agent's History |
| **Applicable Scenarios** | Generate 5 different scripts | Generate 5 similar images |
| **Return Result** | Compressed summary | Complete tool output |
| **Resource Consumption** | Each sub-agent billed independently | Counted as one Agent's step |
| **Complexity** | High (independent reasoning) | Low (parallel execution) |
| **Best Practice** | Tasks requiring independent thinking | Repetitive batch operations |

### Selection Guide

```typescript
// Use Agent Fork:
// - Each sub-task needs multi-step reasoning
// - Sub-tasks are logically independent
// - Need context isolation

if (multi_step_reasoning && independent_tasks && need_isolation) {
  await agent.forkAutoAgent(subGoal)
}

// Use parallel tools:
// - Same tool, different parameters
// - Single step completion
// - Shared context

if (same_tool && single_step && shared_context) {
  await agent.executeParallelTools(tools)
}
```

### Combined Usage Example

```typescript
// Main task: Create complete marketing content for product
await agent.execute({
  goal: "Create marketing content for new product (5 social media posts, 3 video scripts, 1 press release)"
})

// Agent auto-decision:
// 1. Fork 3 sub-agents (independent tasks)
const socialPostsAgent = await agent.fork({
  goal: "Generate 5 social media posts",
  // Sub-agent internally uses parallel tools to generate 5 posts
})

const videoScriptsAgent = await agent.fork({
  goal: "Generate 3 video scripts",
  // Sub-agent internally uses parallel tools to generate 3 scripts
})

const pressReleaseAgent = await agent.fork({
  goal: "Generate press release",
  // Single task, no need for parallel
})

// 2. Wait for all sub-agents to complete
const results = await agent.waitForSubAgents([
  socialPostsAgent,
  videoScriptsAgent,
  pressReleaseAgent
])

// 3. Integrate all results
return {
  socialPosts: results[0].artifacts,
  videoScripts: results[1].artifacts,
  pressRelease: results[2].artifact
}
```

[← Previous Chapter: Tools System](./05-tools-system.md) | [Next Chapter: Todo List Mechanism →](./07-todo-list.md)

