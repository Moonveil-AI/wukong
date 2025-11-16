import type React from 'react';
import { useEffect, useState } from 'react';
import { useTheme } from '../theme';
import type { Theme } from '../theme/types';

export interface Update {
  version: string;
  title: string;
  description: string;
  features?: string[];
  date?: Date;
  type?: 'major' | 'minor' | 'patch' | 'info';
}

export interface UpdateBannerProps {
  update: Update;
  dismissible?: boolean;
  autoHide?: boolean;
  autoHideDelay?: number; // milliseconds
  storageKey?: string; // for remembering dismissal
  onDismiss?: () => void;
  className?: string;
}

/**
 * UpdateBanner - Show new features and updates
 *
 * Implements Principle 4: Inform users about new capabilities
 */
export const UpdateBanner: React.FC<UpdateBannerProps> = ({
  update,
  dismissible = true,
  autoHide = false,
  autoHideDelay = 5000,
  storageKey = 'wukong-update-banner',
  onDismiss,
  className = '',
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const { theme } = useTheme();

  const styles = getStyles(theme, update.type || 'info');

  useEffect(() => {
    // Check if this update was previously dismissed
    if (storageKey && typeof window !== 'undefined') {
      const dismissed = localStorage.getItem(`${storageKey}-${update.version}`);
      if (dismissed === 'true') {
        setIsVisible(false);
      }
    }
  }, [storageKey, update.version]);

  useEffect(() => {
    if (autoHide && isVisible) {
      const timer = setTimeout(() => {
        handleDismiss();
      }, autoHideDelay);

      return () => clearTimeout(timer);
    }
    return undefined;
  }, [autoHide, autoHideDelay, isVisible]);

  const handleDismiss = () => {
    setIsVisible(false);

    // Remember dismissal
    if (storageKey && typeof window !== 'undefined') {
      localStorage.setItem(`${storageKey}-${update.version}`, 'true');
    }

    onDismiss?.();
  };

  if (!isVisible) return null;

  return (
    <div
      className={`wukong-update-banner ${className}`}
      style={styles.container}
      role="alert"
      aria-live="polite"
    >
      <div style={styles.content}>
        <div style={styles.header}>
          <div style={styles.icon}>{getIcon(update.type || 'info')}</div>
          <div style={styles.headerText}>
            <div style={styles.title}>
              {update.title}
              {update.version && <span style={styles.version}>v{update.version}</span>}
            </div>
            {update.date && <div style={styles.date}>{formatDate(update.date)}</div>}
          </div>
        </div>

        <div style={styles.description}>{update.description}</div>

        {update.features && update.features.length > 0 && (
          <ul style={styles.featureList}>
            {update.features.map((feature) => (
              <li key={feature} style={styles.featureItem}>
                {feature}
              </li>
            ))}
          </ul>
        )}
      </div>

      {dismissible && (
        <button
          type="button"
          onClick={handleDismiss}
          style={styles.dismissButton}
          aria-label="Dismiss update notification"
        >
          ✕
        </button>
      )}
    </div>
  );
};

function getIcon(type: Update['type']) {
  switch (type) {
    case 'major':
      return '🎉';
    case 'minor':
      return '✨';
    case 'patch':
      return '🔧';
    default:
      return 'ℹ️';
  }
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function getStyles(theme: Theme, type: Update['type']) {
  const typeColors = {
    major: theme.colors.success,
    minor: theme.colors.primary,
    patch: theme.colors.warning,
    info: theme.colors.primary,
  };

  const backgroundColor = typeColors[type || 'info'];

  return {
    container: {
      position: 'relative' as const,
      display: 'flex',
      gap: `${theme.spacing.md}px`,
      padding: `${theme.spacing.md}px`,
      backgroundColor: `${backgroundColor}15`,
      border: `1px solid ${backgroundColor}40`,
      borderRadius: `${theme.borderRadius.md}px`,
      marginBottom: `${theme.spacing.md}px`,
    },
    content: {
      flex: 1,
    },
    header: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: `${theme.spacing.sm}px`,
      marginBottom: `${theme.spacing.sm}px`,
    },
    icon: {
      fontSize: `${theme.typography.fontSize.xl}px`,
      lineHeight: 1,
    },
    headerText: {
      flex: 1,
    },
    title: {
      display: 'flex',
      alignItems: 'center',
      gap: `${theme.spacing.sm}px`,
      fontSize: `${theme.typography.fontSize.md}px`,
      fontWeight: theme.typography.fontWeight.medium,
      color: theme.colors.text,
      marginBottom: `${theme.spacing.xs / 2}px`,
    },
    version: {
      fontSize: `${theme.typography.fontSize.sm}px`,
      fontWeight: theme.typography.fontWeight.regular,
      color: backgroundColor,
      padding: `${theme.spacing.xs / 2}px ${theme.spacing.xs}px`,
      backgroundColor: `${backgroundColor}20`,
      borderRadius: `${theme.borderRadius.sm}px`,
    },
    date: {
      fontSize: `${theme.typography.fontSize.xs}px`,
      color: theme.colors.textSecondary,
    },
    description: {
      fontSize: `${theme.typography.fontSize.sm}px`,
      color: theme.colors.text,
      marginBottom: `${theme.spacing.sm}px`,
      lineHeight: 1.5,
    },
    featureList: {
      margin: 0,
      paddingLeft: `${theme.spacing.lg}px`,
      fontSize: `${theme.typography.fontSize.sm}px`,
      color: theme.colors.text,
    },
    featureItem: {
      marginBottom: `${theme.spacing.xs}px`,
      lineHeight: 1.5,
    },
    dismissButton: {
      position: 'absolute' as const,
      top: `${theme.spacing.sm}px`,
      right: `${theme.spacing.sm}px`,
      padding: `${theme.spacing.xs}px`,
      border: 'none',
      background: 'none',
      cursor: 'pointer',
      fontSize: `${theme.typography.fontSize.md}px`,
      color: theme.colors.textSecondary,
      lineHeight: 1,
      transition: 'color 0.2s',
    },
  };
}
