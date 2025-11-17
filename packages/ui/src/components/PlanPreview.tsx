import type React from 'react';
import { useState } from 'react';
import { useTheme } from '../theme';
import type { Theme } from '../theme/types';

export interface PlanStep {
  id: string;
  description: string;
  type?: 'action' | 'decision' | 'query';
  dependencies?: string[];
}

export interface Plan {
  title: string;
  description?: string;
  steps: PlanStep[];
  estimatedTime?: number; // in seconds
  estimatedCost?: number; // in USD
}

export interface PlanPreviewProps {
  plan: Plan;
  layout?: 'modal' | 'sidebar' | 'inline';
  showEstimates?: boolean;
  onAccept?: () => void;
  onEdit?: () => void;
  onCancel?: () => void;
  className?: string;
}

/**
 * PlanPreview - Display generated execution plan
 *
 * Implements Principle 6: Show the plan before executing
 */
export const PlanPreview: React.FC<PlanPreviewProps> = ({
  plan,
  layout = 'inline',
  showEstimates = true,
  onAccept,
  onEdit,
  onCancel,
  className = '',
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const { theme } = useTheme();

  const styles = getStyles(theme, layout);

  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  };

  const formatCost = (cost: number): string => {
    return cost < 0.01 ? '< $0.01' : `$${cost.toFixed(2)}`;
  };

  return (
    <div className={`wukong-plan-preview ${className}`} style={styles.container}>
      <div style={styles.header}>
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          style={styles.toggleButton}
          aria-expanded={isExpanded}
          aria-label={isExpanded ? 'Collapse plan' : 'Expand plan'}
        >
          <span style={styles.toggleIcon}>{isExpanded ? '▼' : '▶'}</span>
          <h3 style={styles.title}>{plan.title}</h3>
        </button>
      </div>

      {isExpanded && (
        <>
          {plan.description && <p style={styles.description}>{plan.description}</p>}

          {showEstimates && (plan.estimatedTime || plan.estimatedCost) && (
            <div style={styles.estimates}>
              {plan.estimatedTime && (
                <div style={styles.estimate}>
                  <span style={styles.estimateIcon}>⏱️</span>
                  <span style={styles.estimateLabel}>Estimated Time:</span>
                  <span style={styles.estimateValue}>{formatTime(plan.estimatedTime)}</span>
                </div>
              )}
              {plan.estimatedCost !== undefined && (
                <div style={styles.estimate}>
                  <span style={styles.estimateIcon}>💰</span>
                  <span style={styles.estimateLabel}>Estimated Cost:</span>
                  <span style={styles.estimateValue}>{formatCost(plan.estimatedCost)}</span>
                </div>
              )}
            </div>
          )}

          <div style={styles.stepsContainer}>
            <h4 style={styles.stepsTitle}>Steps ({plan.steps.length})</h4>
            <ol style={styles.stepsList}>
              {plan.steps.map((step, index) => (
                <li key={step.id} style={styles.step}>
                  <div style={styles.stepHeader}>
                    <span style={styles.stepNumber}>{index + 1}</span>
                    <span style={styles.stepDescription}>{step.description}</span>
                  </div>
                  {step.type && <span style={getStepTypeStyle(theme, step.type)}>{step.type}</span>}
                  {step.dependencies && step.dependencies.length > 0 && (
                    <div style={styles.dependencies}>
                      <span style={styles.dependenciesLabel}>Depends on: </span>
                      {step.dependencies.map((depId) => {
                        const depIndex = plan.steps.findIndex((s) => s.id === depId);
                        return (
                          <span key={depId} style={styles.dependency}>
                            Step {depIndex + 1}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </li>
              ))}
            </ol>
          </div>

          {(onAccept || onEdit || onCancel) && (
            <div style={styles.actions}>
              {onCancel && (
                <button type="button" onClick={onCancel} style={styles.cancelButton}>
                  Cancel
                </button>
              )}
              {onEdit && (
                <button type="button" onClick={onEdit} style={styles.editButton}>
                  Edit Plan
                </button>
              )}
              {onAccept && (
                <button type="button" onClick={onAccept} style={styles.acceptButton}>
                  Accept & Execute
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

function getStyles(theme: Theme, layout: 'modal' | 'sidebar' | 'inline') {
  return {
    container: {
      backgroundColor: theme.colors.surface,
      borderRadius: `${theme.borderRadius.md}px`,
      padding: `${theme.spacing.md}px`,
      marginBottom: `${theme.spacing.md}px`,
      border: `1px solid ${theme.colors.border}`,
      maxWidth: layout === 'sidebar' ? '400px' : '100%',
    },
    header: {
      marginBottom: `${theme.spacing.sm}px`,
    },
    toggleButton: {
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      padding: 0,
      border: 'none',
      background: 'none',
      cursor: 'pointer',
      textAlign: 'left' as const,
    },
    toggleIcon: {
      marginRight: `${theme.spacing.sm}px`,
      fontSize: `${theme.typography.fontSize.sm}px`,
      color: theme.colors.textSecondary,
    },
    title: {
      margin: 0,
      fontSize: `${theme.typography.fontSize.lg}px`,
      fontWeight: theme.typography.fontWeight.medium,
      color: theme.colors.text,
    },
    description: {
      margin: `${theme.spacing.sm}px 0`,
      fontSize: `${theme.typography.fontSize.sm}px`,
      color: theme.colors.textSecondary,
      lineHeight: 1.5,
    },
    estimates: {
      display: 'flex',
      gap: `${theme.spacing.md}px`,
      padding: `${theme.spacing.sm}px`,
      backgroundColor: theme.colors.background,
      borderRadius: `${theme.borderRadius.sm}px`,
      marginBottom: `${theme.spacing.md}px`,
    },
    estimate: {
      display: 'flex',
      alignItems: 'center',
      gap: `${theme.spacing.xs}px`,
    },
    estimateIcon: {
      fontSize: `${theme.typography.fontSize.md}px`,
    },
    estimateLabel: {
      fontSize: `${theme.typography.fontSize.sm}px`,
      color: theme.colors.textSecondary,
    },
    estimateValue: {
      fontSize: `${theme.typography.fontSize.sm}px`,
      fontWeight: theme.typography.fontWeight.medium,
      color: theme.colors.text,
    },
    stepsContainer: {
      marginTop: `${theme.spacing.md}px`,
    },
    stepsTitle: {
      margin: 0,
      marginBottom: `${theme.spacing.sm}px`,
      fontSize: `${theme.typography.fontSize.md}px`,
      fontWeight: theme.typography.fontWeight.medium,
      color: theme.colors.text,
    },
    stepsList: {
      margin: 0,
      padding: 0,
      listStyle: 'none',
    },
    step: {
      padding: `${theme.spacing.sm}px`,
      marginBottom: `${theme.spacing.xs}px`,
      backgroundColor: theme.colors.background,
      borderRadius: `${theme.borderRadius.sm}px`,
      borderLeft: `3px solid ${theme.colors.primary}`,
    },
    stepHeader: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: `${theme.spacing.sm}px`,
    },
    stepNumber: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: '24px',
      height: '24px',
      borderRadius: '50%',
      backgroundColor: theme.colors.primary,
      color: '#ffffff',
      fontSize: `${theme.typography.fontSize.xs}px`,
      fontWeight: theme.typography.fontWeight.bold,
      flexShrink: 0,
    },
    stepDescription: {
      flex: 1,
      fontSize: `${theme.typography.fontSize.sm}px`,
      color: theme.colors.text,
      lineHeight: 1.5,
    },
    dependencies: {
      marginTop: `${theme.spacing.xs}px`,
      marginLeft: '32px',
      fontSize: `${theme.typography.fontSize.xs}px`,
      color: theme.colors.textSecondary,
    },
    dependenciesLabel: {
      marginRight: `${theme.spacing.xs}px`,
    },
    dependency: {
      display: 'inline-block',
      marginRight: `${theme.spacing.xs}px`,
      padding: '2px 6px',
      backgroundColor: theme.colors.surface,
      borderRadius: `${theme.borderRadius.sm}px`,
      border: `1px solid ${theme.colors.border}`,
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
    editButton: {
      padding: `${theme.spacing.sm}px ${theme.spacing.md}px`,
      border: `1px solid ${theme.colors.primary}`,
      borderRadius: `${theme.borderRadius.sm}px`,
      backgroundColor: 'transparent',
      color: theme.colors.primary,
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

function getStepTypeStyle(theme: Theme, type: string) {
  const colors = {
    action: theme.colors.primary,
    decision: theme.colors.warning,
    query: theme.colors.secondary,
  };

  return {
    display: 'inline-block',
    marginLeft: `${theme.spacing.sm}px`,
    padding: '2px 8px',
    fontSize: `${theme.typography.fontSize.xs}px`,
    fontWeight: theme.typography.fontWeight.medium,
    color: '#ffffff',
    backgroundColor: colors[type as keyof typeof colors] || theme.colors.textSecondary,
    borderRadius: `${theme.borderRadius.sm}px`,
    textTransform: 'uppercase' as const,
  };
}
