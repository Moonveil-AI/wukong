/**
 * Core UI Components for Wukong Agent
 *
 * These components implement the 30 trustworthiness principles
 * as defined in the design documentation.
 */

// Startup Phase Components (Principles 1-5)
export { CapabilitiesPanel } from './CapabilitiesPanel';
export type { CapabilitiesPanelProps, Capability } from './CapabilitiesPanel';

export { SkillsTree } from './SkillsTree';
export type { SkillsTreeProps, Skill } from './SkillsTree';

export { ExamplePrompts } from './ExamplePrompts';
export type { ExamplePromptsProps, ExamplePrompt } from './ExamplePrompts';

export { UpdateBanner } from './UpdateBanner';
export type { UpdateBannerProps, Update } from './UpdateBanner';

export { SourceIndicator } from './SourceIndicator';
export type { SourceIndicatorProps, Source } from './SourceIndicator';

// Before Execution Components (Principles 6-11)
export { PlanPreview } from './PlanPreview';
export type { PlanPreviewProps, Plan, PlanStep } from './PlanPreview';

export { ExecutionPlan } from './ExecutionPlan';
export type { ExecutionPlanProps, ExecutionStep, RiskLevel } from './ExecutionPlan';

export { TodoList } from './TodoList';
export type { TodoListProps, Todo, TodoStatus } from './TodoList';

export { ThinkingBox } from './ThinkingBox';
export type { ThinkingBoxProps } from './ThinkingBox';

// During Execution Components (Principles 12-17)
export { StatusIndicator } from './StatusIndicator';
export type { StatusIndicatorProps, AgentStatus } from './StatusIndicator';

export { ProgressBar } from './ProgressBar';
export type { ProgressBarProps } from './ProgressBar';

export { DecisionLog } from './DecisionLog';
export type { DecisionLogProps, Decision } from './DecisionLog';

export { ThinkingProcess } from './ThinkingProcess';
export type { ThinkingProcessProps } from './ThinkingProcess';

export { CostIndicator } from './CostIndicator';
export type { CostIndicatorProps } from './CostIndicator';

export { WhyButton } from './WhyButton';
export type { WhyButtonProps } from './WhyButton';

// After Errors Components (Principles 18-24)
export { UndoButton } from './UndoButton';
export type { UndoButtonProps } from './UndoButton';

export { VersionHistory } from './VersionHistory';
export type { VersionHistoryProps, Version } from './VersionHistory';

export { SandboxPreview } from './SandboxPreview';
export type { SandboxPreviewProps } from './SandboxPreview';

export { DiffView } from './DiffView';
export type { DiffViewProps } from './DiffView';

export { StopButton } from './StopButton';
export type { StopButtonProps } from './StopButton';

export { ConfirmDialog } from './ConfirmDialog';
export type { ConfirmDialogProps } from './ConfirmDialog';

export { EscalateButton } from './EscalateButton';
export type { EscalateButtonProps, EscalateOption } from './EscalateButton';
