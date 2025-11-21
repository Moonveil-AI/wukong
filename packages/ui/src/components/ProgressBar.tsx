import type React from 'react';
import { useTheme } from '../theme';
import type { Theme } from '../theme/types';

export interface ProgressBarProps {
  progress: number; // 0 to 100
  currentStep?: number;
  totalSteps?: number;
  label?: string;
  estimatedTimeRemaining?: string;
  className?: string;
}

/**
 * ProgressBar - Progress indication for tasks
 *
 * Implements Principle 13: Show progress clearly
 */
export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  currentStep,
  totalSteps,
  label,
  estimatedTimeRemaining,
  className = '',
}) => {
  const { theme } = useTheme();
  const styles = getStyles(theme, progress);

  const normalizedProgress = Math.min(100, Math.max(0, progress));

  return (
    <div className={`wukong-progress-bar ${className}`} style={styles.container}>
      <div style={styles.header}>
        <div style={styles.labelContainer}>
          {label && <span style={styles.label}>{label}</span>}
          {currentStep !== undefined && totalSteps !== undefined && (
            <span style={styles.steps}>
              Step {currentStep} of {totalSteps}
            </span>
          )}
        </div>
        <span style={styles.percentage}>{Math.round(normalizedProgress)}%</span>
      </div>

      <div style={styles.track}>
        <div
          style={styles.fill}
          role="progressbar"
          aria-valuenow={normalizedProgress}
          aria-valuemin={0}
          aria-valuemax={100}
          tabIndex={0}
        />
      </div>

      {estimatedTimeRemaining && (
        <div style={styles.footer}>
          <span style={styles.eta}>Est. time remaining: {estimatedTimeRemaining}</span>
        </div>
      )}
    </div>
  );
};

function getStyles(theme: Theme, progress: number) {
  return {
    container: {
      width: '100%',
      padding: `${theme.spacing.sm}px`,
      fontFamily: theme.typography.fontFamily,
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      marginBottom: `${theme.spacing.xs}px`,
    },
    labelContainer: {
      display: 'flex',
      flexDirection: 'column' as const,
    },
    label: {
      fontSize: `${theme.typography.fontSize.sm}px`,
      fontWeight: theme.typography.fontWeight.medium,
      color: theme.colors.text,
      marginBottom: '2px',
    },
    steps: {
      fontSize: `${theme.typography.fontSize.xs}px`,
      color: theme.colors.textSecondary,
    },
    percentage: {
      fontSize: `${theme.typography.fontSize.md}px`,
      fontWeight: theme.typography.fontWeight.bold,
      color: theme.colors.primary,
    },
    track: {
      width: '100%',
      height: `${theme.components?.progressBar?.height || 8}px`,
      backgroundColor: theme.colors.border,
      borderRadius: `${theme.borderRadius.full || 999}px`,
      overflow: 'hidden',
    },
    fill: {
      width: `${progress}%`,
      height: '100%',
      backgroundColor: theme.colors.primary,
      borderRadius: `${theme.borderRadius.full || 999}px`,
      transition: 'width 0.3s ease-in-out',
    },
    footer: {
      marginTop: `${theme.spacing.xs}px`,
      textAlign: 'right' as const,
    },
    eta: {
      fontSize: `${theme.typography.fontSize.xs}px`,
      color: theme.colors.textSecondary,
      fontStyle: 'italic',
    },
  };
}
