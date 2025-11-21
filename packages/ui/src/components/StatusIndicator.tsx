import type React from 'react';
import { useTheme } from '../theme';
import type { Theme } from '../theme/types';

export type AgentStatus = 'idle' | 'thinking' | 'executing' | 'waiting' | 'completed' | 'failed';

export interface StatusIndicatorProps {
  status: AgentStatus;
  message?: string;
  className?: string;
}

/**
 * StatusIndicator - Real-time status display
 *
 * Implements Principle 12: Make current status clear
 */
export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  message,
  className = '',
}) => {
  const { theme } = useTheme();
  const styles = getStyles(theme, status);

  const getStatusIcon = (status: AgentStatus) => {
    switch (status) {
      case 'idle':
        return '⚪';
      case 'thinking':
        return '🧠';
      case 'executing':
        return '⚙️';
      case 'waiting':
        return '⏳';
      case 'completed':
        return '✅';
      case 'failed':
        return '❌';
      default:
        return '⚪';
    }
  };

  const getStatusLabel = (status: AgentStatus) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  return (
    <div className={`wukong-status-indicator ${className}`} style={styles.container}>
      <div style={styles.indicator}>
        <span style={styles.icon} role="img" aria-label={status}>
          {getStatusIcon(status)}
        </span>
        <div style={styles.content}>
          <span style={styles.label}>{getStatusLabel(status)}</span>
          {message && <span style={styles.message}>{message}</span>}
        </div>
      </div>
      {status === 'thinking' || status === 'executing' ? (
        <div style={styles.pulse} aria-hidden="true" />
      ) : null}
    </div>
  );
};

function getStyles(theme: Theme, status: AgentStatus) {
  const getStatusColor = () => {
    switch (status) {
      case 'idle':
        return theme.colors.textSecondary;
      case 'thinking':
        return theme.colors.secondary;
      case 'executing':
        return theme.colors.primary;
      case 'waiting':
        return theme.colors.warning;
      case 'completed':
        return theme.colors.success;
      case 'failed':
        return theme.colors.error;
      default:
        return theme.colors.textSecondary;
    }
  };

  const color = getStatusColor();

  return {
    container: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: `${theme.spacing.sm}px ${theme.spacing.md}px`,
      backgroundColor: theme.colors.surface,
      borderRadius: `${theme.borderRadius.full || 999}px`,
      border: `1px solid ${theme.colors.border}`,
      boxShadow: theme.shadows.sm,
      maxWidth: 'fit-content',
    },
    indicator: {
      display: 'flex',
      alignItems: 'center',
      gap: `${theme.spacing.sm}px`,
    },
    icon: {
      fontSize: `${theme.typography.fontSize.lg}px`,
      lineHeight: 1,
    },
    content: {
      display: 'flex',
      flexDirection: 'column' as const,
    },
    label: {
      fontSize: `${theme.typography.fontSize.sm}px`,
      fontWeight: theme.typography.fontWeight.bold,
      color: color,
      lineHeight: 1.2,
    },
    message: {
      fontSize: `${theme.typography.fontSize.xs}px`,
      color: theme.colors.textSecondary,
      maxWidth: '200px',
      whiteSpace: 'nowrap' as const,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    },
    pulse: {
      width: '8px',
      height: '8px',
      borderRadius: '50%',
      backgroundColor: color,
      marginLeft: `${theme.spacing.md}px`,
      animation: 'pulse 1.5s infinite',
      opacity: 0.6,
    },
  };
}
