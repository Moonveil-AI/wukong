import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { useTheme } from '../theme';
import type { Theme } from '../theme/types';

export interface ThinkingBoxProps {
  thinking: string;
  streaming?: boolean;
  autoScroll?: boolean;
  collapsible?: boolean;
  showTimestamp?: boolean;
  maxHeight?: number;
  onClose?: () => void;
  className?: string;
}

/**
 * ThinkingBox - Real-time streaming display of agent's thinking process
 *
 * Implements Principle 11: Show what the agent is thinking in real-time
 */
export const ThinkingBox: React.FC<ThinkingBoxProps> = ({
  thinking,
  streaming = false,
  autoScroll = true,
  collapsible = true,
  showTimestamp = false,
  maxHeight = 400,
  onClose,
  className = '',
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(autoScroll);
  const contentRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();

  const styles = getStyles(theme, maxHeight);

  // Auto-scroll effect
  useEffect(() => {
    if (isAutoScrollEnabled && contentRef.current && streaming) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [isAutoScrollEnabled, streaming]);

  // Detect manual scroll
  const handleScroll = () => {
    if (!contentRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = contentRef.current;
    const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10;

    setIsAutoScrollEnabled(isAtBottom);
  };

  const renderContent = () => {
    // Simple markdown-like rendering
    const lines = thinking.split('\n');
    return lines.map((line, index) => {
      // Use index + line content hash for unique keys
      const key = `${index}-${line.substring(0, 20)}`;

      // Headers
      if (line.startsWith('### ')) {
        return (
          <h4 key={key} style={styles.heading3}>
            {line.substring(4)}
          </h4>
        );
      }
      if (line.startsWith('## ')) {
        return (
          <h3 key={key} style={styles.heading2}>
            {line.substring(3)}
          </h3>
        );
      }
      if (line.startsWith('# ')) {
        return (
          <h2 key={key} style={styles.heading1}>
            {line.substring(2)}
          </h2>
        );
      }

      // Code blocks (simplified)
      if (line.startsWith('```')) {
        return <div key={key} style={styles.codeDelimiter} />;
      }
      if (line.startsWith('`') && line.endsWith('`')) {
        return (
          <code key={key} style={styles.inlineCode}>
            {line.substring(1, line.length - 1)}
          </code>
        );
      }

      // Lists
      if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        return (
          <li key={key} style={styles.listItem}>
            {line.trim().substring(2)}
          </li>
        );
      }
      if (/^\d+\.\s/.test(line.trim())) {
        return (
          <li key={key} style={styles.listItem}>
            {line.trim().replace(/^\d+\.\s/, '')}
          </li>
        );
      }

      // Bold text (simplified - use strong tags directly)
      if (line.includes('**')) {
        const parts = line.split('**');
        return (
          <p key={key} style={styles.paragraph}>
            {parts.map((part, i) =>
              // biome-ignore lint/suspicious/noArrayIndexKey: Parts order is stable
              i % 2 === 1 ? <strong key={`${key}-${i}`}>{part}</strong> : part,
            )}
          </p>
        );
      }

      // Empty lines
      if (line.trim() === '') {
        return <br key={key} />;
      }

      // Regular paragraph
      return (
        <p key={key} style={styles.paragraph}>
          {line}
        </p>
      );
    });
  };

  return (
    <div className={`wukong-thinking-box ${className}`} style={styles.container}>
      <div style={styles.header}>
        {collapsible && (
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            style={styles.toggleButton}
            aria-expanded={isExpanded}
            aria-label={isExpanded ? 'Collapse thinking' : 'Expand thinking'}
          >
            <span style={styles.toggleIcon}>{isExpanded ? '▼' : '▶'}</span>
          </button>
        )}

        <div style={styles.titleContainer}>
          <span style={styles.thinkingIcon}>💭</span>
          <h3 style={styles.title}>Thinking{streaming && '...'}</h3>
          {streaming && <span style={styles.streamingIndicator}>●</span>}
        </div>

        {showTimestamp && <span style={styles.timestamp}>{new Date().toLocaleTimeString()}</span>}

        {!isAutoScrollEnabled && autoScroll && (
          <button
            type="button"
            onClick={() => {
              setIsAutoScrollEnabled(true);
              if (contentRef.current) {
                contentRef.current.scrollTop = contentRef.current.scrollHeight;
              }
            }}
            style={styles.scrollButton}
            aria-label="Scroll to bottom"
          >
            ↓ Scroll to bottom
          </button>
        )}

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            style={styles.closeButton}
            aria-label="Close thinking box"
          >
            ✕
          </button>
        )}
      </div>

      {isExpanded && (
        <div ref={contentRef} style={styles.content} onScroll={handleScroll}>
          {thinking ? (
            renderContent()
          ) : (
            <p style={styles.emptyState}>Waiting for agent to start thinking...</p>
          )}
        </div>
      )}
    </div>
  );
};

