# Implementation Patterns and Best Practices

Detailed implementation patterns, error handling strategies, and performance optimizations based on production experience.

## Table of Contents
- [Error Handling and Retry](#error-handling-and-retry)
- [Multi-Model LLM Calling](#multi-model-llm-calling)
- [Async Tool Execution Patterns](#async-tool-execution-patterns)
- [Concurrency Control](#concurrency-control)
- [Performance Optimization](#performance-optimization)
- [Context Compression](#context-compression)
- [Security Best Practices](#security-best-practices)

---

## Error Handling and Retry

### Retry Decorator Pattern

```typescript
interface RetryOptions {
  maxAttempts: number
  backoffMs: number
  backoffMultiplier: number
  retryableErrors?: (error: Error) => boolean
}

function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  return async function attempt(attemptNumber: number): Promise<T> {
    try {
      return await fn()
    } catch (error) {
      // Check if we should retry
      if (
        attemptNumber >= options.maxAttempts ||
        (options.retryableErrors && !options.retryableErrors(error))
      ) {
        throw error
      }
      
      // Calculate backoff
      const delay = options.backoffMs * Math.pow(options.backoffMultiplier, attemptNumber - 1)
      
      console.log(`Attempt ${attemptNumber} failed, retrying in ${delay}ms...`)
      await new Promise(resolve => setTimeout(resolve, delay))
      
      return attempt(attemptNumber + 1)
    }
  }(1)
}

// Usage
const result = await withRetry(
  () => callExternalAPI(),
  {
    maxAttempts: 3,
    backoffMs: 1000,
    backoffMultiplier: 2,
    retryableErrors: (error) => {
      // Retry on network errors and rate limits, not on bad requests
      return error.code === 'NETWORK_ERROR' || 
             error.code === 'RATE_LIMIT' ||
             error.status === 429
    }
  }
)
```

### Error Classification

```typescript
enum ErrorType {
  // Retryable errors
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  
  // Non-retryable errors
  INVALID_PARAMETERS = 'INVALID_PARAMETERS',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  
  // Agent-specific errors
  MAX_STEPS_EXCEEDED = 'MAX_STEPS_EXCEEDED',
  MAX_DEPTH_EXCEEDED = 'MAX_DEPTH_EXCEEDED',
  TASK_STOPPED = 'TASK_STOPPED',
  NO_CREDITS = 'NO_CREDITS'
}

class AgentError extends Error {
  constructor(
    public type: ErrorType,
    message: string,
    public isRetryable: boolean = false,
    public metadata?: Record<string, any>
  ) {
    super(message)
    this.name = 'AgentError'
  }
}

// Error factory
function createError(type: ErrorType, message: string, metadata?: any): AgentError {
  const retryable = [
    ErrorType.NETWORK_ERROR,
    ErrorType.TIMEOUT_ERROR,
    ErrorType.RATE_LIMIT_ERROR,
    ErrorType.SERVICE_UNAVAILABLE
  ].includes(type)
  
  return new AgentError(type, message, retryable, metadata)
}
```

### Error Sanitization

```typescript
function sanitizeErrorMessage(error: Error | string): string {
  const message = typeof error === 'string' ? error : error.message
  
  // Remove file paths
  let sanitized = message.replace(/\/[\w\/\-_\.]+\//g, '')
  
  // Remove API keys and tokens
  sanitized = sanitized.replace(/[a-zA-Z0-9]{20,}/g, '***')
  
  // Remove internal stack traces
  sanitized = sanitized.split('\n')[0]
  
  // Limit length
  if (sanitized.length > 500) {
    sanitized = sanitized.substring(0, 497) + '...'
  }
  
  return sanitized
}

// Usage in tool execution
try {
  const result = await tool.execute(parameters)
  return result
} catch (error) {
  // Log full error internally
  console.error('Tool execution failed:', error)
  
  // Return sanitized error to user
  const sanitized = sanitizeErrorMessage(error)
  return {
    error: true,
    message: sanitized
  }
}
```

---

## Multi-Model LLM Calling

### Multi-Model Fallback Strategy

```typescript
interface ModelConfig {
  name: string
  provider: 'openai' | 'google' | 'anthropic'
  model: string
  temperature?: number
  maxTokens?: number
  costPerToken?: number
}

const MODEL_CONFIGS: ModelConfig[] = [
  {
    name: 'gemini-flash',
    provider: 'google',
    model: 'gemini-2.0-flash-exp',
    temperature: 0.7,
    costPerToken: 0.0001
  },
  {
    name: 'gpt-4o-mini',
    provider: 'openai',
    model: 'gpt-4o-mini',
    temperature: 0.7,
    costPerToken: 0.0002
  },
  {
    name: 'gpt-4o',
    provider: 'openai',
    model: 'gpt-4o',
    temperature: 0.7,
    costPerToken: 0.0015
  }
]

async function callLLMWithFallback(
  prompt: string,
  options: {
    models?: string[]
    validateFn?: (response: string) => boolean
    parseJson?: boolean
  } = {}
): Promise<string> {
  const modelsToTry = options.models || ['gpt-5.1-instant', 'gemini-flash', 'gpt-4o-mini', 'gpt-4o']
  
  let lastError: Error | null = null
  
  for (const modelName of modelsToTry) {
    const config = MODEL_CONFIGS.find(c => c.name === modelName)
    if (!config) continue
    
    try {
      console.log(`Attempting LLM call with ${modelName}...`)
      
      // Call specific provider
      let response: string
      switch (config.provider) {
        case 'openai':
          response = await callOpenAI(prompt, config)
          break
        case 'google':
          response = await callGemini(prompt, config)
          break
        case 'anthropic':
          response = await callClaude(prompt, config)
          break
        default:
          throw new Error(`Unknown provider: ${config.provider}`)
      }
      
      // Validate response if validator provided
      if (options.validateFn && !options.validateFn(response)) {
        throw new Error('Response failed validation')
      }
      
      // Parse JSON if requested
      if (options.parseJson) {
        try {
          JSON.parse(response)
        } catch {
          throw new Error('Response is not valid JSON')
        }
      }
      
      console.log(`✓ Success with ${modelName}`)
      return response
      
    } catch (error) {
      console.error(`✗ ${modelName} failed:`, error.message)
      lastError = error
      continue
    }
  }
  
  throw new Error(
    `All models failed. Last error: ${lastError?.message}`
  )
}
```

### Response Extraction and Validation

```typescript
function extractJSONFromResponse(response: string): any {
  // Try to extract JSON from XML tags
  const xmlMatch = response.match(/<final_output>(.*?)<\/final_output>/s)
  if (xmlMatch) {
    try {
      return JSON.parse(xmlMatch[1])
    } catch (error) {
      throw new Error('Failed to parse JSON from <final_output> tags')
    }
  }
  
  // Try to extract JSON from code blocks
  const codeBlockMatch = response.match(/```json\n(.*?)\n```/s)
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1])
    } catch (error) {
      throw new Error('Failed to parse JSON from code block')
    }
  }
  
  // Try to parse entire response as JSON
  try {
    return JSON.parse(response)
  } catch (error) {
    throw new Error('Response does not contain valid JSON')
  }
}

// Usage
const response = await callLLMWithFallback(prompt, {
  models: ['gemini-flash', 'gpt-4o-mini'],
  validateFn: (response) => {
    // Ensure response contains required XML tags
    return response.includes('<final_output>') && 
           response.includes('</final_output>')
  },
  parseJson: false  // We'll parse manually after extraction
})

const parsed = extractJSONFromResponse(response)
```

---

## Async Tool Execution Patterns

### Complete Async Execution Flow

```typescript
interface AsyncToolExecution {
  internalTaskId: string
  toolName: string
  parameters: any
  sessionId: string
  stepId: number
  status: 'pending' | 'running' | 'completed' | 'failed'
  externalTaskId?: string  // From external API
  result?: any
  error?: string
  startedAt?: Date
  completedAt?: Date
  retryCount: number
}

class AsyncToolExecutor {
  private cache: CacheAdapter
  
  async executeAsync(
    tool: Tool,
    parameters: any,
    context: {
      sessionId: string
      stepId: number
    }
  ): Promise<string> {
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    // 1. Create task record
    const task: AsyncToolExecution = {
      internalTaskId: taskId,
      toolName: tool.name,
      parameters,
      sessionId: context.sessionId,
      stepId: context.stepId,
      status: 'pending',
      retryCount: 0
    }
    
    await this.cache.set(`async:task:${taskId}`, task)
    
    // 2. Submit to external API (if applicable)
    if (tool.isAsync) {
      const externalTaskId = await tool.submitAsync(parameters)
      task.externalTaskId = externalTaskId
      task.status = 'running'
      task.startedAt = new Date()
      await this.cache.set(`async:task:${taskId}`, task)
    } else {
      // Execute immediately in background
      this.executeInBackground(taskId, tool, parameters)
    }
    
    // 3. Add to polling queue
    await this.cache.sadd('async:polling:queue', taskId)
    
    // 4. Trigger polling (non-blocking)
    await fetch('/api/async/poll-next', { method: 'POST' })
      .catch(err => console.error('Failed to trigger polling:', err))
    
    return taskId
  }
  
  private async executeInBackground(
    taskId: string,
    tool: Tool,
    parameters: any
  ): Promise<void> {
    const task = await this.cache.get(`async:task:${taskId}`)
    
    try {
      task.status = 'running'
      task.startedAt = new Date()
      await this.cache.set(`async:task:${taskId}`, task)
      
      // Execute tool
      const result = await withRetry(
        () => tool.execute(parameters),
        {
          maxAttempts: 3,
          backoffMs: 2000,
          backoffMultiplier: 2
        }
      )
      
      // Update task with result
      task.status = 'completed'
      task.result = result
      task.completedAt = new Date()
      await this.cache.set(`async:task:${taskId}`, task)
      
      // Remove from polling queue
      await this.cache.srem('async:polling:queue', taskId)
      
      // Notify agent
      await this.notifyCompletion(taskId)
      
    } catch (error) {
      task.status = 'failed'
      task.error = sanitizeErrorMessage(error)
      task.completedAt = new Date()
      await this.cache.set(`async:task:${taskId}`, task)
      
      await this.notifyFailure(taskId, error)
    }
  }
  
  async pollTask(taskId: string): Promise<boolean> {
    const task = await this.cache.get(`async:task:${taskId}`)
    if (!task) return false
    
    // If task has external API, poll it
    if (task.externalTaskId) {
      const tool = getToolByName(task.toolName)
      const externalStatus = await tool.pollStatus(task.externalTaskId)
      
      if (externalStatus.status === 'completed') {
        task.status = 'completed'
        task.result = externalStatus.result
        task.completedAt = new Date()
        await this.cache.set(`async:task:${taskId}`, task)
        await this.cache.srem('async:polling:queue', taskId)
        await this.notifyCompletion(taskId)
        return true
      } else if (externalStatus.status === 'failed') {
        task.status = 'failed'
        task.error = externalStatus.error
        task.completedAt = new Date()
        await this.cache.set(`async:task:${taskId}`, task)
        await this.cache.srem('async:polling:queue', taskId)
        await this.notifyFailure(taskId, new Error(externalStatus.error))
        return true
      }
    }
    
    return false  // Still running
  }
  
  private async notifyCompletion(taskId: string): Promise<void> {
    const task = await this.cache.get(`async:task:${taskId}`)
    
    // Update step in database
    await updateStepResult(task.stepId, task.result)
    
    // Emit event (for SSE/WebSocket)
    eventEmitter.emit('tool:completed', {
      taskId,
      stepId: task.stepId,
      sessionId: task.sessionId,
      result: task.result
    })
  }
  
  private async notifyFailure(taskId: string, error: Error): Promise<void> {
    const task = await this.cache.get(`async:task:${taskId}`)
    
    await updateStepError(task.stepId, error.message)
    
    eventEmitter.emit('tool:failed', {
      taskId,
      stepId: task.stepId,
      sessionId: task.sessionId,
      error: error.message
    })
  }
}
```

### Polling Worker Implementation

```typescript
// app/api/async/poll-next/route.ts
export async function POST(req: NextRequest) {
  // Get one task from queue (atomic pop)
  const taskId = await kv.spop('async:polling:queue')
  
  if (!taskId) {
    return NextResponse.json({ message: 'No tasks to poll' })
  }
  
  const executor = new AsyncToolExecutor(kv)
  const completed = await executor.pollTask(taskId)
  
  // If not completed, put back in queue
  if (!completed) {
    await kv.sadd('async:polling:queue', taskId)
  }
  
  // Trigger next poll (chain reaction)
  // Don't await to avoid blocking
  const nextTaskCount = await kv.scard('async:polling:queue')
  if (nextTaskCount > 0) {
    fetch('/api/async/poll-next', { method: 'POST' })
      .catch(err => console.error('Failed to trigger next poll:', err))
  }
  
  return NextResponse.json({ 
    taskId,
    completed,
    remainingTasks: nextTaskCount
  })
}
```

---

## Concurrency Control

### Database Row Locking

```typescript
async function updateStepWithLock(
  stepId: number,
  updateFn: (step: Step) => void
): Promise<void> {
  await sql.begin(async (tx) => {
    // SELECT FOR UPDATE locks the row
    const step = await tx`
      SELECT * FROM steps 
      WHERE id = ${stepId}
      FOR UPDATE NOWAIT
    `
    
    if (!step[0]) {
      throw new Error('Step not found')
    }
    
    // Apply updates
    updateFn(step[0])
    
    // Save changes
    await tx`
      UPDATE steps 
      SET 
        step_result = ${step[0].step_result},
        status = ${step[0].status},
        updated_at = NOW()
      WHERE id = ${stepId}
    `
  })
}

// Usage: Prevent duplicate writes from async tools
async function saveToolResult(stepId: number, result: any): Promise<void> {
  await updateStepWithLock(stepId, (step) => {
    // Only write if not already written
    if (step.step_result === null) {
      step.step_result = result
      step.status = 'completed'
    }
  })
}
```

### Distributed Locks with Redis/KV

```typescript
class DistributedLock {
  constructor(private cache: CacheAdapter) {}
  
  async acquire(
    lockKey: string,
    ttlSeconds: number = 30
  ): Promise<boolean> {
    // SET NX: Set if not exists
    const acquired = await this.cache.set(
      `lock:${lockKey}`,
      Date.now(),
      { nx: true, ex: ttlSeconds }
    )
    
    return acquired === 'OK'
  }
  
  async release(lockKey: string): Promise<void> {
    await this.cache.delete(`lock:${lockKey}`)
  }
  
  async withLock<T>(
    lockKey: string,
    fn: () => Promise<T>,
    options: { ttl?: number; retries?: number } = {}
  ): Promise<T> {
    const ttl = options.ttl || 30
    const maxRetries = options.retries || 3
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const acquired = await this.acquire(lockKey, ttl)
      
      if (acquired) {
        try {
          return await fn()
        } finally {
          await this.release(lockKey)
        }
      }
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)))
    }
    
    throw new Error(`Failed to acquire lock: ${lockKey}`)
  }
}

// Usage
const lock = new DistributedLock(kv)

await lock.withLock(`session:${sessionId}`, async () => {
  // Critical section: only one process can execute this at a time
  const session = await getSession(sessionId)
  session.status = 'running'
  await saveSession(session)
})
```

---

## Performance Optimization

### Result Caching

```typescript
interface CacheOptions {
  ttl?: number  // Seconds
  version?: string  // Cache version for invalidation
  keyPrefix?: string
}

function cached<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  options: CacheOptions = {}
): (...args: T) => Promise<R> {
  const ttl = options.ttl || 3600
  const version = options.version || 'v1'
  const prefix = options.keyPrefix || 'cache'
  
  return async (...args: T): Promise<R> => {
    // Generate cache key from function name and arguments
    const key = `${prefix}:${version}:${fn.name}:${JSON.stringify(args)}`
    
    // Try to get from cache
    const cached = await kv.get(key)
    if (cached !== null) {
      return cached as R
    }
    
    // Execute function
    const result = await fn(...args)
    
    // Store in cache
    await kv.set(key, result, { ex: ttl })
    
    return result
  }
}

// Usage
const searchKnowledge = cached(
  async (query: string, userId: string) => {
    const embedding = await generateEmbedding(query)
    const results = await vectorSearch(embedding, { userId })
    return results
  },
  { ttl: 3600, version: 'v2', keyPrefix: 'knowledge' }
)
```

### Batch Operations

```typescript
class BatchProcessor<T, R> {
  private queue: Array<{
    item: T
    resolve: (result: R) => void
    reject: (error: Error) => void
  }> = []
  
  private timer: NodeJS.Timeout | null = null
  
  constructor(
    private processFn: (items: T[]) => Promise<R[]>,
    private options: {
      maxBatchSize: number
      maxWaitMs: number
    }
  ) {}
  
  async add(item: T): Promise<R> {
    return new Promise((resolve, reject) => {
      this.queue.push({ item, resolve, reject })
      
      // Process immediately if batch is full
      if (this.queue.length >= this.options.maxBatchSize) {
        this.flush()
      } else {
        // Otherwise schedule flush
        if (!this.timer) {
          this.timer = setTimeout(
            () => this.flush(),
            this.options.maxWaitMs
          )
        }
      }
    })
  }
  
  private async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    
    if (this.queue.length === 0) return
    
    const batch = this.queue.splice(0, this.options.maxBatchSize)
    const items = batch.map(b => b.item)
    
    try {
      const results = await this.processFn(items)
      
      // Resolve all promises
      batch.forEach((b, i) => b.resolve(results[i]))
    } catch (error) {
      // Reject all promises
      batch.forEach(b => b.reject(error))
    }
  }
}

// Usage: Batch embedding generation
const embeddingBatcher = new BatchProcessor(
  async (texts: string[]) => {
    // Single API call for multiple texts
    return await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: texts
    }).then(response => response.data.map(d => d.embedding))
  },
  { maxBatchSize: 100, maxWaitMs: 100 }
)

// Multiple calls are automatically batched
const embedding1 = await embeddingBatcher.add("text 1")
const embedding2 = await embeddingBatcher.add("text 2")
const embedding3 = await embeddingBatcher.add("text 3")
// All three requests are sent in a single API call
```

---

## Context Compression

> **Note:** With Step Discarding already implemented (see [Token Optimization](./08-token-optimization.md)), we have sufficient token management for most use cases. Context compression is kept here as a reference for future optimization if needed, but is not required for the initial implementation.

### LLM-Based Compression

```typescript
async function compressAgentHistory(
  history: Step[],
  maxTokens: number = 2000
): Promise<string> {
  // Extract key steps
  const keySteps = history.filter(step => 
    step.action === 'CallTool' && 
    step.step_result !== null &&
    !step.discarded
  )
  
  const prompt = `
Summarize the following agent execution history into a concise summary (max ${maxTokens} tokens).
Focus on:
- What was accomplished
- Key decisions made
- Important results and outputs
- Any issues encountered

History:
${keySteps.map(step => `
Step ${step.step_number}:
Action: ${step.action}
Tool: ${step.selected_tool}
Result: ${step.step_result}
`).join('\n')}

Provide a 2-3 paragraph summary.
`
  
  const summary = await callLLMWithFallback(prompt, {
    models: ['gemini-flash']  // Use cheapest model for compression
  })
  
  return summary
}

// Usage for Agent Fork
async function forkAutoAgent(goal: string, parentHistory: History): Promise<string> {
  // Compress parent context
  const contextSummary = await compressAgentHistory(
    parentHistory.steps,
    500  // Max 500 tokens for context
  )
  
  // Create sub-agent with compressed context
  const subAgentId = await createSubAgent({
    goal,
    inheritedContext: contextSummary,
    depth: parentHistory.depth + 1
  })
  
  return subAgentId
}
```

---

## Security Best Practices

### Input Sanitization

```typescript
function sanitizeToolParameters(
  params: Record<string, any>,
  schema: Record<string, any>
): Record<string, any> {
  const sanitized: Record<string, any> = {}
  
  for (const [key, value] of Object.entries(params)) {
    const fieldSchema = schema[key]
    if (!fieldSchema) continue  // Skip unknown fields
    
    // Type validation
    if (typeof value !== fieldSchema.type) {
      throw new Error(`Parameter ${key} must be of type ${fieldSchema.type}`)
    }
    
    // String sanitization
    if (typeof value === 'string') {
      // Remove potentially dangerous characters
      sanitized[key] = value.replace(/[<>]/g, '')
      
      // Check length limits
      if (fieldSchema.maxLength && sanitized[key].length > fieldSchema.maxLength) {
        throw new Error(`Parameter ${key} exceeds maximum length`)
      }
    } else {
      sanitized[key] = value
    }
  }
  
  return sanitized
}
```

### Rate Limiting

```typescript
class RateLimiter {
  private cache: CacheAdapter
  
  async checkLimit(
    userId: string,
    action: string,
    limits: { requests: number; windowSeconds: number }
  ): Promise<boolean> {
    const key = `ratelimit:${userId}:${action}`
    const now = Date.now()
    const windowStart = now - (limits.windowSeconds * 1000)
    
    // Get request timestamps from cache
    const timestamps: number[] = await this.cache.get(key) || []
    
    // Remove old timestamps outside window
    const recentTimestamps = timestamps.filter(ts => ts > windowStart)
    
    // Check if limit exceeded
    if (recentTimestamps.length >= limits.requests) {
      return false  // Rate limit exceeded
    }
    
    // Add current timestamp
    recentTimestamps.push(now)
    
    // Save back to cache
    await this.cache.set(key, recentTimestamps, { 
      ex: limits.windowSeconds 
    })
    
    return true
  }
}

// Usage
const rateLimiter = new RateLimiter(kv)

// Check if user can create new session
const allowed = await rateLimiter.checkLimit(
  userId,
  'create_session',
  { requests: 10, windowSeconds: 60 }  // 10 sessions per minute
)

if (!allowed) {
  throw new AgentError(
    ErrorType.RATE_LIMIT_ERROR,
    'Rate limit exceeded. Please try again later.'
  )
}
```

---

[← Previous Chapter: Database Design](./13-database-design.md) | [Back to README →](./README.md)

