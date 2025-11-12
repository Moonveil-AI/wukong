# Trustworthiness Design

This chapter details how to make Agents go from "smart" to "trustworthy."

## Table of Contents
- [Transparent Capability Boundaries](#transparent-capability-boundaries)
- [Execution Plan Preview](#execution-plan-preview)
- [Real-time Progress Display](#real-time-progress-display)
- [Visible Decision Process](#visible-decision-process)
- [Undo and Version Control](#undo-and-version-control)
- [Risk Operation Confirmation](#risk-operation-confirmation)
- [Stop Button Anytime](#stop-button-anytime)

---

## Transparent Capability Boundaries

Users need to clearly know what the Agent can and cannot do.

### Auto-Generate Capability Description

```typescript
// Agent automatically generates during initialization
const capabilities = await agent.getCapabilities()

console.log("What I can do:")
capabilities.can.forEach(cap => {
  console.log(`✓ ${cap.description}`)
  if (cap.limitations) {
    console.log(`  Limitations: ${cap.limitations}`)
  }
})

console.log("\nWhat I cannot do:")
capabilities.cannot.forEach(cap => {
  console.log(`✗ ${cap.description}`)
  if (cap.reason) {
    console.log(`  Reason: ${cap.reason}`)
  }
})
```

### Output Example

```
What I can do:
✓ Analyze CSV and Excel files
  Limitations: Maximum 10MB
✓ Generate images and simple charts
  Limitations: Maximum 5 images per generation
✓ Read and summarize PDF documents
  Limitations: Maximum 100 pages
✓ Search knowledge base
  Limitations: Only documents you've uploaded

What I cannot do:
✗ Query real-time web information
  Reason: No web search tool available
✗ Execute financial transactions
  Reason: Security considerations
✗ Modify system files
  Reason: No system file access permission
```

### UI Display

```tsx
function CapabilitiesPanel({ agent }) {
  const [capabilities, setCapabilities] = useState(null)
  
  useEffect(() => {
    agent.getCapabilities().then(setCapabilities)
  }, [])
  
  return (
    <div className="capabilities-panel">
      <h3>My Capabilities</h3>
      
      <div className="can-do">
        <h4>✓ What I Can Do</h4>
        {capabilities?.can.map(cap => (
          <div key={cap.id} className="capability-item">
            <strong>{cap.description}</strong>
            {cap.limitations && (
              <span className="limitation">({cap.limitations})</span>
            )}
          </div>
        ))}
      </div>
      
      <div className="cannot-do">
        <h4>✗ What I Cannot Do</h4>
        {capabilities?.cannot.map(cap => (
          <div key={cap.id} className="capability-item">
            <strong>{cap.description}</strong>
            {cap.reason && (
              <span className="reason">{cap.reason}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
```

---

## Execution Plan Preview

Before execution, let users see and confirm the plan.

### Generate Execution Plan

```typescript
agent.on('plan:generated', async (plan) => {
  console.log("📋 Execution Plan:")
  
  plan.steps.forEach((step, i) => {
    console.log(`${i+1}. ${step.description}`)
    
    if (step.tool) {
      console.log(`   Tool: ${step.tool.name}`)
    }
    
    if (step.estimatedTime) {
      console.log(`   Estimated: ${step.estimatedTime} seconds`)
    }
    
    if (step.risks && step.risks.length > 0) {
      console.log(`   ⚠️ Risks: ${step.risks.join(', ')}`)
    }
  })
  
  console.log(`\nTotal estimated time: ${plan.totalEstimatedTime} seconds`)
  console.log(`Estimated cost: $${plan.estimatedCost}`)
  
  // Let user confirm
  const confirmed = await askUser("How does the plan look?")
  return confirmed
})
```

### Output Example

```
📋 Execution Plan:

1. Read sales.csv file
   Tool: read_file
   Estimated: 2 seconds

2. Clean and validate data
   Tool: analyze_data
   Estimated: 5 seconds

3. Calculate key metrics
   Tool: calculate_metrics
   Estimated: 3 seconds

4. Generate trend chart
   Tool: generate_chart
   Estimated: 8 seconds

5. Write analysis report
   Tool: generate_text
   Estimated: 15 seconds

6. Send email to team
   Tool: send_email
   Estimated: 2 seconds
   ⚠️ Risks: Will send real email

Total estimated time: 35 seconds
Estimated cost: $0.08

👤 How does the plan look?
   [✓ Looks good, execute]  [✎ I want to modify]  [✗ Cancel]
```

### Plan Editing

```typescript
// Users can modify the plan
agent.on('plan:editRequested', async (plan) => {
  const edited = await showPlanEditor({
    plan,
    allowedActions: [
      'remove_step',
      'reorder_steps',
      'change_parameters'
    ]
  })
  
  return edited
})
```

---

## Real-time Progress Display

Clear status information lets users know what's happening.

### Step Status

```typescript
agent.on('step:started', (step) => {
  showStatus({
    message: step.description,
    icon: step.icon,
    progress: step.progress,
    estimatedTime: step.estimatedTime
  })
})

// Example output:
// 🔍 Searching knowledge base... (Step 1 of 5, 5 seconds remaining)
// 📊 Analyzing data... (Step 2 of 5, 30 seconds remaining)
// ✍️ Generating report... (Step 3 of 5, 10 seconds remaining)
```

### Progress Bar Component

```tsx
function ProgressBar({ progress, currentStep, totalSteps }) {
  return (
    <div className="progress-container">
      <div className="progress-bar">
        <div 
          className="progress-fill" 
          style={{ width: `${progress}%` }}
        />
      </div>
      
      <div className="progress-info">
        <span>{progress}%</span>
        <span>Step {currentStep} / {totalSteps}</span>
      </div>
    </div>
  )
}
```

### Detailed Status Log

```typescript
agent.on('step:detailed', (details) => {
  console.log(`\n[${details.timestamp}] ${details.step.title}`)
  console.log(`Status: ${details.status}`)
  
  if (details.tool) {
    console.log(`Tool: ${details.tool.name}`)
    console.log(`Parameters:`, details.tool.parameters)
  }
  
  if (details.progress) {
    console.log(`Progress: ${details.progress}%`)
  }
  
  if (details.eta) {
    console.log(`Estimated remaining: ${details.eta} seconds`)
  }
})
```

---

## Visible Decision Process

Show the Agent's reasoning process.

### Reasoning Log

```typescript
agent.on('reasoning:available', (reasoning) => {
  console.log("🧠 Decision Log:")
  
  reasoning.steps.forEach(step => {
    console.log(`${step.icon} ${step.description}`)
    
    if (step.reasoning) {
      console.log(`   Why: ${step.reasoning}`)
    }
    
    if (step.alternatives) {
      console.log(`   Other options considered:`)
      step.alternatives.forEach(alt => {
        console.log(`   - ${alt.description} (${alt.rejectedReason})`)
      })
    }
  })
})
```

### Output Example

```
🧠 Decision Log:

✓ Searched knowledge base (found 3 relevant documents)
   Why: User mentioned "sales report", need to reference historical data
   Other options considered:
   - Generate report directly (lacks necessary context)

✓ Selected Excel tool
   Why: File extension is .csv, suitable for Excel tool processing
   Other options considered:
   - Use PDF tool (file format mismatch)

✓ Decided to generate bar chart instead of line chart
   Why: Data is monthly statistics, bar chart is clearer
```

### LLM Streaming Thinking Process

```typescript
// Real-time display of LLM's thinking process
agent.on('llm:streaming', (chunk) => {
  appendToThinkingBox(chunk.text)
})

agent.on('llm:complete', (response) => {
  showFullReasoning(response)
})
```

---

## Undo and Version Control

All important operations can be undone.

### Step-Level Undo

```typescript
// Provide undo option after each step completes
agent.on('step:completed', (step) => {
  showResult(step.result, {
    actions: [
      {
        label: "Accept",
        handler: () => agent.acceptStep(step.id),
        primary: true
      },
      {
        label: "Edit",
        handler: () => agent.editStep(step.id)
      },
      {
        label: "Redo",
        handler: () => agent.redoStep(step.id)
      },
      {
        label: "Undo",
        handler: () => agent.undoStep(step.id),
        style: "destructive"
      }
    ]
  })
})
```

### Version History

```typescript
// View historical versions
const versions = await agent.getVersionHistory(sessionId)

console.log("Version history:")
versions.forEach((v, i) => {
  console.log(`Version ${i + 1}:`)
  console.log(`- Time: ${v.timestamp}`)
  console.log(`- Description: ${v.description}`)
  console.log(`- Changes: ${v.changes.length} steps`)
})

// Restore to specific version
await agent.restoreVersion(sessionId, versionId)
```

### Checkpoint System

```typescript
// Create checkpoint (save point)
const checkpoint = await agent.createCheckpoint(sessionId, {
  name: "Data analysis complete",
  description: "State before generating report"
})

// Restore to checkpoint
await agent.restoreCheckpoint(sessionId, checkpoint.id)

// List all checkpoints
const checkpoints = await agent.listCheckpoints(sessionId)
```

---

## Risk Operation Confirmation

High-risk operations must obtain explicit user confirmation.

### Confirmation Dialog

```typescript
agent.on('action:requiresConfirmation', async (action) => {
  const confirmed = await showConfirmDialog({
    title: "Confirmation Required",
    message: action.description,
    icon: "⚠️",
    details: action.details,
    risks: action.risks,
    actions: [
      { 
        label: "Cancel", 
        value: false,
        style: "secondary" 
      },
      { 
        label: "I understand the risks, continue", 
        value: true,
        style: "destructive" 
      }
    ]
  })
  
  return confirmed
})
```

### Example Dialog

```
⚠️ Confirmation Required

You are about to delete file: report_draft_v3.pdf

Note:
✓ This operation is irreversible
✓ File will be permanently deleted
✓ No recycle bin available

Impact scope:
- File size: 2.3 MB
- Created: 2 days ago
- Last modified: 1 hour ago

[Cancel] [I understand the risks, continue]
```

### Risk Scoring System

```typescript
// Auto-evaluate operation risk
function calculateRiskScore(action: Action): RiskLevel {
  let score = 0
  
  // Destructive operation
  if (action.isDestructive) score += 3
  
  // Involves external services
  if (action.involvesExternalService) score += 2
  
  // Involves costs
  if (action.hasCost) score += 2
  
  // Affects multiple resources
  if (action.affectedResources > 10) score += 1
  
  if (score >= 5) return 'high'
  if (score >= 3) return 'medium'
  return 'low'
}
```

---

## Stop Button Anytime

Users can safely stop the Agent anytime.

### Stop Button Configuration

```typescript
// Global stop button (always visible)
agent.setStopButton({
  position: 'floating',         // Floating button
  label: '⏸ Stop',
  confirmBeforeStop: false,     // Emergency stop doesn't need confirmation
  graceful: true                // Try graceful stop
})
```

### Stop Options

```typescript
agent.on('user:requestStop', async () => {
  const action = await showStopDialog({
    title: "Stop Task",
    message: `Currently executing: ${currentStep.description}`,
    options: [
      {
        label: "Stop after current step",
        value: "graceful",
        description: "Wait for current step to complete, save all progress"
      },
      {
        label: "Stop immediately",
        value: "immediate",
        description: "Stop right away, may lose current step",
        destructive: true
      },
      {
        label: "Cancel (continue execution)",
        value: "cancel"
      }
    ]
  })
  
  if (action === 'graceful') {
    await agent.stop(sessionId, { graceful: true })
  } else if (action === 'immediate') {
    await agent.forceStop(sessionId)
  }
})
```

### Post-Stop State Display

```typescript
agent.on('task:stopped', (state) => {
  showStopResult({
    message: "Task stopped",
    completedSteps: state.completedSteps,
    totalSteps: state.totalSteps,
    partialResult: state.partialResult,
    actions: [
      {
        label: "Continue execution",
        handler: () => agent.resume(sessionId),
        primary: true
      },
      {
        label: "Save current result",
        handler: () => agent.savePartialResult(sessionId)
      },
      {
        label: "Abandon and clean up",
        handler: () => agent.cleanup(sessionId),
        destructive: true
      }
    ]
  })
})
```

### Psychological Safety Principles

✓ Stop button always visible, easy to click  
✓ No confirmation needed to stop (avoid hesitation)  
✓ Provide both graceful stop and force stop options  
✓ Can view partial results after stopping  
✓ Support resuming execution

---

## Trustworthiness Checklist

Before deployment, ensure the following features are implemented:

### Startup Phase
- [ ] Clearly list what can/cannot do
- [ ] Display skill tree or tags
- [ ] Provide example commands
- [ ] Mark information sources

### Before Execution
- [ ] Generate draft for user confirmation
- [ ] Display execution plan
- [ ] Provide accept/edit options

### During Execution
- [ ] Real-time status display
- [ ] Show progress bar/counter
- [ ] Provide decision log
- [ ] Display reasoning process
- [ ] Stream LLM thinking

### After Errors
- [ ] Provide undo function
- [ ] Support version history
- [ ] Comparison view
- [ ] Stop button (always available)
- [ ] High-risk operations require confirmation

### New Loop
- [ ] Long-term memory selection
- [ ] One-click restart
- [ ] Feedback mechanism

For complete 30-principle implementation checklist, see [Appendix A](./appendix-trustworthiness.md).

[← Previous Chapter: Token Optimization](./08-token-optimization.md) | [Next Chapter: Implementation Details →](./10-implementation.md)

