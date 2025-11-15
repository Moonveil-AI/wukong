# Core Design Principles

## Table of Contents
- [Visibility](#visibility)
- [Control](#control)
- [Reversibility](#reversibility)
- [Token Efficiency](#token-efficiency)

---

## Visibility

Users can see at any time:
- What the Agent can and cannot do
- What task is currently being executed
- Why it's being done this way
- Progress status

### Implementation

```typescript
// Capability description
const capabilities = await agent.getCapabilities()
console.log("What I can do:", capabilities.can)
console.log("What I cannot do:", capabilities.cannot)

// Execution status
agent.on('step:started', (step) => {
  console.log(`Executing: ${step.description}`)
  console.log(`Reasoning: ${step.reasoning}`)
})

// Progress display
agent.on('progress:updated', (progress) => {
  console.log(`Overall progress: ${progress}%`)
})
```

---

## Control

Users maintain control:
- Every important operation requires confirmation
- Critical steps can be intervened
- Can stop at any time
- Can adjust Agent behavior

### Implementation

```typescript
// Confirm plan before execution
agent.on('plan:generated', async (plan) => {
  const confirmed = await askUserConfirmation(plan)
  return confirmed
})

// Confirm before tool invocation
agent.on('tool:call', async (call) => {
  if (call.isHighRisk) {
    return await askUserConfirmation(call)
  }
  return true
})

// Stop anytime
await agent.stop(sessionId, {
  graceful: true,  // Graceful stop
  saveState: true  // Save state
})
```

---

## Reversibility

All operations can be:
- Undone
- Rolled back
- View historical versions
- Restored to any state

### Implementation

```typescript
// Undo last step
await agent.undo(sessionId)

// Undo to specific step
await agent.undoToStep(sessionId, stepId)

// Create checkpoint
const checkpoint = await agent.createCheckpoint(sessionId)

// Restore checkpoint
await agent.restoreCheckpoint(sessionId, checkpoint)

// View version history
const versions = await agent.getVersionHistory(sessionId)
```

---

## Token Efficiency

Save tokens through three major mechanisms:

### 1. Tool Executor Mode Pattern

**Problem:** In traditional mode, LLM must carry complete tool schemas each time, resulting in extremely high token consumption.

**Solution:** Schemas are cached in local executor, LLM only outputs tool name and parameters.

```typescript
// Traditional mode
// LLM needs to receive: complete tool schema (thousands of tokens)
// Returns: {"tool": "generate_image", "params": {...}}

// Tool Executor mode
// LLM only needs: tool name list (tens of tokens)
// Returns: {"tool": "generate_image", "params": {...}}
// Local executor validates parameters

// Token savings: 98%
```

### 2. Skills Lazy Loading

**Problem:** Loading all 50 Skills documents requires 150,000 tokens.

**Solution:** Only load matched Skills.

```typescript
// At startup: only load metadata.json (lightweight)
// Matching: match relevant Skills based on user request
// Loading: only load SKILL.md of matched Skills (~2,000 tokens)

agent.on('skills:matched', (skills) => {
  console.log("Matched Skills:", skills.map(s => s.name))
  // Output: ["Excel Handler", "Chart Generator"]
  // Only these two's documentation will enter Prompt
})

// Token savings: 98%
```

### 3. Smart Step Discarding

**Problem:** Long task history causes prompt bloat.

**Solution:** LLM actively marks discardable steps.

```typescript
interface AgentResponse {
  action: string
  reasoning: string
  parameters: any
  discardableSteps?: number[]  // 🆕 Discardable step IDs
}

// Discard rules (defined in Prompt):
// ✅ Can discard:
// - Steps with no new information
// - Purely procedural confirmations
// - Drafts replaced by better versions
// - Errors immediately corrected

// ❌ Must keep:
// - User's original requirements
// - Final effective solutions
// - Error patterns that may reoccur
// - Last 5 steps
```

### Token Savings Comparison

| Scenario | Traditional | Wukong | Savings |
|----------|-------------|--------|---------|
| Tool schema transfer | 150K tokens/call | 3K tokens/call | 98% |
| Skills document loading | 150K tokens | 2K tokens | 98% |
| Long task history | Linear growth | Smart pruning | 60-80% |

---

## Design Principles Summary

1. **Visibility First** - Users always know what's happening
2. **User Control** - Important operations require confirmation
3. **Rollbackable** - All operations can be undone
4. **Efficient Savings** - Save tokens through multiple mechanisms

These principles permeate the design and implementation of the entire system.

[← Back to README](./README.md) | [Next Chapter: Overall Architecture →](./02-architecture.md)