function getStyles(theme: Theme, maxHeight: number) {
  return {
    container: {
      backgroundColor: theme.colors.surface,
      borderRadius: `${theme.borderRadius.md}px`,
      padding: `${theme.spacing.md}px`,
      marginBottom: `${theme.spacing.md}px`,
      border: `1px solid ${theme.colors.border}`,
    },
    header: {
      display: 'flex',
      alignItems: 'center',
      gap: `${theme.spacing.sm}px`,
      marginBottom: `${theme.spacing.sm}px`,
    },
    toggleButton: {
      padding: `${theme.spacing.xs}px`,
      border: 'none',
      background: 'none',
      cursor: 'pointer',
      fontSize: `${theme.typography.fontSize.sm}px`,
      color: theme.colors.textSecondary,
    },
    toggleIcon: {
      display: 'block',
    },
    titleContainer: {
      display: 'flex',
      alignItems: 'center',
      gap: `${theme.spacing.xs}px`,
      flex: 1,
    },
    thinkingIcon: {
      fontSize: `${theme.typography.fontSize.lg}px`,
    },
    title: {
      margin: 0,
      fontSize: `${theme.typography.fontSize.lg}px`,
      fontWeight: theme.typography.fontWeight.medium,
      color: theme.colors.text,
    },
    streamingIndicator: {
      width: '8px',
      height: '8px',
      borderRadius: '50%',
      backgroundColor: theme.colors.primary,
      animation: 'pulse 1.5s ease-in-out infinite',
    },
    timestamp: {
      fontSize: `${theme.typography.fontSize.xs}px`,
      color: theme.colors.textSecondary,
    },
    scrollButton: {
      padding: `${theme.spacing.xs}px ${theme.spacing.sm}px`,
      border: `1px solid ${theme.colors.primary}`,
      borderRadius: `${theme.borderRadius.sm}px`,
      backgroundColor: 'transparent',
      color: theme.colors.primary,
      fontSize: `${theme.typography.fontSize.xs}px`,
      cursor: 'pointer',
    },
    closeButton: {
      padding: `${theme.spacing.xs}px`,
      border: 'none',
      background: 'none',
      cursor: 'pointer',
      fontSize: `${theme.typography.fontSize.lg}px`,
      color: theme.colors.textSecondary,
      lineHeight: 1,
    },
    content: {
      maxHeight: `${maxHeight}px`,
      overflowY: 'auto' as const,
      padding: `${theme.spacing.sm}px`,
      backgroundColor: theme.colors.background,
      borderRadius: `${theme.borderRadius.sm}px`,
      fontFamily: theme.typography.fontFamily,
    },
    emptyState: {
      margin: 0,
      fontSize: `${theme.typography.fontSize.sm}px`,
      color: theme.colors.textSecondary,
      fontStyle: 'italic',
      textAlign: 'center' as const,
      padding: `${theme.spacing.lg}px`,
    },
    paragraph: {
      margin: 0,
      marginBottom: `${theme.spacing.sm}px`,
      fontSize: `${theme.typography.fontSize.sm}px`,
      color: theme.colors.text,
      lineHeight: 1.6,
    },
    heading1: {
      margin: 0,
      marginTop: `${theme.spacing.md}px`,
      marginBottom: `${theme.spacing.sm}px`,
      fontSize: `${theme.typography.fontSize.xl}px`,
      fontWeight: theme.typography.fontWeight.bold,
      color: theme.colors.text,
    },
    heading2: {
      margin: 0,
      marginTop: `${theme.spacing.md}px`,
      marginBottom: `${theme.spacing.sm}px`,
      fontSize: `${theme.typography.fontSize.lg}px`,
      fontWeight: theme.typography.fontWeight.bold,
      color: theme.colors.text,
    },
    heading3: {
      margin: 0,
      marginTop: `${theme.spacing.sm}px`,
      marginBottom: `${theme.spacing.xs}px`,
      fontSize: `${theme.typography.fontSize.md}px`,
      fontWeight: theme.typography.fontWeight.bold,
      color: theme.colors.text,
    },
    inlineCode: {
      padding: '2px 6px',
      backgroundColor: theme.colors.surface,
      borderRadius: `${theme.borderRadius.sm}px`,
      fontFamily: 'monospace',
      fontSize: `${theme.typography.fontSize.xs}px`,
      color: theme.colors.primary,
    },
    codeDelimiter: {
      height: '1px',
      backgroundColor: theme.colors.border,
      margin: `${theme.spacing.xs}px 0`,
    },
    listItem: {
      marginBottom: `${theme.spacing.xs}px`,
      marginLeft: `${theme.spacing.md}px`,
      fontSize: `${theme.typography.fontSize.sm}px`,
      color: theme.colors.text,
      lineHeight: 1.6,
    },
  };
}
