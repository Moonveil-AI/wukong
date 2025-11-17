import type React from 'react';
import { useState } from 'react';
import { useTheme } from '../theme';
import type { Theme } from '../theme/types';

export interface RiskLevel {
  level: 'low' | 'medium' | 'high';
  description: string;
}

export interface ExecutionStep {
  id: string;
  title: string;
  description: string;
  risk?: RiskLevel;
  estimatedTime?: number;
  canEdit?: boolean;
}

export interface ExecutionPlanProps {
  steps: ExecutionStep[];
  showRisks?: boolean;
  showEstimates?: boolean;
  editable?: boolean;
  onAccept?: () => void;
  onEdit?: (stepId: string) => void;
  onCancel?: () => void;
  className?: string;
}

/**
 * ExecutionPlan - Show detailed execution steps with risk warnings
 *
 * Implements Principles 7-8: Show execution details and risk warnings
 */
export const ExecutionPlan: React.FC<ExecutionPlanProps> = ({
  steps,
  showRisks = true,
  showEstimates = true,
  editable = false,
  onAccept,
  onEdit,
  onCancel,
  className = '',
}) => {
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const { theme } = useTheme();

  const styles = getStyles(theme);

  const toggleStep = (stepId: string) => {
    const newExpanded = new Set(expandedSteps);
    if (newExpanded.has(stepId)) {
      newExpanded.delete(stepId);
    } else {
      newExpanded.add(stepId);
    }
    setExpandedSteps(newExpanded);
  };

  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    return `~${minutes}m`;
  };

  const highRiskSteps = steps.filter((s) => s.risk?.level === 'high').length;
  const hasHighRisk = highRiskSteps > 0;

  return (
    <div className={`wukong-execution-plan ${className}`} style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>Execution Plan</h3>
        {showRisks && hasHighRisk && (
          <div style={styles.warningBanner}>
            <span style={styles.warningIcon}>⚠️</span>
            <span style={styles.warningText}>
              {highRiskSteps} high-risk {highRiskSteps === 1 ? 'step' : 'steps'} detected
            </span>
          </div>
        )}
      </div>

      <div style={styles.stepsContainer}>
        {steps.map((step, index) => {
          const isExpanded = expandedSteps.has(step.id);
          const riskColor = getRiskColor(theme, step.risk?.level);

          return (
            <div key={step.id} style={styles.step}>
              <button
                type="button"
                onClick={() => toggleStep(step.id)}
                style={styles.stepButton}
                aria-expanded={isExpanded}
              >
                <div style={styles.stepHeader}>
                  <span style={styles.stepNumber}>{index + 1}</span>
                  <span style={styles.stepTitle}>{step.title}</span>
                  {showEstimates && step.estimatedTime && (
                    <span style={styles.timeEstimate}>{formatTime(step.estimatedTime)}</span>
                  )}
                  {showRisks && step.risk && (
                    <span style={{ ...styles.riskBadge, backgroundColor: riskColor }}>
                      {step.risk.level.toUpperCase()}
                    </span>
                  )}
                </div>
                <span style={styles.expandIcon}>{isExpanded ? '▼' : '▶'}</span>
              </button>

              {isExpanded && (
                <div style={styles.stepContent}>
                  <p style={styles.stepDescription}>{step.description}</p>

                  {showRisks && step.risk && (
                    <div style={{ ...styles.riskWarning, borderColor: riskColor }}>
                      <span style={styles.riskIcon}>⚠️</span>
                      <div style={styles.riskContent}>
                        <span style={styles.riskLabel}>Risk Warning:</span>
                        <span style={styles.riskDescription}>{step.risk.description}</span>
                      </div>
                    </div>
                  )}

                  {editable && step.canEdit !== false && onEdit && (
                    <button type="button" onClick={() => onEdit(step.id)} style={styles.editButton}>
                      ✏️ Edit Step
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {(onAccept || onCancel) && (
        <div style={styles.actions}>
          {onCancel && (
            <button type="button" onClick={onCancel} style={styles.cancelButton}>
              Cancel
            </button>
          )}
          {onAccept && (
            <button type="button" onClick={onAccept} style={styles.acceptButton}>
              {hasHighRisk ? 'Accept Risks & Execute' : 'Execute Plan'}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

function getStyles(theme: Theme) {
  return {
    container: {
      backgroundColor: theme.colors.surface,
      borderRadius: `${theme.borderRadius.md}px`,
      padding: `${theme.spacing.md}px`,
      marginBottom: `${theme.spacing.md}px`,
      border: `1px solid ${theme.colors.border}`,
    },
    header: {
      marginBottom: `${theme.spacing.md}px`,
    },
    title: {
      margin: 0,
      marginBottom: `${theme.spacing.sm}px`,
      fontSize: `${theme.typography.fontSize.lg}px`,
      fontWeight: theme.typography.fontWeight.medium,
      color: theme.colors.text,
    },
    warningBanner: {
      display: 'flex',
      alignItems: 'center',
      gap: `${theme.spacing.sm}px`,
      padding: `${theme.spacing.sm}px`,
      backgroundColor: `${theme.colors.error}22`,
      borderRadius: `${theme.borderRadius.sm}px`,
      border: `1px solid ${theme.colors.error}`,
    },
    warningIcon: {
      fontSize: `${theme.typography.fontSize.lg}px`,
    },
    warningText: {
      fontSize: `${theme.typography.fontSize.sm}px`,
      fontWeight: theme.typography.fontWeight.medium,
      color: theme.colors.error,
    },
    stepsContainer: {
      display: 'flex',
      flexDirection: 'column' as const,
      gap: `${theme.spacing.sm}px`,
    },
    step: {
      backgroundColor: theme.colors.background,
      borderRadius: `${theme.borderRadius.sm}px`,
      border: `1px solid ${theme.colors.border}`,
      overflow: 'hidden',
    },
    stepButton: {
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: `${theme.spacing.sm}px`,
      border: 'none',
      background: 'none',
      cursor: 'pointer',
      textAlign: 'left' as const,
    },
    stepHeader: {
      display: 'flex',
      alignItems: 'center',
      gap: `${theme.spacing.sm}px`,
      flex: 1,
    },
    stepNumber: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: '28px',
      height: '28px',
      borderRadius: '50%',
      backgroundColor: theme.colors.primary,
      color: '#ffffff',
      fontSize: `${theme.typography.fontSize.sm}px`,
      fontWeight: theme.typography.fontWeight.bold,
      flexShrink: 0,
    },
    stepTitle: {
      flex: 1,
      fontSize: `${theme.typography.fontSize.md}px`,
      fontWeight: theme.typography.fontWeight.medium,
      color: theme.colors.text,
    },
    timeEstimate: {
      fontSize: `${theme.typography.fontSize.xs}px`,
      color: theme.colors.textSecondary,
      padding: '2px 8px',
      backgroundColor: theme.colors.surface,
      borderRadius: `${theme.borderRadius.sm}px`,
    },
    riskBadge: {
      fontSize: `${theme.typography.fontSize.xs}px`,
      fontWeight: theme.typography.fontWeight.bold,
      color: '#ffffff',
      padding: '2px 8px',
      borderRadius: `${theme.borderRadius.sm}px`,
      textTransform: 'uppercase' as const,
    },
    expandIcon: {
      fontSize: `${theme.typography.fontSize.sm}px`,
      color: theme.colors.textSecondary,
      marginLeft: `${theme.spacing.sm}px`,
    },
    stepContent: {
      padding: `${theme.spacing.md}px`,
      paddingTop: 0,
    },
    stepDescription: {
      margin: 0,
      marginBottom: `${theme.spacing.sm}px`,
      fontSize: `${theme.typography.fontSize.sm}px`,
      color: theme.colors.textSecondary,
      lineHeight: 1.5,
    },
    riskWarning: {
      display: 'flex',
      gap: `${theme.spacing.sm}px`,
      padding: `${theme.spacing.sm}px`,
      backgroundColor: theme.colors.surface,
      borderRadius: `${theme.borderRadius.sm}px`,
      borderLeft: '3px solid',
      marginBottom: `${theme.spacing.sm}px`,
    },
    riskIcon: {
      fontSize: `${theme.typography.fontSize.md}px`,
      flexShrink: 0,
    },
    riskContent: {
      flex: 1,
    },
    riskLabel: {
      display: 'block',
      fontSize: `${theme.typography.fontSize.xs}px`,
      fontWeight: theme.typography.fontWeight.bold,
      color: theme.colors.text,
      textTransform: 'uppercase' as const,
      marginBottom: '4px',
    },
    riskDescription: {
      display: 'block',
      fontSize: `${theme.typography.fontSize.sm}px`,
      color: theme.colors.textSecondary,
      lineHeight: 1.4,
    },
    editButton: {
      padding: `${theme.spacing.xs}px ${theme.spacing.sm}px`,
      border: `1px solid ${theme.colors.border}`,
      borderRadius: `${theme.borderRadius.sm}px`,
      backgroundColor: 'transparent',
      color: theme.colors.primary,
      fontSize: `${theme.typography.fontSize.sm}px`,
      cursor: 'pointer',
    },
    actions: {
      display: 'flex',
      justifyContent: 'flex-end',
      gap: `${theme.spacing.sm}px`,
      marginTop: `${theme.spacing.md}px`,
      paddingTop: `${theme.spacing.md}px`,
      borderTop: `1px solid ${theme.colors.border}`,
    },
    cancelButton: {
      padding: `${theme.spacing.sm}px ${theme.spacing.md}px`,
      border: `1px solid ${theme.colors.border}`,
      borderRadius: `${theme.borderRadius.sm}px`,
      backgroundColor: 'transparent',
      color: theme.colors.text,
      fontSize: `${theme.typography.fontSize.sm}px`,
      fontWeight: theme.typography.fontWeight.medium,
      cursor: 'pointer',
    },
    acceptButton: {
      padding: `${theme.spacing.sm}px ${theme.spacing.md}px`,
      border: 'none',
      borderRadius: `${theme.borderRadius.sm}px`,
      backgroundColor: theme.colors.primary,
      color: '#ffffff',
      fontSize: `${theme.typography.fontSize.sm}px`,
      fontWeight: theme.typography.fontWeight.medium,
      cursor: 'pointer',
    },
  };
}

function getRiskColor(theme: Theme, level?: 'low' | 'medium' | 'high'): string {
  switch (level) {
    case 'high':
      return theme.colors.error;
    case 'medium':
      return theme.colors.warning;
    case 'low':
      return theme.colors.success;
    default:
      return theme.colors.textSecondary;
  }
}
