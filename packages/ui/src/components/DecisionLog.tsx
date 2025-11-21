import type React from 'react';
import { useState } from 'react';
import { useTheme } from '../theme';
import type { Theme } from '../theme/types';

export interface Decision {
  id: string;
  timestamp: number;
  title: string;
  description: string;
  reasoning: string;
  outcome?: 'success' | 'failure' | 'neutral';
  tags?: string[];
}

export interface DecisionLogProps {
  decisions: Decision[];
  title?: string;
  className?: string;
}

/**
 * DecisionLog - Timeline of agent decisions
 *
 * Implements Principle 14: Keep a log of decisions
 */
export const DecisionLog: React.FC<DecisionLogProps> = ({
  decisions,
  title = 'Decision Log',
  className = '',
}) => {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const filteredDecisions = decisions.filter(
    (d) =>
      d.title.toLowerCase().includes(filter.toLowerCase()) ||
      d.description.toLowerCase().includes(filter.toLowerCase()) ||
      d.reasoning.toLowerCase().includes(filter.toLowerCase()),
  );

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div className={`wukong-decision-log ${className}`} style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>{title}</h3>
        <input
          type="text"
          placeholder="Search decisions..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={styles.searchInput}
        />
      </div>

      <div style={styles.list}>
        {filteredDecisions.length === 0 ? (
          <div style={styles.emptyState}>No decisions recorded yet.</div>
        ) : (
          filteredDecisions.map((decision) => (
            <div key={decision.id} style={styles.itemWrapper}>
              <div style={styles.timelineLine} />
              <div style={styles.timelineDot} />

              <button
                type="button"
                style={{ ...styles.item, width: '100%', textAlign: 'left', font: 'inherit' }}
                onClick={() => toggleExpand(decision.id)}
              >
                <div style={styles.itemHeader}>
                  <span style={styles.timestamp}>{formatDate(decision.timestamp)}</span>
                  <span style={styles.itemTitle}>{decision.title}</span>
                  <span style={styles.expandIcon}>{expandedId === decision.id ? '▼' : '▶'}</span>
                </div>

                {expandedId === decision.id && (
                  <div style={styles.itemContent}>
                    <p style={styles.description}>{decision.description}</p>
                    <div style={styles.reasoningBox}>
                      <strong>Reasoning:</strong> {decision.reasoning}
                    </div>
                    {decision.tags && decision.tags.length > 0 && (
                      <div style={styles.tags}>
                        {decision.tags.map((tag) => (
                          <span key={tag} style={styles.tag}>
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

function getStyles(theme: Theme) {
  return {
    container: {
      backgroundColor: theme.colors.surface,
      borderRadius: `${theme.borderRadius.md}px`,
      border: `1px solid ${theme.colors.border}`,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column' as const,
      maxHeight: '500px',
    },
    header: {
      padding: `${theme.spacing.md}px`,
      borderBottom: `1px solid ${theme.colors.border}`,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: theme.colors.background,
    },
    title: {
      margin: 0,
      fontSize: `${theme.typography.fontSize.md}px`,
      fontWeight: theme.typography.fontWeight.medium,
      color: theme.colors.text,
    },
    searchInput: {
      padding: `${theme.spacing.xs}px ${theme.spacing.sm}px`,
      borderRadius: `${theme.borderRadius.sm}px`,
      border: `1px solid ${theme.colors.border}`,
      fontSize: `${theme.typography.fontSize.sm}px`,
      outline: 'none',
    },
    list: {
      overflowY: 'auto' as const,
      padding: `${theme.spacing.md}px`,
      display: 'flex',
      flexDirection: 'column' as const,
      gap: `${theme.spacing.sm}px`,
    },
    emptyState: {
      textAlign: 'center' as const,
      padding: `${theme.spacing.lg}px`,
      color: theme.colors.textSecondary,
      fontStyle: 'italic',
    },
    itemWrapper: {
      position: 'relative' as const,
      paddingLeft: `${theme.spacing.lg}px`,
    },
    timelineLine: {
      position: 'absolute' as const,
      left: '6px',
      top: '20px',
      bottom: '-10px',
      width: '2px',
      backgroundColor: theme.colors.border,
    },
    timelineDot: {
      position: 'absolute' as const,
      left: '0',
      top: '6px',
      width: '14px',
      height: '14px',
      borderRadius: '50%',
      backgroundColor: theme.colors.secondary,
      border: `2px solid ${theme.colors.surface}`,
      zIndex: 1,
    },
    item: {
      backgroundColor: theme.colors.background,
      borderRadius: `${theme.borderRadius.sm}px`,
      border: `1px solid ${theme.colors.border}`,
      cursor: 'pointer',
      transition: 'all 0.2s ease',
    },
    itemHeader: {
      padding: `${theme.spacing.sm}px`,
      display: 'flex',
      alignItems: 'center',
      gap: `${theme.spacing.sm}px`,
    },
    timestamp: {
      fontSize: `${theme.typography.fontSize.xs}px`,
      color: theme.colors.textSecondary,
      fontFamily: 'monospace',
      minWidth: '60px',
    },
    itemTitle: {
      flex: 1,
      fontSize: `${theme.typography.fontSize.sm}px`,
      fontWeight: theme.typography.fontWeight.medium,
      color: theme.colors.text,
    },
    expandIcon: {
      fontSize: `${theme.typography.fontSize.xs}px`,
      color: theme.colors.textSecondary,
    },
    itemContent: {
      padding: `0 ${theme.spacing.sm}px ${theme.spacing.sm}px ${theme.spacing.sm}px`,
      borderTop: `1px solid ${theme.colors.border}`,
      marginTop: `${theme.spacing.xs}px`,
    },
    description: {
      margin: `${theme.spacing.xs}px 0`,
      fontSize: `${theme.typography.fontSize.sm}px`,
      color: theme.colors.text,
    },
    reasoningBox: {
      backgroundColor: theme.colors.surface,
      padding: `${theme.spacing.xs}px`,
      borderRadius: `${theme.borderRadius.sm}px`,
      fontSize: `${theme.typography.fontSize.sm}px`,
      color: theme.colors.textSecondary,
      marginTop: `${theme.spacing.xs}px`,
      fontStyle: 'italic',
    },
    tags: {
      display: 'flex',
      gap: `${theme.spacing.xs}px`,
      marginTop: `${theme.spacing.xs}px`,
      flexWrap: 'wrap' as const,
    },
    tag: {
      fontSize: `${theme.typography.fontSize.xs}px`,
      color: theme.colors.primary,
      backgroundColor: `${theme.colors.primary}15`,
      padding: '2px 6px',
      borderRadius: '4px',
    },
  };
}
