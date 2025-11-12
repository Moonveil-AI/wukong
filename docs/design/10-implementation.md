# Implementation Details

This chapter introduces core implementation details of the Wukong Agent Library.

## Table of Contents
- [Next.js Integration](#nextjs-integration)
- [Data Persistence](#data-persistence)
- [Async Tool Execution Architecture](#async-tool-execution-architecture)
- [Vector Retrieval Implementation](#vector-retrieval-implementation)
- [LLM Streaming Output](#llm-streaming-output)
- [Stop Mechanism Implementation](#stop-mechanism-implementation)

---

## Next.js Integration

### App Router Approach

```typescript
// app/api/agent/route.ts
import { WukongAgent } from '@wukong/agent'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { goal, sessionId } = await req.json()
  
  const agent = new WukongAgent({
    llmKey: process.env.OPENAI_API_KEY,
    knowledgeBase: { type: 'local', path: './knowledge' },
    tools: { path: './tools' }
  })
  
  // Create or resume session
  const session = sessionId 
    ? await agent.resumeSession(sessionId)
    : await agent.createSession({ goal })
  
  // Execute task
  const result = await agent.execute({
    goal,
    mode: 'auto',
    sessionId: session.id
  })
  
  return NextResponse.json({ 
    result, 
    sessionId: session.id 
  })
}
```

### Server Actions Approach

```typescript
// app/actions/agent.ts
'use server'

import { WukongAgent } from '@wukong/agent'

export async function executeAgentTask(goal: string, sessionId?: string) {
  const agent = new WukongAgent({...})
  
  // Use streaming response
  const stream = agent.executeStream({
    goal,
    sessionId,
    onProgress: (event) => {
      // Send progress events
    }
  })
  
  return stream
}
```

### Streaming Response API

```typescript
// app/api/agent/stream/route.ts
export async function POST(req: NextRequest) {
  const { goal } = await req.json()
  const encoder = new TextEncoder()
  
  const stream = new ReadableStream({
    async start(controller) {
      const agent = new WukongAgent({...})
      
      // Listen to all events and send streaming
      agent.on('step:started', (step) => {
        const data = `data: ${JSON.stringify({
          type: 'step:started',
          data: step
        })}\n\n`
        controller.enqueue(encoder.encode(data))
      })
      
      agent.on('llm:streaming', (chunk) => {
        const data = `data: ${JSON.stringify({
          type: 'llm:streaming',
          data: chunk
        })}\n\n`
        controller.enqueue(encoder.encode(data))
      })
      
      agent.on('step:completed', (step) => {
        const data = `data: ${JSON.stringify({
          type: 'step:completed',
          data: step
        })}\n\n`
        controller.enqueue(encoder.encode(data))
      })
      
      // Execute task
      try {
        await agent.execute({ goal })
      } catch (error) {
        if (error.code !== 'TASK_STOPPED') {
          throw error
        }
      }
      
      controller.close()
    }
  })
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  })
}
```

---

## Data Persistence

### Recommended Solution: Vercel Postgres + KV

```typescript
// Session data → Vercel Postgres
// Temporary state → Vercel KV (Redis)
// Vector data → Vercel Postgres (pgvector extension)

import { sql } from '@vercel/postgres'
import { kv } from '@vercel/kv'

const storage = {
  // Save session
  async saveSession(session: Session) {
    await sql`
      INSERT INTO sessions (id, goal, status, created_at)
      VALUES (${session.id}, ${session.goal}, ${session.status}, NOW())
    `
  },
  
  // Save step
  async saveStep(step: Step) {
    await sql`
      INSERT INTO steps (session_id, step_id, action, result)
      VALUES (${step.sessionId}, ${step.id}, ${step.action}, ${step.result})
    `
  },
  
  // Temporary state cache (async task status etc.)
  async cacheTempState(key: string, value: any) {
    await kv.set(key, value, { ex: 3600 }) // 1 hour expiry
  }
}
```

### Database Schema

```sql
-- Sessions table
CREATE TABLE sessions (
  id VARCHAR(255) PRIMARY KEY,
  goal TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'active',
  user_id VARCHAR(255),
  parent_session_id VARCHAR(255),  -- For Agent Fork
  depth INTEGER DEFAULT 0,          -- Nesting depth
  is_sub_agent BOOLEAN DEFAULT false,
  inherited_context TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Steps table
CREATE TABLE steps (
  id VARCHAR(255) PRIMARY KEY,
  session_id VARCHAR(255) REFERENCES sessions(id),
  step_number INTEGER NOT NULL,
  action VARCHAR(100) NOT NULL,
  parameters JSONB,
  result JSONB,
  status VARCHAR(50) DEFAULT 'pending',
  is_parallel BOOLEAN DEFAULT false,
  wait_strategy VARCHAR(50),
  discarded BOOLEAN DEFAULT false,  -- For smart step discarding
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- Todos table
CREATE TABLE todos (
  id VARCHAR(255) PRIMARY KEY,
  session_id VARCHAR(255) REFERENCES sessions(id),
  title TEXT NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'pending',
  dependencies JSONB,  -- Array of todo ids
  priority INTEGER DEFAULT 0,
  estimated_steps INTEGER,
  actual_steps INTEGER,
  result JSONB,
  error TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  started_at TIMESTAMP,
  completed_at TIMESTAMP
);

-- ParallelToolCalls table
CREATE TABLE parallel_tool_calls (
  id VARCHAR(255) PRIMARY KEY,
  step_id VARCHAR(255) REFERENCES steps(id),
  tool_id VARCHAR(255) NOT NULL,  -- User-defined identifier
  tool_name VARCHAR(255) NOT NULL,
  parameters JSONB,
  status VARCHAR(50) DEFAULT 'pending',
  result JSONB,
  error TEXT,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Checkpoints table (for undo/restore)
CREATE TABLE checkpoints (
  id VARCHAR(255) PRIMARY KEY,
  session_id VARCHAR(255) REFERENCES sessions(id),
  name VARCHAR(255),
  description TEXT,
  state JSONB,  -- Complete session state snapshot
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_steps_session ON steps(session_id);
CREATE INDEX idx_todos_session ON todos(session_id);
CREATE INDEX idx_parallel_calls_step ON parallel_tool_calls(step_id);
```

---

## Async Tool Execution Architecture

### Core Design Philosophy

Implement platform-agnostic async processing through CacheAdapter, avoiding long-term occupation of Serverless resources.

### Async Tool Types

| API Type | Description | Processing Strategy | Applicable Scenarios |
|----------|-------------|--------------------|--------------------|
| **Sync API** | Immediate result return | Direct execution | Image generation (10-30s) |
| **Async+Polling** | Returns taskId, periodic queries needed | Polling | Video generation (60-300s) |
| **Async+Webhook** | Callback notification after completion | Webhook + lightweight polling | Long video processing (>5 min) |

### CacheAdapter Async Support

```typescript
interface CacheAdapter {
  // Basic cache
  set(key: string, value: any, ttl?: number): Promise<void>
  get(key: string): Promise<any>
  delete(key: string): Promise<void>
  
  // 🆕 Async task queue support
  enqueueAsyncTask(task: AsyncTask): Promise<void>
  getAsyncTaskStatus(taskId: string): Promise<TaskStatus>
  updateAsyncTaskStatus(taskId: string, status: TaskStatus): Promise<void>
}

interface AsyncTask {
  internalTaskId: string      // Wukong's task ID
  externalTaskId: string      // External API's task ID
  toolName: string
  params: any
  sessionId: string
  status: 'pending' | 'polling' | 'completed' | 'failed'
  progress?: number
  result?: any
  error?: string
  createdAt: number
  updatedAt: number
  nextPollAt?: number
}
```

### Vercel Adapter Implementation

```typescript
import { kv } from '@vercel/kv'
import { CacheAdapter } from '@wukong/agent'

export class VercelCacheAdapter implements CacheAdapter {
  async enqueueAsyncTask(task: AsyncTask) {
    // Save task status
    await kv.set(`async:task:${task.internalTaskId}`, task)
    
    // Add to polling queue
    await kv.sadd('async:polling:queue', task.internalTaskId)
    
    // Trigger background polling
    await fetch('/api/async/poll-next', { method: 'POST' })
  }
  
  async getAsyncTaskStatus(taskId: string) {
    return await kv.get(`async:task:${taskId}`)
  }
  
  async updateAsyncTaskStatus(taskId: string, status: TaskStatus) {
    const task = await this.getAsyncTaskStatus(taskId)
    await kv.set(`async:task:${taskId}`, { ...task, ...status })
    
    // If complete, notify Agent
    if (status.status === 'completed' || status.status === 'failed') {
      await this.notifyAgent(taskId, status)
    }
  }
  
  private async notifyAgent(taskId: string, status: TaskStatus) {
    // Notify frontend via SSE / WebSocket / HTTP polling
    await fetch('/api/agent/notify', {
      method: 'POST',
      body: JSON.stringify({ taskId, status })
    })
  }
}
```

### Background Polling Worker

```typescript
// app/api/async/poll-next/route.ts
export async function POST(req: NextRequest) {
  // Get a pending polling task from queue
  const taskId = await kv.spop('async:polling:queue')
  if (!taskId) return NextResponse.json({ message: 'No tasks' })
  
  const task = await kv.get(`async:task:${taskId}`)
  
  // Load tool's poll function
  const tool = await loadTool(task.toolName)
  
  // Query external API status
  const status = await tool.handler.poll(task.externalTaskId)
  
  // Update task status
  await kv.set(`async:task:${taskId}`, {
    ...task,
    status: status.status,
    progress: status.progress,
    result: status.result,
    updatedAt: Date.now()
  })
  
  // If not complete, rejoin queue
  if (status.status === 'pending' || status.status === 'processing') {
    await kv.sadd('async:polling:queue', taskId)
  }
  
  // If complete, notify Agent
  if (status.status === 'completed') {
    await agent.notifyAsyncToolCompleted(taskId, status.result)
  }
  
  return NextResponse.json({ status: status.status })
}

// vercel.json - Configure scheduled polling
{
  "crons": [{
    "path": "/api/async/poll-next",
    "schedule": "*/5 * * * *"  // Execute every 5 seconds
  }]
}
```

### Webhook Support

```typescript
// app/api/webhooks/[toolName]/route.ts
export async function POST(req: NextRequest, { params }) {
  const { toolName } = params
  const payload = await req.json()
  
  // Verify webhook signature
  const isValid = verifyWebhookSignature(payload, req.headers)
  if (!isValid) return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  
  // Load tool
  const tool = await loadTool(toolName)
  
  // Call tool's webhook handler
  await tool.handler.onWebhook(payload)
  
  // Find corresponding internal task
  const task = await findTaskByExternalId(payload.taskId)
  
  // Update status
  await kv.set(`async:task:${task.internalTaskId}`, {
    ...task,
    status: payload.status,
    result: payload.result,
    updatedAt: Date.now()
  })
  
  // Notify Agent
  if (payload.status === 'completed') {
    await agent.notifyAsyncToolCompleted(task.internalTaskId, payload.result)
  }
  
  return NextResponse.json({ success: true })
}
```

---

## Vector Retrieval Implementation

### Using Vercel Postgres pgvector

```typescript
import { sql } from '@vercel/postgres'

// Create vector table
await sql`
  CREATE EXTENSION IF NOT EXISTS vector;
  
  CREATE TABLE knowledge_vectors (
    id SERIAL PRIMARY KEY,
    content TEXT,
    embedding vector(1536),
    metadata JSONB
  );
  
  CREATE INDEX ON knowledge_vectors 
  USING ivfflat (embedding vector_cosine_ops);
`

// Vector search
async function searchKnowledge(query: string, topK: number = 5) {
  // Generate query vector
  const queryEmbedding = await generateEmbedding(query)
  
  // Vector search
  const results = await sql`
    SELECT content, metadata, 
           1 - (embedding <=> ${queryEmbedding}::vector) as similarity
    FROM knowledge_vectors
    WHERE 1 - (embedding <=> ${queryEmbedding}::vector) > 0.7
    ORDER BY embedding <=> ${queryEmbedding}::vector
    LIMIT ${topK}
  `
  
  return results.rows
}
```

---

## LLM Streaming Output

### LLM Caller

```typescript
interface LLMStreamConfig {
  enableStreaming: boolean
  onChunk: (chunk: string) => void
  onComplete: (full: string) => void
}

class LLMCaller {
  async callWithStreaming(prompt: string, config: LLMStreamConfig) {
    const stream = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      stream: true  // Enable streaming output
    })
    
    let fullResponse = ''
    
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || ''
      if (content) {
        fullResponse += content
        // Send each chunk in real-time
        config.onChunk(content)
      }
    }
    
    config.onComplete(fullResponse)
    return fullResponse
  }
}
```

### Agent Integration

```typescript
class WukongAgent {
  async think(step: Step) {
    const prompt = this.buildPrompt(step)
    
    // Call LLM with streaming
    const response = await this.llm.callWithStreaming(prompt, {
      enableStreaming: true,
      
      // Send each chunk to frontend in real-time
      onChunk: (chunk) => {
        this.emit('llm:streaming', { 
          stepId: step.id,
          text: chunk,
          timestamp: Date.now()
        })
      },
      
      // Parse response after LLM completes
      onComplete: (full) => {
        this.emit('llm:complete', {
          stepId: step.id,
          fullText: full
        })
      }
    })
    
    return this.parseResponse(response)
  }
}
```

---

## Stop Mechanism Implementation

### Stop Controller

```typescript
class StopController {
  private stopped = false
  private stopRequested = false
  
  // Request stop
  requestStop(graceful: boolean = true) {
    this.stopRequested = true
    if (!graceful) {
      this.stopped = true
    }
  }
  
  // Check if should stop
  shouldStop(): boolean {
    return this.stopped
  }
  
  // Check if there's a stop request (for graceful stop)
  hasStopRequest(): boolean {
    return this.stopRequested
  }
  
  // Confirm stop (graceful stop after completing current step)
  confirmStop() {
    this.stopped = true
  }
}
```

### Agent Integration

```typescript
class WukongAgent {
  private stopController = new StopController()
  
  async execute(options: TaskOptions) {
    // Reset stop state
    this.stopController = new StopController()
    
    while (!this.isTaskComplete()) {
      // 🔑 Check stop signal before each step
      if (this.stopController.shouldStop()) {
        this.emit('task:stopped', {
          reason: 'user_requested',
          completedSteps: this.history.steps.length,
          partialResult: this.getPartialResult()
        })
        throw new TaskStoppedError()
      }
      
      // Execute step
      const step = await this.executeNextStep()
      
      // 🔑 If stop request after step completes (graceful stop)
      if (this.stopController.hasStopRequest()) {
        this.stopController.confirmStop()
        this.emit('task:stopping', { currentStep: step })
      }
    }
  }
  
  // Stop method
  async stop(sessionId: string, options?: StopOptions) {
    const graceful = options?.graceful ?? true
    
    this.emit('task:stopping')
    this.stopController.requestStop(graceful)
    
    if (options?.saveState) {
      await this.saveCheckpoint(sessionId)
    }
  }
  
  // Force stop
  async forceStop(sessionId: string) {
    this.stopController.requestStop(false)
    this.emit('task:stopped', {
      reason: 'force_stopped',
      completedSteps: this.history.steps.length
    })
  }
}
```

[← Previous Chapter: Trustworthiness Design](./09-trustworthiness.md) | [Next Chapter: Usage Examples →](./11-examples.md)

