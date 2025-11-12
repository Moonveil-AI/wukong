# Tools System

## Table of Contents
- [Tool Definition](#tool-definition)
- [MCP Code Execution Pattern](#mcp-code-execution-pattern)
- [Async Tool Execution](#async-tool-execution)
- [High-Risk Tools](#high-risk-tools)

---

## Tool Definition

### Directory Structure

```
tools/
├── image-generator/
│   ├── metadata.json       # Tool metadata
│   ├── handler.ts          # Tool implementation
│   └── schema.json         # Parameter schema
└── pdf-reader/
    ├── metadata.json
    ├── handler.ts
    └── schema.json
```

### metadata.json

Tool metadata and configuration:

```json
{
  "name": "generate_image",
  "description": "Generate high-quality images",
  "version": "1.0.0",
  "category": "media",
  "riskLevel": "low",
  "timeout": 60,
  "requiresConfirmation": false,
  "async": false,
  "estimatedTime": 15
}
```

**Field Description:**

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Tool name (unique identifier) |
| `description` | string | Function description |
| `version` | string | Version number |
| `category` | string | Category (media/data/text/code) |
| `riskLevel` | string | Risk level (low/medium/high) |
| `timeout` | number | Timeout (seconds) |
| `requiresConfirmation` | boolean | Whether user confirmation required |
| `async` | boolean | Whether async execution |
| `estimatedTime` | number | Estimated execution time (seconds) |

### schema.json

Parameter definition (JSON Schema format):

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "prompt": {
      "type": "string",
      "description": "Image description"
    },
    "size": {
      "type": "string",
      "enum": ["256x256", "512x512", "1024x1024"],
      "default": "512x512"
    },
    "style": {
      "type": "string",
      "enum": ["natural", "vivid"],
      "default": "vivid"
    }
  },
  "required": ["prompt"]
}
```

### handler.ts

Actual tool implementation:

```typescript
import { ToolHandler } from '@wukong/agent'

export const handler: ToolHandler = async (params, context) => {
  const { prompt, size, style } = params
  
  // Execute tool logic
  const imageUrl = await generateImage(prompt, {
    size,
    style,
    apiKey: context.apiKeys.openai
  })
  
  // Return result
  return {
    success: true,
    result: {
      imageUrl,
      size,
      format: 'png',
      prompt
    },
    // Optional: result summary (for MCP mode)
    summary: `Generated image: ${prompt.substring(0, 30)}...`
  }
}

// Optional: tool-specific error handling
export const onError = async (error: Error, params: any) => {
  if (error.message.includes('content_policy_violation')) {
    return {
      success: false,
      error: 'Image content violated content policy, please modify description',
      canRetry: true,
      suggestion: 'Try using safer description words'
    }
  }
  throw error
}
```

---

## MCP Code Execution Pattern

### Traditional Mode Problem

```typescript
// Traditional mode: send complete schema every call
Prompt includes:
- Tool name
- Tool description
- Complete parameter schema (possibly thousands of tokens)
- Examples

Each tool ~2000 tokens
50 tools = ~100,000 tokens
```

### MCP Mode Advantage

```typescript
// MCP mode: schema cached locally
Prompt only includes:
- Tool name list
- Brief description

Each tool ~50 tokens
50 tools = ~2,500 tokens

Savings: 97.5%
```

### Enable MCP Mode

```typescript
const agent = new WukongAgent({
  tokenConfig: {
    enableMCP: true  // Enable MCP Code Execution
  }
})
```

### MCP Execution Flow

```typescript
// 1. LLM returns tool call (no schema)
const llmResponse = {
  action: "CallTool",
  tool: "generate_image",
  parameters: {
    prompt: "a beautiful sunset",
    size: "512x512"
  }
}

// 2. Local executor validates and executes
class ToolExecutor {
  async execute(toolCall: ToolCall) {
    // 2.1 Load tool
    const tool = await this.registry.getTool(toolCall.tool)
    
    // 2.2 Validate parameters (based on local schema)
    const validation = validateParameters(
      toolCall.parameters,
      tool.schema
    )
    if (!validation.valid) {
      throw new ValidationError(validation.errors)
    }
    
    // 2.3 Execute tool
    const result = await tool.handler(
      toolCall.parameters,
      this.context
    )
    
    // 2.4 Return summary (not complete result)
    return {
      toolName: tool.name,
      summary: result.summary || "Tool executed successfully",
      status: "completed"
    }
  }
}

// 3. Agent continues next step (uses summary, not complete result)
```

### Result Summary Strategy

```typescript
// Summary strategies for different tool types
const summarizers = {
  // Image generation: return URL
  'generate_image': (result) => ({
    summary: `Generated image: ${result.imageUrl}`,
    metadata: { size: result.size, format: result.format }
  }),
  
  // Data analysis: return key metrics
  'analyze_data': (result) => ({
    summary: `Analyzed ${result.rowCount} rows of data, found ${result.insights.length} insights`,
    keyMetrics: result.keyMetrics
  }),
  
  // Text generation: return beginning
  'generate_text': (result) => ({
    summary: `Generated ${result.wordCount} words of text`,
    preview: result.text.substring(0, 100) + '...'
  })
}
```

---

## Async Tool Execution

### Why Async Is Needed

Some tools take a long time to execute (like video generation), in Serverless environments:
- ❌ Sync wait: timeout, high cost
- ✅ Async execution: immediate return, background polling

### Async Tool Definition

```typescript
// metadata.json
{
  "name": "generateVideo",
  "async": true,
  "asyncType": "polling",  // or "webhook"
  "estimatedTime": 120,
  "pollingInterval": 5,     // seconds
  "maxRetries": 50,
  "webhookPath": "/api/webhooks/video-complete"
}
```

### Handler Implementation

```typescript
// handler.ts
export const handler: AsyncToolHandler = {
  // Submit task
  async submit(params: VideoParams): Promise<string> {
    const response = await fetch('https://kling-api.com/generate', {
      method: 'POST',
      body: JSON.stringify({
        prompt: params.prompt,
        duration: params.duration
      })
    })
    
    // Return external API's task ID
    return response.taskId
  },
  
  // Query progress (only needed for polling type)
  async poll(externalTaskId: string): Promise<TaskStatus> {
    const response = await fetch(
      `https://kling-api.com/tasks/${externalTaskId}`
    )
    
    return {
      status: response.status,  // 'pending' | 'processing' | 'completed' | 'failed'
      progress: response.progress,  // 0-100
      result: response.status === 'completed' ? response.result : undefined
    }
  },
  
  // Webhook handling (only needed for webhook type)
  async onWebhook(payload: any): Promise<void> {
    // Verify signature
    if (!verifySignature(payload)) {
      throw new Error('Invalid webhook signature')
    }
    
    // Extract result
    return {
      status: payload.status,
      result: payload.output_url
    }
  }
}
```

### Agent Using Async Tools

```typescript
// 1. Agent recognizes async tool
agent.on('tool:async:submitted', (task) => {
  console.log("Async task submitted:", {
    toolName: task.toolName,
    taskId: task.internalTaskId,
    estimatedTime: task.estimatedTime
  })
  
  // UI shows waiting state
  showProgressBar({
    message: "Generating video, estimated 2 minutes...",
    taskId: task.taskId
  })
})

// 2. Receive progress updates
agent.on('tool:async:progress', (update) => {
  console.log(`Task progress: ${update.progress}%`)
  updateProgressBar(update.taskId, update.progress)
})

// 3. Task complete
agent.on('tool:async:completed', (result) => {
  console.log("Task completed:", result.taskId)
  showResult(result.data)
  
  // Agent automatically continues with next step
})

// 4. Task failed
agent.on('tool:async:failed', (error) => {
  console.error("Task failed:", error)
  showErrorDialog(error.message)
})
```

### Async Tool Advantages

| Feature | Sync Wait | Async Execution |
|---------|-----------|-----------------|
| Serverless occupation | Continuous 120s | <1s every 5s |
| Cost | High | Low (save 95%) |
| User experience | Blocking | Can do other things |
| Timeout limit | Limited (Vercel 60s) | Unlimited |
| Parallel capability | Cannot parallel | Can parallel multiple |

---

## High-Risk Tools

### Define High-Risk Tool

```typescript
// metadata.json
{
  "name": "delete_file",
  "riskLevel": "high",
  "requiresConfirmation": true,
  "confirmationMessage": "This operation will permanently delete the file and cannot be recovered. Continue?",
  "destructive": true
}
```

### Confirmation Flow

```typescript
// Agent triggers confirmation before execution
agent.on('tool:requiresConfirmation', async (tool) => {
  const confirmed = await showConfirmDialog({
    title: "Confirmation Required",
    message: tool.confirmationMessage,
    icon: "⚠️",
    details: {
      toolName: tool.name,
      parameters: tool.parameters,
      risks: [
        "File will be permanently deleted",
        "This operation is irreversible",
        "No recycle bin"
      ]
    },
    actions: [
      { label: "Cancel", value: false, style: "secondary" },
      { label: "I understand the risks, continue", value: true, style: "destructive" }
    ]
  })
  
  return confirmed
})
```

### Risk Level Definition

| Risk Level | Description | Examples | Confirmation Required |
|-----------|-------------|----------|----------------------|
| **low** | Read-only operations with no side effects | Search, read | No confirmation |
| **medium** | Create/modify resources | Generate image, write file | Optional |
| **high** | Irreversible destructive operations | Delete, publish, payment | Must confirm |

### Security Safeguards

```typescript
// 1. Sandbox execution
const result = await executeTool(tool, {
  sandbox: true,           // Execute in sandbox
  dryRun: tool.riskLevel === 'high'  // Preview for high risk first
})

// 2. Operation log
await auditLog.record({
  action: 'tool_execution',
  toolName: tool.name,
  userId: session.userId,
  parameters: tool.parameters,
  result: result,
  timestamp: Date.now()
})

// 3. Undo support
if (tool.supportUndo) {
  const undoData = await tool.createUndoData(result)
  await session.saveUndoData(step.id, undoData)
}
```

---

## Tool Discovery and Registration

### Auto-Discovery

```typescript
const agent = new WukongAgent({
  tools: {
    path: './tools',
    autoDiscover: true  // Auto-scan directory
  }
})

// Agent automatically at startup:
// 1. Scan tools directory
// 2. Load all metadata.json
// 3. Validate schema.json
// 4. Register to ToolsRegistry
```

### Manual Registration

```typescript
// Dynamically register tool
await agent.registerTool({
  name: 'custom_tool',
  handler: async (params) => {
    // Custom logic
    return { success: true, result: '...' }
  },
  schema: {...},
  metadata: {...}
})

// Unregister tool
await agent.unregisterTool('custom_tool')
```

### Tool Grouping

```typescript
// Organize tools by category
const toolGroups = {
  media: ['generate_image', 'generate_video', 'edit_image'],
  data: ['analyze_csv', 'query_database', 'generate_chart'],
  text: ['summarize', 'translate', 'generate_text'],
  code: ['execute_code', 'lint_code', 'format_code']
}

// Load only relevant tools based on task type
const relevantTools = await agent.getToolsByCategory('media')
```

[← Previous Chapter: Knowledge Base System](./04-knowledge-base.md) | [Next Chapter: Advanced Features →](./06-advanced-features.md)

