# Appendix B: UI Component Package Design

This appendix introduces the detailed design of the `@wukong/agent-ui` component package.

---

## Installation

```bash
npm install @wukong/agent @wukong/agent-ui
```

---

## Core Components

### 1. Complete Chat Interface

The simplest integration method, ready-to-use:

```tsx
import { AgentChat } from '@wukong/agent-ui'

<AgentChat
  config={agentConfig}
  theme="light"              // 'light' | 'dark' | 'auto'
  showCapabilities={true}    // Display capability description
  showProgress={true}        // Display progress bar
  enableFeedback={true}      // Enable feedback buttons
  onPlanReady={(plan) => {
    // Plan ready callback
    return window.confirm(`Execute this plan?`)
  }}
  onProgress={(progress) => {
    // Progress callback
    console.log("Progress:", progress)
  }}
  onComplete={(result) => {
    // Complete callback
    console.log("Complete:", result)
  }}
/>
```

### 2. Individual Components (Freely Composable)

```tsx
import {
  // Startup phase
  CapabilitiesPanel,    // Capability description
  SkillsTree,           // Skill tree
  ExamplePrompts,       // Example commands
  UpdateBanner,         // New feature notification
  
  // Before execution
  PlanPreview,          // Plan preview
  ExecutionPlan,        // Execution plan
  TodoList,             // Task checklist
  ThinkingBox,          // LLM thinking process
  
  // During execution
  StatusIndicator,      // Status indicator
  ProgressBar,          // Progress bar
  DecisionLog,          // Decision log
  CostIndicator,        // Cost indicator
  
  // Control buttons
  StopButton,           // Stop button
  UndoButton,           // Undo button
  RetryButton,          // Retry button
  
  // Feedback and results
  ConfirmDialog,        // Confirmation dialog
  DiffView,             // Comparison view
  VersionHistory,       // Version history
  FeedbackButtons,      // Feedback buttons
  FeedbackForm,         // Feedback form
  
  // Statistics
  MetricsDashboard      // Metrics dashboard
} from '@wukong/agent-ui'

// Custom layout
<div className="agent-container">
  <CapabilitiesPanel agent={agent} />
  <ExamplePrompts examples={examples} />
  <ProgressBar progress={progress} />
  <TodoList todos={todos} />
  <StopButton onStop={handleStop} />
</div>
```

### 3. Hooks (More Flexible)

```tsx
import {
  useAgent,           // Agent state management
  useProgress,        // Progress tracking
  useTodos,           // Todo list
  useThinking,        // LLM thinking process
  useFeedback,        // Feedback collection
  useMetrics,         // Metrics statistics
  useHistory          // History management
} from '@wukong/agent-ui'

function MyCustomUI() {
  const { agent, execute, stop, isRunning } = useAgent(config)
  const { progress, currentStep, totalSteps } = useProgress(agent)
  const { todos, updateTodo } = useTodos(agent)
  const { thinking, isThinking } = useThinking(agent)
  const { submitFeedback } = useFeedback(agent)
  
  return (
    <div>
      <button onClick={() => execute({ goal: "..." })}>
        Execute
      </button>
      <button onClick={stop} disabled={!isRunning}>
        Stop
      </button>
      
      <div>Progress: {progress}%</div>
      <div>Step: {currentStep} / {totalSteps}</div>
      
      {isThinking && (
        <div className="thinking">{thinking}</div>
      )}
      
      {todos.map(todo => (
        <div key={todo.id}>{todo.title}</div>
      ))}
    </div>
  )
}
```

---

## Detailed Component Descriptions

### CapabilitiesPanel

Display Agent's capability boundaries.

```tsx
<CapabilitiesPanel
  agent={agent}
  collapsible={true}        // Collapsible
  showLimitations={true}    // Display limitations
  style="card"              // 'card' | 'list' | 'grid'
/>
```

### ExecutionPlan

Display execution plan, supports editing.

```tsx
<ExecutionPlan
  plan={plan}
  editable={true}
  onAccept={() => {}}
  onEdit={(edited) => {}}
  onCancel={() => {}}
  showEstimates={true}      // Show estimated time/cost
  showRisks={true}          // Show risk warnings
/>
```

### TodoList

Interactive task checklist.

```tsx
<TodoList
  todos={todos}
  interactive={true}        // Allow user interaction
  onTodoClick={(todo) => {}}
  showProgress={true}
  groupBy="status"          // 'status' | 'priority' | 'none'
  sortBy="priority"         // 'priority' | 'created' | 'custom'
/>
```

### ProgressBar

Beautiful progress indicator.

```tsx
<ProgressBar
  progress={progress}       // 0-100
  showPercentage={true}
  showSteps={true}
  currentStep={5}
  totalSteps={10}
  estimatedTime={120}       // seconds
  animated={true}
  color="primary"           // 'primary' | 'success' | 'warning'
/>
```

### ThinkingBox

Real-time display of LLM thinking process.

```tsx
<ThinkingBox
  thinking={thinkingText}
  streaming={true}
  autoScroll={true}
  showTimestamp={true}
  collapsible={true}
  maxHeight={300}           // px
  syntax="markdown"         // 'markdown' | 'plain'
/>
```

### StopButton

Always-visible stop button.

```tsx
<StopButton
  onStop={handleStop}
  position="floating"       // 'floating' | 'inline'
  confirmBeforeStop={false}
  disabled={!isRunning}
  style="danger"            // 'danger' | 'warning' | 'default'
/>
```

### ConfirmDialog

High-risk operation confirmation dialog.

