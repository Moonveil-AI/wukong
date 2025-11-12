# Appendix A: Trustworthiness Feature Checklist

This appendix provides a complete checklist for implementing the 30 trustworthiness principles.

---

## Complete Checklist

| # | Trustworthy Principle | Core Library | UI Component Package | Completeness |
|---|----------------------|--------------|---------------------|--------------|
| **Startup Phase** |
| 1 | Clearly list what can/cannot do | ✅ `getCapabilities()` | ✅ `<CapabilitiesPanel>` | 100% |
| 2 | Skill tree/tag display | ✅ Skills Registry | ✅ `<SkillsTree>` | 100% |
| 3 | Example commands | ✅ Configuration option | ✅ `<ExamplePrompts>` | 100% |
| 4 | New feature notification | ✅ Version API | ✅ `<UpdateBanner>` | 100% |
| 5 | Mark information sources | ✅ Returns with source | ✅ Auto-mark | 100% |
| **Before Execution** |
| 6 | Generate draft | ✅ `onPlanReady` | ✅ `<PlanPreview>` | 100% |
| 7 | Sidebar/modal | ✅ Event system | ✅ `<Sidebar>` `<Modal>` | 100% |
| 8 | Accept/edit options | ✅ callback | ✅ `<ActionButtons>` | 100% |
| 9 | Display execution plan | ✅ `plan:generated` | ✅ `<ExecutionPlan>` | 100% |
| 10 | Expandable checklist | ✅ Todo List | ✅ `<TodoList>` | 100% |
| 11 | Real-time outline display | ✅ streaming | ✅ `<ThinkingBox>` | 100% |
| **During Execution** |
| 12 | Real-time status display | ✅ `step:started` | ✅ `<StatusIndicator>` | 100% |
| 13 | Progress bar/counter | ✅ progress event | ✅ `<ProgressBar>` | 100% |
| 14 | Decision log | ✅ reasoning event | ✅ `<DecisionLog>` | 100% |
| 15 | Reasoning process | ✅ streaming | ✅ Auto-display | 100% |
| 16 | Notify cost | ✅ `tokens:used` | ✅ `<CostIndicator>` | 100% |
| 17 | Answer with "why" | ✅ reasoning field | ✅ `<WhyButton>` | 100% |
| **After Errors** |
| 18 | Undo function | ✅ `undo()` | ✅ `<UndoButton>` | 100% |
| 19 | Version history | ✅ checkpoint | ✅ `<VersionHistory>` | 100% |
| 20 | Sandbox simulation | ⚠️ Tool layer | ✅ `<SandboxPreview>` | 80% |
| 21 | Comparison view | ✅ diff data | ✅ `<DiffView>` | 100% |
| 22 | Stop button | ✅ `stop()` | ✅ `<StopButton>` | 100% |
| 23 | Human confirmation | ✅ Confirmation event | ✅ `<ConfirmDialog>` | 100% |
| 24 | Escalate to human | ✅ Error detection | ✅ `<EscalateButton>` | 100% |
| **New Loop** |
| 25 | Long-term memory selection | ✅ Configuration option | ✅ `<MemorySettings>` | 100% |
| 26 | One-click restart | ✅ `redoStep()` | ✅ `<RetryButton>` | 100% |
| 27 | Thumbs up/down feedback | ✅ Feedback API | ✅ `<FeedbackButtons>` | 100% |
| 28 | Feedback form | ✅ Feedback API | ✅ `<FeedbackForm>` | 100% |
| 29 | Task completion rate | ✅ Statistics API | ✅ `<MetricsDashboard>` | 100% |
| 30 | Trust index | ✅ Calculation API | ✅ `<TrustScore>` | 100% |

**Complete Support Rate: 30/30 (100%)** ✅

---

## Two Packages Work Together

### @wukong/agent - Core Engine and API

Provides all underlying capabilities and event system:
- Agent controller
- Session management
- History and checkpoints
- Event emitter
- Tool execution
- Knowledge Base

### @wukong/agent-ui - Ready-to-Use React Components

Provides complete UI components:
- Complete chat interface
- Individual composable components
- React Hooks
- Theme system
- Responsive design

---

## Implementation Details

### Startup Phase (Principles 1-5)

#### 1. Capability Description
```typescript
const capabilities = await agent.getCapabilities()
// Returns: { can: [...], cannot: [...] }
```

#### 2. Skill Tree Display
```typescript
const skills = agent.skillsRegistry.getAll()
// UI component auto-categorizes display
```

#### 3. Example Commands
```typescript
const examples = agent.getExamplePrompts()
// Auto-generated based on tools and Skills
```

#### 4. New Feature Notification
```typescript
const updates = await agent.checkUpdates()
// Compare version numbers, show new features
```

