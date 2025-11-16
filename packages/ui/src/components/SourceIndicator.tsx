import type React from 'react';
import { useState } from 'react';
import { useTheme } from '../theme';
import type { Theme } from '../theme/types';

export interface Source {
  id: string;
  type: 'knowledge' | 'document' | 'web' | 'api' | 'user' | 'memory';
  title: string;
  url?: string;
  excerpt?: string;
  confidence?: number; // 0-1
  timestamp?: Date;
}

export interface SourceIndicatorProps {
  sources: Source[];
  inline?: boolean;
  showExcerpts?: boolean;
  maxVisible?: number;
  onSourceClick?: (source: Source) => void;
  className?: string;
}

/**
 * SourceIndicator - Mark information sources
 *
 * Implements Principle 5: Show where information comes from
 */
export const SourceIndicator: React.FC<SourceIndicatorProps> = ({
  sources,
  inline = false,
  showExcerpts = true,
  maxVisible = 3,
  onSourceClick,
  className = '',
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { theme } = useTheme();

  const styles = getStyles(theme, inline);

  if (!sources || sources.length === 0) return null;

  const visibleSources = isExpanded ? sources : sources.slice(0, maxVisible);
  const hasMore = sources.length > maxVisible;

  return (
    <div className={`wukong-source-indicator ${className}`} style={styles.container}>
      {!inline && (
        <div style={styles.header}>
          <span style={styles.headerIcon}>📚</span>
          <span style={styles.headerTitle}>Sources</span>
          <span style={styles.count}>({sources.length})</span>
        </div>
      )}

      <div style={styles.sourcesList}>
        {visibleSources.map((source) => (
          <SourceCard
            key={source.id}
            source={source}
            inline={inline}
            showExcerpt={showExcerpts}
            onClick={() => onSourceClick?.(source)}
            styles={styles}
          />
        ))}
      </div>

      {hasMore && !isExpanded && (
        <button
          type="button"
          onClick={() => setIsExpanded(true)}
          style={styles.showMoreButton}
          aria-label={`Show ${sources.length - maxVisible} more sources`}
        >
          +{sources.length - maxVisible} more sources
        </button>
      )}

      {hasMore && isExpanded && (
        <button
          type="button"
          onClick={() => setIsExpanded(false)}
          style={styles.showMoreButton}
          aria-label="Show fewer sources"
        >
          Show less
        </button>
      )}
    </div>
  );
};

interface SourceCardProps {
  source: Source;
  inline: boolean;
  showExcerpt: boolean;
  onClick?: () => void;
  styles: ReturnType<typeof getStyles>;
}

const SourceCard: React.FC<SourceCardProps> = ({
  source,
  inline: _inline,
  showExcerpt,
  onClick,
  styles,
}) => {
  const hasLink = !!source.url;
  const isClickable = hasLink || onClick;

  const content = (
    <>
      <div style={styles.sourceHeader}>
        <span style={styles.sourceIcon}>{getSourceIcon(source.type)}</span>
        <span style={styles.sourceBadge}>{source.type}</span>
        {source.confidence !== undefined && (
          <span style={styles.confidence}>{Math.round(source.confidence * 100)}%</span>
        )}
      </div>
      <div style={styles.sourceTitle}>{source.title}</div>
      {showExcerpt && source.excerpt && <div style={styles.sourceExcerpt}>{source.excerpt}</div>}
      {source.timestamp && (
        <div style={styles.sourceTimestamp}>{formatTimestamp(source.timestamp)}</div>
      )}
    </>
  );

  if (hasLink) {
    return (
      <a
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        style={styles.sourceCard}
        onClick={(e) => {
          if (onClick) {
            e.preventDefault();
            onClick();
          }
        }}
      >
        {content}
      </a>
    );
  }

  if (isClickable) {
    return (
      <button type="button" onClick={onClick} style={{ ...styles.sourceCard, textAlign: 'left' }}>
        {content}
      </button>
    );
  }

  return <div style={styles.sourceCard}>{content}</div>;
};

function getSourceIcon(type: Source['type']): string {
  const icons = {
    knowledge: '🧠',
    document: '📄',
    web: '🌐',
    api: '🔌',
    user: '👤',
    memory: '💾',
  };
  return icons[type] || '📎';
}

function formatTimestamp(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  }).format(date);
}

