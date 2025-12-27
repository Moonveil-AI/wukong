# /packages/ui/src

React UI components for visualizing and controlling Wukong agents.

<!-- SYNC: When files in this directory change, update this document. -->

## Architecture

This package provides a complete set of React components for building trustworthy agent interfaces, implementing all 30 trustworthiness principles.

## File Structure

| Directory | Role | Purpose |
|-----------|------|---------|
| `components/` | Core | Individual UI components |
| `hooks/` | Core | React hooks for agent integration |
| `contexts/` | Core | React contexts for state management |
| `utils/` | Support | Utility functions |
| `types/` | Support | TypeScript type definitions |
| `styles/` | Support | Shared styles and themes |

## Key Components

### Startup Phase
- `<CapabilitiesPanel>` - Display agent capabilities
- `<SkillsTree>` - Visualize skill hierarchy
- `<ExamplePrompts>` - Suggested commands

### Before Execution
- `<PlanPreview>` - Show execution plan before running
- `<ExecutionPlan>` - Detailed step-by-step plan
- `<TodoList>` - Task checklist with progress

### During Execution
- `<StatusIndicator>` - Real-time execution status
- `<ProgressBar>` - Visual progress tracking
- `<ThinkingBox>` - LLM reasoning display (streaming)
- `<DecisionLog>` - Agent decision history
- `<CostIndicator>` - Token usage and cost

### Control
- `<StopButton>` - Stop execution
- `<ConfirmDialog>` - User confirmation for critical actions
- `<EscalateButton>` - Request human intervention

### After Execution
- `<UndoButton>` - Reverse last action
- `<VersionHistory>` - Session checkpoint history
- `<DiffView>` - Before/after comparison
- `<RetryButton>` - Retry failed steps

### Feedback
- `<FeedbackButtons>` - Thumbs up/down
- `<FeedbackForm>` - Detailed feedback collection
- `<MetricsDashboard>` - Success metrics

## Key Hooks

- `useAgent()` - Agent instance management
- `useAgentEvents()` - Event subscription
- `useSessionPersistence()` - Auto-save session state
- `useTokenMonitoring()` - Track token usage

## Contexts

- `AgentContext` - Agent instance and configuration
- `SessionContext` - Current session state
- `ThemeContext` - UI theme and customization