#### 5. Information Sources
```typescript
// Each response automatically includes source
{
  result: "...",
  sources: [
    { type: 'knowledge', file: 'doc.md', line: 42 },
    { type: 'tool', name: 'search' }
  ]
}
```

### Before Execution (Principles 6-11)

#### 6-8. Plan Preview and Editing
```typescript
agent.on('plan:generated', async (plan) => {
  // Display plan
  const action = await showPlanPreview(plan)
  if (action === 'edit') {
    return editPlan(plan)
  }
  return action === 'accept'
})
```

#### 9-10. Todo Checklist
```typescript
agent.on('todos:generated', (todos) => {
  // Auto-display expandable checklist
  showTodoList(todos)
})
```

#### 11. Streaming Outline
```typescript
agent.on('llm:streaming', (chunk) => {
  // Real-time update thinking process
  appendToOutline(chunk.text)
})
```

### During Execution (Principles 12-17)

#### 12-13. Status and Progress
```typescript
agent.on('step:started', (step) => {
  showStatus(step.description)
})

agent.on('progress:updated', (progress) => {
  updateProgressBar(progress)
})
```

#### 14-15. Decision and Reasoning
```typescript
agent.on('reasoning:available', (reasoning) => {
  showDecisionLog(reasoning)
})
```

#### 16. Cost Notification
```typescript
agent.on('tokens:used', (usage) => {
  showCostIndicator(usage.estimatedCost)
})
```

#### 17. Explain Reasons
```typescript
// Each step automatically includes reasoning
{
  action: "CallTool",
  reasoning: "User needs to analyze data, select Excel tool"
}
```

### After Errors (Principles 18-24)

#### 18-19. Undo and Version
```typescript
await agent.undo(sessionId)
const versions = await agent.getVersionHistory(sessionId)
```

#### 20. Sandbox Simulation
```typescript
// High-risk tools support dryRun mode
const preview = await tool.execute(params, { dryRun: true })
```

#### 21. Comparison View
```typescript
const diff = agent.compareVersions(versionA, versionB)
// Returns: { added: [...], removed: [...], modified: [...] }
```

#### 22-23. Stop and Confirmation
```typescript
// Stop button always available
await agent.stop(sessionId, { graceful: true })

// High-risk operations require confirmation
agent.on('action:requiresConfirmation', async (action) => {
  return await showConfirmDialog(action)
})
```

#### 24. Escalate to Human
```typescript
// When error retry exceeds limit
if (retryCount >= MAX_RETRIES) {
  showEscalateOption("Needs human intervention")
}
```

### New Loop (Principles 25-30)

#### 25. Memory Selection
```typescript
// User controls what information to retain
const settings = {
  rememberPreferences: true,
  rememberData: false,
  retentionDays: 30
}
```

#### 26. One-Click Restart
```typescript
await agent.redoStep(stepId)
// Or redo entire task
await agent.retryTask(sessionId)
```

#### 27-28. Feedback System
```typescript
// Thumbs up/down
await agent.submitFeedback(stepId, { rating: 'positive' })

// Detailed feedback
await agent.submitDetailedFeedback({
  stepId,
  category: 'incorrect_result',
  details: "Result doesn't match expectations",
  suggestion: "Should..."
})
```

#### 29-30. Metrics and Trust Score
```typescript
// Task completion rate
const metrics = await agent.getMetrics()
// { successRate: 0.95, avgSteps: 12, ... }

// Trust index (comprehensive multiple factors)
const trustScore = agent.calculateTrustScore()
// Based on: success rate, user feedback, undo count etc.
```

---

## UI Component Usage Examples

### Complete Solution (Ready-to-Use)

```tsx
import { AgentChat } from '@wukong/agent-ui'

<AgentChat config={agentConfig} />
// Automatically includes UI for all 30 principles
```

### Custom Composition

```tsx
import {
  CapabilitiesPanel,
  ExecutionPlan,
  TodoList,
  ProgressBar,
  StopButton,
  UndoButton,
  FeedbackButtons
} from '@wukong/agent-ui'

function CustomAgentUI() {
  return (
    <>
      <CapabilitiesPanel />  {/* Principles 1-2 */}
      <ExecutionPlan />      {/* Principles 9-10 */}
      <ProgressBar />        {/* Principle 13 */}
      <TodoList />           {/* Principle 10 */}
      <StopButton />         {/* Principle 22 */}
      <UndoButton />         {/* Principle 18 */}
      <FeedbackButtons />    {/* Principle 27 */}
    </>
  )
}
```

[← Back to README](./README.md) | [Next: UI Component Package →](./appendix-ui-components.md)