function getStyles(theme: Theme, inline: boolean) {
  return {
    container: {
      backgroundColor: inline ? 'transparent' : theme.colors.surface,
      borderRadius: inline ? 0 : `${theme.borderRadius.md}px`,
      padding: inline ? `${theme.spacing.sm}px 0` : `${theme.spacing.md}px`,
      marginBottom: inline ? 0 : `${theme.spacing.md}px`,
      border: inline ? 'none' : `1px solid ${theme.colors.border}`,
    },
    header: {
      display: 'flex',
      alignItems: 'center',
      gap: `${theme.spacing.xs}px`,
      marginBottom: `${theme.spacing.md}px`,
    },
    headerIcon: {
      fontSize: `${theme.typography.fontSize.md}px`,
    },
    headerTitle: {
      fontSize: `${theme.typography.fontSize.md}px`,
      fontWeight: theme.typography.fontWeight.medium,
      color: theme.colors.text,
    },
    count: {
      fontSize: `${theme.typography.fontSize.sm}px`,
      color: theme.colors.textSecondary,
    },
    sourcesList: {
      display: 'flex',
      flexDirection: inline ? ('row' as const) : ('column' as const),
      flexWrap: inline ? ('wrap' as const) : undefined,
      gap: `${theme.spacing.sm}px`,
    },
    sourceCard: {
      display: 'block',
      padding: `${theme.spacing.sm}px ${theme.spacing.md}px`,
      backgroundColor: theme.colors.background,
      borderRadius: `${theme.borderRadius.sm}px`,
      border: `1px solid ${theme.colors.border}`,
      cursor: 'pointer',
      transition: 'all 0.2s',
      textDecoration: 'none',
      color: 'inherit',
      width: inline ? 'auto' : '100%',
    },
    sourceHeader: {
      display: 'flex',
      alignItems: 'center',
      gap: `${theme.spacing.xs}px`,
      marginBottom: `${theme.spacing.xs}px`,
    },
    sourceIcon: {
      fontSize: `${theme.typography.fontSize.sm}px`,
    },
    sourceBadge: {
      fontSize: `${theme.typography.fontSize.xs}px`,
      fontWeight: theme.typography.fontWeight.medium,
      color: theme.colors.primary,
      textTransform: 'uppercase' as const,
      letterSpacing: '0.5px',
    },
    confidence: {
      marginLeft: 'auto',
      fontSize: `${theme.typography.fontSize.xs}px`,
      color: theme.colors.textSecondary,
      fontWeight: theme.typography.fontWeight.medium,
    },
    sourceTitle: {
      fontSize: `${theme.typography.fontSize.sm}px`,
      fontWeight: theme.typography.fontWeight.medium,
      color: theme.colors.text,
      marginBottom: `${theme.spacing.xs}px`,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      display: '-webkit-box',
      // biome-ignore lint/style/useNamingConvention: WebKit-specific property
      WebkitLineClamp: 2,
      // biome-ignore lint/style/useNamingConvention: WebKit-specific property
      WebkitBoxOrient: 'vertical' as const,
    },
    sourceExcerpt: {
      fontSize: `${theme.typography.fontSize.xs}px`,
      color: theme.colors.textSecondary,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      display: '-webkit-box',
      // biome-ignore lint/style/useNamingConvention: WebKit-specific property
      WebkitLineClamp: 2,
      // biome-ignore lint/style/useNamingConvention: WebKit-specific property
      WebkitBoxOrient: 'vertical' as const,
      lineHeight: 1.4,
    },
    sourceTimestamp: {
      fontSize: `${theme.typography.fontSize.xs}px`,
      color: theme.colors.textSecondary,
      marginTop: `${theme.spacing.xs}px`,
    },
    showMoreButton: {
      marginTop: `${theme.spacing.sm}px`,
      padding: `${theme.spacing.xs}px ${theme.spacing.md}px`,
      border: `1px solid ${theme.colors.border}`,
      borderRadius: `${theme.borderRadius.sm}px`,
      backgroundColor: theme.colors.background,
      color: theme.colors.primary,
      cursor: 'pointer',
      fontSize: `${theme.typography.fontSize.sm}px`,
      fontWeight: theme.typography.fontWeight.medium,
      width: '100%',
      transition: 'all 0.2s',
    },
  };
}
