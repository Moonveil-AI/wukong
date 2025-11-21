import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { useTheme } from '../theme';
import type { Theme } from '../theme/types';

export interface ThinkingProcessProps {
  content: string;
  isStreaming?: boolean;
  title?: string;
  className?: string;
}

/**
 * ThinkingProcess - Detailed streaming reasoning display
 *
 * Implements Principle 15: Show the thinking process
 */
export const ThinkingProcess: React.FC<ThinkingProcessProps> = ({
  content,
  isStreaming = false,
  title = 'Reasoning Process',
  className = '',
}) => {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const [isExpanded, setIsExpanded] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: content is required to trigger scroll on update
  useEffect(() => {
    if (isStreaming && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [isStreaming, content]);

  // Basic syntax highlighting for common keywords in reasoning
  const highlightSyntax = (text: string) => {
    const parts = text.split(/(\b(?:Plan|Reasoning|Action|Observation|Thought|Critique):)/g);
    return parts.map((part, index) => {
      if (part.match(/^(?:Plan|Reasoning|Action|Observation|Thought|Critique):$/)) {
        return (
          <strong key={`${index}-${part}`} style={styles.keyword}>
            {part}
          </strong>
        );
      }
      return <span key={`${index}-${part.substring(0, 10)}`}>{part}</span>;
    });
  };

  return (
    <div className={`wukong-thinking-process ${className}`} style={styles.container}>
      <button
        type="button"
        style={{
          ...styles.header,
          border: 'none',
          width: '100%',
          textAlign: 'left',
          font: 'inherit',
        }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div style={styles.titleWrapper}>
          <span style={styles.icon}>🧠</span>
          <span style={styles.title}>{title}</span>
          {isStreaming && <span style={styles.indicator} />}
        </div>
        <span style={styles.expandIcon}>{isExpanded ? '▼' : '▶'}</span>
      </button>

      {isExpanded && (
        <div style={styles.contentWrapper}>
          <div ref={contentRef} style={styles.content}>
            {highlightSyntax(content)}
            {isStreaming && <span style={styles.cursor}>▋</span>}
          </div>
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
      border: `1px solid ${theme.colors.border}`,
      overflow: 'hidden',
      marginBottom: `${theme.spacing.md}px`,
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: `${theme.spacing.sm}px ${theme.spacing.md}px`,
      backgroundColor: theme.colors.background,
      cursor: 'pointer',
      userSelect: 'none' as const,
    },
    titleWrapper: {
      display: 'flex',
      alignItems: 'center',
      gap: `${theme.spacing.sm}px`,
    },
    icon: {
      fontSize: `${theme.typography.fontSize.lg}px`,
    },
    title: {
      fontSize: `${theme.typography.fontSize.md}px`,
      fontWeight: theme.typography.fontWeight.bold,
      color: theme.colors.text,
    },
    indicator: {
      width: '8px',
      height: '8px',
      borderRadius: '50%',
      backgroundColor: theme.colors.secondary,
      animation: 'pulse 1.5s infinite',
    },
    expandIcon: {
      fontSize: `${theme.typography.fontSize.sm}px`,
      color: theme.colors.textSecondary,
    },
    contentWrapper: {
      padding: `${theme.spacing.md}px`,
      borderTop: `1px solid ${theme.colors.border}`,
    },
    content: {
      fontFamily: 'monospace',
      fontSize: `${theme.typography.fontSize.sm}px`,
      lineHeight: 1.6,
      color: theme.colors.text,
      whiteSpace: 'pre-wrap' as const,
      maxHeight: '400px',
      overflowY: 'auto' as const,
    },
    keyword: {
      color: theme.colors.primary,
      fontWeight: 'bold',
    },
    cursor: {
      display: 'inline-block',
      marginLeft: '2px',
      animation: 'blink 1s step-end infinite',
      color: theme.colors.primary,
    },
  };
}
