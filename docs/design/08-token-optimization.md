# Token Optimization Mechanisms

> **Note:** Wukong's token optimization is a key reason we built a custom knowledge base. See [Why Not Use mem0?](../why-not-mem0.md) for details on architectural decisions.

## Table of Contents
- [Three Major Savings Strategies](#three-major-savings-strategies)
- [Tool Executor Mode](#tool-executor-mode)
- [Skills Lazy Loading](#skills-lazy-loading)
- [Smart Step Discarding](#smart-step-discarding)
- [Token Usage Monitoring](#token-usage-monitoring)

---

## Three Major Savings Strategies

Wukong dramatically saves token usage through three mechanisms:

| Strategy | Savings Ratio | Principle |
|----------|---------------|-----------|
| **Tool Executor Mode** | 98% | Schema doesn't enter Prompt, local validation |
| **Skills Lazy Loading** | 98% | Only load relevant Skills, not all |
| **Smart Step Discarding** | 60-80% | LLM actively marks useless steps |

---

## Tool Executor Mode

### Traditional Mode Problem

```typescript
// Traditional Function Calling mode
Prompt includes:
├─ System prompt (500 tokens)
├─ User goal (100 tokens)
├─ History (5,000 tokens)
└─ Tools schemas (150,000 tokens)  // 🔴 Huge overhead
    ├─ tool_1: { name, description, parameters: {...} }
    ├─ tool_2: { name, description, parameters: {...} }
    └─ ... 50 tools

Total: ~155,600 tokens
Cost: $0.47 per call (GPT-4 pricing)
```

### Tool Executor Mode Advantage

```typescript
// Tool Executor mode
Prompt includes:
├─ System prompt (500 tokens)
├─ User goal (100 tokens)
├─ History (5,000 tokens)
└─ Tools list (2,500 tokens)  // ✅ Only names and brief descriptions
    ├─ tool_1: "generate_image - Generate images"
    ├─ tool_2: "analyze_data - Analyze data"
    └─ ... 50 tools

Total: ~8,100 tokens
Cost: $0.02 per call (GPT-4 pricing)

Savings: 94.8%
```

### How It Works

```typescript
// 1. LLM only returns tool name and parameters (no schema)
{
  "action": "CallTool",
  "tool": "generate_image",
  "parameters": {
    "prompt": "a beautiful sunset",
    "size": "1024x1024"
  }
}

// 2. Local executor validates parameters
class ToolExecutor {
  async execute(toolCall: ToolCall) {
    // 2.1 Load complete schema from local
    const tool = await this.registry.getTool(toolCall.tool)
    const schema = tool.schema  // Loaded locally, doesn't consume LLM tokens
    
    // 2.2 Validate parameters
    const validation = validateParameters(toolCall.parameters, schema)
    if (!validation.valid) {
      throw new ValidationError(validation.errors)
    }
    
    // 2.3 Execute tool
    const result = await tool.handler(toolCall.parameters)
    
    // 2.4 Return summary (not complete result)
    return {
      toolName: tool.name,
      summary: result.summary || "Executed successfully",
      status: "completed"
    }
  }
}

// 3. Agent continues using summary, complete result doesn't enter history
```

### Result Summary Strategy

```typescript
// Summary strategies for different tools
interface ToolResultSummarizer {
  // Image generation: only return URL
  generate_image: (result) => ({
    summary: `Image generated`,
    imageUrl: result.url
  }),
  
  // Data analysis: only return key numbers
  analyze_data: (result) => ({
    summary: `Analyzed ${result.rows} rows of data`,
    keyMetrics: {
      average: result.avg,
      total: result.sum
    }
  }),
  
  // Text generation: only return word count
  generate_text: (result) => ({
    summary: `Generated ${result.wordCount} words of content`,
    preview: result.text.substring(0, 50) + '...'
  })
}
```

### Enable Tool Executor Mode

```typescript
const agent = new WukongAgent({
  llmKey: process.env.OPENAI_API_KEY,
  tokenConfig: {
    enableToolExecutor: true  // 🔑 Enable Tool Executor mode
  }
})
```

---

## Skills Lazy Loading

### Traditional Loading Problem

```typescript
// Traditional way: load all Skills documents
All Skills documents → Prompt

50 Skills × 3,000 tokens/skill = 150,000 tokens
High cost, slow speed
```

### Lazy Loading Strategy

```typescript
// At startup: only load metadata
skills/
├── excel-handler/
│   ├── metadata.json (lightweight, ~200 bytes)
│   ├── SKILL.md (heavyweight, ~10KB, lazy loaded)
│   └── functions.ts
└── pdf-reader/
    ├── metadata.json (lightweight)
    ├── SKILL.md (heavyweight, lazy loaded)
    └── functions.ts

// Process:
// 1. Load all metadata.json at startup
// 2. Match relevant Skills based on user request
// 3. Only load SKILL.md of matched Skills
// 4. Load functions.ts when executing
```

### metadata.json Structure

```json
{
  "name": "excel-handler",
  "displayName": "Excel Handler",
  "description": "Read, edit, analyze Excel files",
  "keywords": ["excel", "spreadsheet", "table", "data"],
  "category": "data",
  "capabilities": [
    "Read Excel files",
    "Edit cells",
    "Calculate formulas",
    "Generate charts"
  ]
}
```

### Matching Algorithm

```typescript
class SkillsMatcher {
  async matchRelevantSkills(userQuery: string): Promise<Skill[]> {
    // 1. Keyword matching
    const keywordMatches = this.skills.filter(skill => 
      skill.keywords.some(keyword => 
        userQuery.toLowerCase().includes(keyword)
      )
    )
    
    // 2. Semantic matching (using embeddings)
    const queryEmbedding = await generateEmbedding(userQuery)
    const semanticMatches = await this.vectorSearch(queryEmbedding, topK: 5)
    
    // 3. Merge and deduplicate
    const allMatches = [...keywordMatches, ...semanticMatches]
    const unique = deduplicateById(allMatches)
    
    // 4. Sort by relevance
    return unique.sort((a, b) => b.score - a.score)
  }
}
```

### Listen to Matching Events

```typescript
agent.on('skills:matched', (skills) => {
  console.log("Matched Skills:", skills.map(s => s.name))
  // Output: ["Excel Handler", "Chart Generator"]
  // Only these two's SKILL.md will be loaded into Prompt
})
```

### Token Comparison

```
Traditional way (load all 50 Skills):
- Prompt size: ~150,000 tokens
- Cost: $0.45 per call

Lazy loading way (only load 2 relevant Skills):
- Prompt size: ~6,000 tokens  
- Cost: $0.02 per call

Savings: 95.5%
```

---

## Smart Step Discarding and Compression

### Problem

After 100 steps of long task execution, History contains:
```
User goal (100 tokens)
+ Step 1 (500 tokens)
+ Step 2 (500 tokens)
+ ...
+ Step 100 (500 tokens)
= 50,100 tokens

Every LLM call must carry complete History
```

### Solution: Two-Level Optimization

LLM can optimize steps in two ways:
1. **Discard** - Completely remove unnecessary steps
2. **Compress** - Replace verbose steps with concise summaries

```typescript
interface AgentResponse {
  action: string
  reasoning: string
  parameters: any
  discardableSteps?: number[]  // 🆕 Steps to completely remove
  compressedSteps?: {          // 🆕 Steps to replace with compressed version
    stepId: number
    compressed: string         // LLM provides compressed content directly
  }[]
}

// LLM return example
{
  "action": "CallTool",
  "tool": "generate_chart",
  "parameters": {...},
  "reasoning": "User wants to generate chart",
  "discardableSteps": [5, 6, 7],  // These steps are useless, remove completely
  "compressedSteps": [             // These steps are important but verbose
    {
      "stepId": 8,
      "compressed": "Generated 3 product images. All approved by user. URLs saved."
    },
    {
      "stepId": 12,
      "compressed": "Analyzed sales data: Q1 revenue $1.2M, 15% growth, top product: Widget A."
    }
  ]
}
```

### Management Rules (defined in System Prompt)

```markdown
## Step Management

You can optimize steps in two ways to save tokens:

### 1. Discard (Complete Removal)
✅ Discard these:
- Confirmation steps with no new information ("OK", "I understand")
- Drafts that were rejected and replaced
- Errors that were immediately corrected
- Purely procedural steps with no useful data

### 2. Compress (Preserve Key Info)
✅ Compress these:
- Verbose tool outputs (keep only key results)
- Long user explanations (keep only requirements)
- Detailed analyses (keep only conclusions)
- Multi-paragraph responses (keep only action items)

### Always Keep in Full
❌ Never discard or compress:
- User's original goal and requirements
- Final effective solutions
- Error patterns that may reoccur
- Last 5 steps (maintain immediate context)
- Steps with unique insights or decisions

### How to Respond
In each response, include:
- `discardableSteps`: [5, 6, 7] - IDs of steps to remove
- `compressedSteps`: [
    { "stepId": 8, "compressed": "Brief summary of step 8" },
    { "stepId": 12, "compressed": "Key points from step 12" }
  ]
```

### Auto-Optimization

```typescript
// Enable auto-optimization (discard + compress)
const agent = new WukongAgent({
  tokenConfig: {
    autoOptimizeSteps: true  // Auto-optimize steps based on LLM suggestions
  }
})

// Agent internal processing
if (config.autoOptimizeSteps) {
  // Handle complete discards
  if (response.discardableSteps) {
    await session.discardSteps(response.discardableSteps)
    
    agent.emit('steps:discarded', {
      stepIds: response.discardableSteps,
      tokensSaved: calculateTokensSaved(response.discardableSteps)
    })
  }
  
  // Handle compressions (LLM provides compressed content)
  if (response.compressedSteps) {
    await session.compressSteps(response.compressedSteps)
    
    agent.emit('steps:compressed', {
      steps: response.compressedSteps,
      tokensSaved: calculateCompressionSavings(response.compressedSteps)
    })
  }
}
```

### Manual Management

```typescript
// Users can also manually manage steps
const steps = await agent.getSteps(sessionId)

// Completely discard useless steps
const unnecessarySteps = steps.filter(s => 
  s.description.includes('confirm') && !s.hasImportantInfo
)
await agent.discardSteps(
  sessionId, 
  unnecessarySteps.map(s => s.id)
)

// Manually compress verbose steps
await agent.compressSteps(sessionId, [
  {
    stepId: 12,
    compressed: "Custom compressed version of step 12"
  }
])
```

### Optimization Examples

#### Example 1: Discard Useless Steps
```typescript
// Original Step 5 (150 tokens)
Step 5: {
  action: "AskUser",
  message: "I understand you want to create a video. Let me help you with that."
}

// LLM Decision: Discard (no new information)
discardableSteps: [5]  // Step 5 removed completely
```

#### Example 2: Compress Verbose Output
```typescript
// Original Step 8 (800 tokens)
Step 8: {
  action: "CallTool",
  tool: "analyze_sales_data",
  result: `
    Detailed Analysis Report:
    
    Q1 2024 Sales Performance
    - January: $385,234.56 (1,234 orders, avg $312.15)
    - February: $421,567.89 (1,456 orders, avg $289.48)
    - March: $467,891.23 (1,678 orders, avg $278.89)
    
    Product Breakdown:
    - Widget A: $524,123 (42% of total)
    - Widget B: $398,456 (32% of total)
    - Widget C: $352,114 (26% of total)
    
    Customer Segments:
    - Enterprise: 35% of revenue
    - SMB: 45% of revenue
    - Individual: 20% of revenue
    
    [... 20 more lines of detailed statistics ...]
  `
}

// LLM Decision: Compress
compressedSteps: [
  {
    stepId: 8,
    compressed: "Analyzed Q1 sales: $1.27M total, 15% growth. Top product: Widget A (42%). Main segment: SMB (45%)."
  }
]  // Reduced from 800 tokens to ~30 tokens
```

### Optimization Effect

```typescript
// Token change for 100-step task
Initial: 50,100 tokens (includes all 100 steps)

After optimization:
- Discard 40 useless steps: -20,000 tokens
- Compress 30 verbose steps: -12,000 tokens (60% reduction)
- Keep 30 steps unchanged: 15,000 tokens
= Total: 18,100 tokens
- Savings: 64%

Continue to 200 steps:
- Continuously optimize steps
- History stabilizes at: ~20,000 tokens
- Instead of linear growth to 100,000+ tokens
```

---

## Token Usage Monitoring

### Real-time Monitoring

```typescript
// Listen to token usage
agent.on('tokens:used', (usage) => {
  console.log("Token usage:", {
    prompt: usage.promptTokens,
    completion: usage.completionTokens,
    total: usage.totalTokens,
    cost: usage.estimatedCost,
    savings: usage.savings  // Tokens saved through optimization
  })
  
  // Visual display
  updateTokenChart(usage)
})
```

### Set Budget

```typescript
const agent = new WukongAgent({
  tokenConfig: {
    maxTokensPerSession: 100000,
    warnThreshold: 80000,
    onBudgetWarning: (usage) => {
      console.warn("Token usage approaching budget")
      showWarning({
        title: "High Token Usage",
        message: `Used ${usage.totalTokens} / 100,000`,
        suggestion: "Suggest streamlining task or enabling more optimization"
      })
    }
  }
})
```

### Statistics Report

```typescript
// Get session token statistics
const stats = await agent.getTokenStats(sessionId)

console.log("Token statistics:")
console.log(`- Total usage: ${stats.totalTokens}`)
console.log(`- Prompt: ${stats.promptTokens}`)
console.log(`- Completion: ${stats.completionTokens}`)
console.log(`- Total cost: $${stats.totalCost}`)
console.log("\nSavings statistics:")
console.log(`- MCP savings: ${stats.mcpSavings} tokens (${stats.mcpSavingsPercent}%)`)
console.log(`- Skills savings: ${stats.skillsSavings} tokens (${stats.skillsSavingsPercent}%)`)
console.log(`- Discard savings: ${stats.discardSavings} tokens (${stats.discardSavingsPercent}%)`)
console.log(`- Total savings: ${stats.totalSavings} tokens (${stats.totalSavingsPercent}%)`)
```

### Comparison Analysis

```typescript
// Compare traditional mode vs Wukong optimization
const comparison = {
  traditional: {
    toolSchemas: 150000,
    allSkills: 150000,
    fullHistory: 50000,
    total: 350000,
    cost: 1.05  // $1.05 per call
  },
  wukong: {
    toolList: 2500,
    matchedSkills: 6000,
    prunedHistory: 10000,
    total: 18500,
    cost: 0.055  // $0.055 per call
  },
  savings: {
    tokens: 331500,  // 94.7%
    cost: 0.995,     // $0.995 per call
    percentage: 94.7
  }
}
```

---

## Best Practices

### 1. Enable All Optimizations

```typescript
const agent = new WukongAgent({
  tokenConfig: {
    enableToolExecutor: true,  // Enable Tool Executor mode
    enableSkills: true,         // Enable Skills lazy loading
    autoDiscard: true           // Enable auto-discard
  }
})
```

### 2. Monitor and Adjust

```typescript
// Periodically check token usage
agent.on('session:completed', async (session) => {
  const stats = await agent.getTokenStats(session.id)
  
  if (stats.totalTokens > 50000) {
    console.warn("High token usage, suggest checking:")
    console.log("- Are there duplicate steps?")
    console.log("- Can more history be discarded?")
    console.log("- Are unnecessary Skills loaded?")
  }
})
```

### 3. Combine with Other Optimizations

```typescript
// Use streaming output to reduce waiting
// Use async tools to reduce blocking
// Set maxSteps appropriately to avoid infinite loops

const agent = new WukongAgent({
  tokenConfig: {
    enableToolExecutor: true,
    enableSkills: true,
    autoDiscard: true
  },
  trustConfig: {
    maxSteps: 50  // Prevent runaway
  }
})
```

[← Previous Chapter: Todo List Mechanism](./07-todo-list.md) | [Next Chapter: Trustworthiness Design →](./09-trustworthiness.md)

