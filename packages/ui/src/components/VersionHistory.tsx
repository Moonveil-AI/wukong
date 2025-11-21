import type React from 'react';
import { useTheme } from '../theme/ThemeContext';

export interface Version {
  id: string;
  timestamp: number;
  author?: string;
  summary: string;
  changes?: string[];
}

export interface VersionHistoryProps {
  versions: Version[];
  currentVersionId: string;
  onRestore: (versionId: string) => void;
  onSelect?: (versionId: string) => void;
  className?: string;
  style?: React.CSSProperties;
}

export const VersionHistory: React.FC<VersionHistoryProps> = ({
  versions,
  currentVersionId,
  onRestore,
  onSelect,
  className,
  style,
}) => {
  const { theme } = useTheme();

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: theme.spacing.sm,
        width: '100%',
        ...style,
      }}
    >
      {versions.map((version, index) => {
        const isCurrent = version.id === currentVersionId;
        const isLatest = index === 0;

        return (
          <div
            key={version.id}
            role={onSelect ? 'button' : undefined}
            tabIndex={onSelect ? 0 : undefined}
            onClick={() => onSelect?.(version.id)}
            onKeyDown={(e) => {
              if (onSelect && (e.key === 'Enter' || e.key === ' ')) {
                onSelect(version.id);
              }
            }}
            style={{
              border: `1px solid ${isCurrent ? theme.colors.primary : theme.colors.border}`,
              borderRadius: theme.borderRadius.md,
              padding: theme.spacing.md,
              backgroundColor: isCurrent ? `${theme.colors.primary}10` : theme.colors.surface,
              cursor: onSelect ? 'pointer' : 'default',
              position: 'relative',
              transition: 'all 0.2s ease',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: theme.spacing.xs,
              }}
            >
              <span
                style={{
                  fontWeight: theme.typography.fontWeight.medium,
                  color: theme.colors.text,
                  fontSize: theme.typography.fontSize.sm,
                }}
              >
                {isLatest ? 'Latest Version' : `Version ${versions.length - index}`}
              </span>
              <span
                style={{
                  fontSize: theme.typography.fontSize.xs,
                  color: theme.colors.textSecondary,
                }}
              >
                {formatDate(version.timestamp)}
              </span>
            </div>

            <div
              style={{
                fontSize: theme.typography.fontSize.sm,
                color: theme.colors.text,
                marginBottom: theme.spacing.sm,
              }}
            >
              {version.summary}
            </div>

            {version.changes && version.changes.length > 0 && (
              <ul
                style={{
                  margin: 0,
                  paddingLeft: theme.spacing.lg,
                  fontSize: theme.typography.fontSize.xs,
                  color: theme.colors.textSecondary,
                  marginBottom: theme.spacing.sm,
                }}
              >
                {version.changes.slice(0, 3).map((change, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: simple list
                  <li key={i}>{change}</li>
                ))}
                {version.changes.length > 3 && <li>+{version.changes.length - 3} more changes</li>}
              </ul>
            )}

            {!isCurrent && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRestore(version.id);
                }}
                style={{
                  fontSize: theme.typography.fontSize.xs,
                  padding: `${theme.spacing.xs}px ${theme.spacing.sm}px`,
                  borderRadius: theme.borderRadius.sm,
                  border: `1px solid ${theme.colors.border}`,
                  backgroundColor: theme.colors.background,
                  cursor: 'pointer',
                  color: theme.colors.text,
                }}
              >
                Restore this version
              </button>
            )}

            {isCurrent && (
              <span
                style={{
                  fontSize: theme.typography.fontSize.xs,
                  color: theme.colors.primary,
                  fontWeight: theme.typography.fontWeight.medium,
                  display: 'inline-block',
                  padding: `${theme.spacing.xs}px ${theme.spacing.sm}px`,
                  borderRadius: theme.borderRadius.full,
                  backgroundColor: `${theme.colors.primary}20`,
                }}
              >
                Current
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
};