```tsx
<ConfirmDialog
  open={showDialog}
  title="Confirmation Required"
  message="This operation will delete file"
  risks={[
    "Irreversible",
    "Permanent deletion",
    "No backup"
  ]}
  onConfirm={() => {}}
  onCancel={() => {}}
  confirmText="I understand the risks, continue"
  cancelText="Cancel"
  dangerous={true}
/>
```

### FeedbackButtons

Quick feedback buttons.

```tsx
<FeedbackButtons
  onFeedback={(rating) => {}}
  showLabels={true}
  variant="thumbs"          // 'thumbs' | 'stars' | 'emoji'
  size="medium"             // 'small' | 'medium' | 'large'
/>
```

---

## Theme Customization

### Using Preset Themes

```tsx
import { ThemeProvider } from '@wukong/agent-ui'

<ThemeProvider theme="light">
  <AgentChat config={config} />
</ThemeProvider>
```

### Custom Theme

```tsx
<ThemeProvider theme={{
  colors: {
    primary: '#0070f3',
    secondary: '#7928ca',
    success: '#0070f3',
    warning: '#f5a623',
    error: '#ff0080',
    background: '#ffffff',
    surface: '#f5f5f5',
    text: '#000000',
    textSecondary: '#666666'
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32
  },
  borderRadius: {
    sm: 4,
    md: 8,
    lg: 12
  },
  shadows: {
    sm: '0 1px 3px rgba(0,0,0,0.1)',
    md: '0 4px 6px rgba(0,0,0,0.1)',
    lg: '0 10px 20px rgba(0,0,0,0.1)'
  },
  typography: {
    fontFamily: 'Inter, sans-serif',
    fontSize: {
      xs: 12,
      sm: 14,
      md: 16,
      lg: 18,
      xl: 24
    },
    fontWeight: {
      regular: 400,
      medium: 500,
      bold: 700
    }
  },
  components: {
    stopButton: {
      position: 'top-right',
      style: 'floating'
    },
    progressBar: {
      height: 8,
      animated: true
    },
    todoList: {
      groupBy: 'status',
      showProgress: true
    }
  }
}}>
  <AgentChat config={config} />
</ThemeProvider>
```

### CSS Variables

Can also be customized through CSS variables:

```css
:root {
  --wukong-primary: #0070f3;
  --wukong-success: #0070f3;
  --wukong-error: #ff0080;
  --wukong-border-radius: 8px;
  --wukong-spacing: 16px;
}
```

---

## Responsive Design

All components support responsive layout:

```tsx
<AgentChat
  layout={{
    mobile: 'stack',        // Mobile: vertical stack
    tablet: 'sidebar',      // Tablet: sidebar
    desktop: 'split'        // Desktop: split columns
  }}
  breakpoints={{
    mobile: 640,
    tablet: 1024,
    desktop: 1280
  }}
/>
```

---

## Data Persistence

### MetricsProvider

Auto-collect and store metrics:

```tsx
import { MetricsProvider } from '@wukong/agent-ui'

<MetricsProvider
  storageKey="wukong-metrics"
  storage="localStorage"    // 'localStorage' | 'sessionStorage' | 'custom'
  onMetricsUpdate={(metrics) => {
    // Optional: send to analytics service
    analytics.track('agent_metrics', metrics)
  }}
>
  <AgentChat config={config} />
  <MetricsDashboard />
</MetricsProvider>
```

### HistoryProvider

Manage session history:

```tsx
import { HistoryProvider } from '@wukong/agent-ui'

<HistoryProvider
  maxSessions={10}
  autoCleanup={true}
  cleanupAfterDays={30}
>
  <AgentChat config={config} />
  <VersionHistory />
</HistoryProvider>
```

---

## Internationalization Support

```tsx
import { I18nProvider } from '@wukong/agent-ui'

<I18nProvider locale="zh-CN">
  <AgentChat config={config} />
</I18nProvider>

// Supported languages
// - en-US: English
// - zh-CN: Simplified Chinese
// - ja-JP: Japanese
// - ko-KR: Korean
```

Custom translations:

```tsx
<I18nProvider
  locale="zh-CN"
  messages={{
    'agent.stop': 'Pause',
    'agent.resume': 'Continue',
    'agent.undo': 'Undo',
    // ... more customization
  }}
>
  <AgentChat config={config} />
</I18nProvider>
```

---

## Accessibility Support

All components follow WCAG 2.1 AA standards:

- Keyboard navigation support
- Screen reader friendly
- Appropriate ARIA labels
- High contrast mode
- Focus management

```tsx
<AgentChat
  accessibility={{
    enableKeyboardNavigation: true,
    announceProgress: true,
    highContrast: false
  }}
/>
```

---

## Complete Example

```tsx
import {
  ThemeProvider,
  MetricsProvider,
  I18nProvider,
  AgentChat
} from '@wukong/agent-ui'

function App() {
  return (
    <ThemeProvider theme="light">
      <I18nProvider locale="zh-CN">
        <MetricsProvider storageKey="my-app-metrics">
          <AgentChat
            config={{
              llmKey: process.env.OPENAI_API_KEY,
              knowledgeBase: { path: './knowledge' },
              tools: { path: './tools' }
            }}
            layout={{
              mobile: 'stack',
              desktop: 'split'
            }}
            showCapabilities={true}
            showProgress={true}
            enableFeedback={true}
          />
        </MetricsProvider>
      </I18nProvider>
    </ThemeProvider>
  )
}
```

[← Previous: Trustworthiness Checklist](./appendix-trustworthiness.md) | [Next: Adapter Architecture →](./appendix-adapters.md)

