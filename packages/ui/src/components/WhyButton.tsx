import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { useTheme } from '../theme';
import type { Theme } from '../theme/types';

export interface WhyButtonProps {
  explanation: string;
  context?: Record<string, unknown>;
  label?: string;
  className?: string;
}

/**
 * WhyButton - Explain reasoning for actions
 *
 * Implements Principle 17: Allow asking "Why?"
 */
export const WhyButton: React.FC<WhyButtonProps> = ({
  explanation,
  context,
  label = 'Why?',
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();
  const styles = getStyles(theme);

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className={`wukong-why-button ${className}`} style={styles.container}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={styles.button}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <span style={styles.icon}>❓</span>
        <span style={styles.label}>{label}</span>
      </button>

      {isOpen && (
        <div ref={popoverRef} style={styles.popover} role="tooltip">
          <div style={styles.arrow} />
          <div style={styles.header}>
            <h4 style={styles.title}>Explanation</h4>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              style={styles.closeButton}
              aria-label="Close explanation"
            >
              ✕
            </button>
          </div>
          <div style={styles.content}>
            <p style={styles.text}>{explanation}</p>

            {context && Object.keys(context).length > 0 && (
              <div style={styles.context}>
                <span style={styles.contextLabel}>Context:</span>
                <pre style={styles.contextData}>{JSON.stringify(context, null, 2)}</pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

function getStyles(theme: Theme) {
  return {
    container: {
      position: 'relative' as const,
      display: 'inline-block',
    },
    button: {
      display: 'flex',
      alignItems: 'center',
      gap: `${theme.spacing.xs}px`,
      padding: `${theme.spacing.xs}px ${theme.spacing.sm}px`,
      backgroundColor: 'transparent',
      border: `1px solid ${theme.colors.border}`,
      borderRadius: `${theme.borderRadius.full || 999}px`,
      cursor: 'pointer',
      color: theme.colors.textSecondary,
      fontSize: `${theme.typography.fontSize.xs}px`,
      transition: 'all 0.2s ease',
    },
    icon: {
      fontSize: `${theme.typography.fontSize.sm}px`,
    },
    label: {
      fontWeight: theme.typography.fontWeight.medium,
    },
    popover: {
      position: 'absolute' as const,
      bottom: '100%',
      left: '50%',
      transform: 'translateX(-50%)',
      marginBottom: `${theme.spacing.sm}px`,
      width: '300px',
      backgroundColor: theme.colors.surface,
      borderRadius: `${theme.borderRadius.md}px`,
      boxShadow: theme.shadows.lg || '0 4px 12px rgba(0,0,0,0.15)',
      border: `1px solid ${theme.colors.border}`,
      zIndex: 10,
      overflow: 'hidden',
    },
    arrow: {
      position: 'absolute' as const,
      bottom: '-6px',
      left: '50%',
      transform: 'translateX(-50%) rotate(45deg)',
      width: '12px',
      height: '12px',
      backgroundColor: theme.colors.surface,
      borderRight: `1px solid ${theme.colors.border}`,
      borderBottom: `1px solid ${theme.colors.border}`,
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: `${theme.spacing.sm}px ${theme.spacing.md}px`,
      borderBottom: `1px solid ${theme.colors.border}`,
      backgroundColor: theme.colors.background,
    },
    title: {
      margin: 0,
      fontSize: `${theme.typography.fontSize.sm}px`,
      fontWeight: theme.typography.fontWeight.bold,
      color: theme.colors.text,
    },
    closeButton: {
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      color: theme.colors.textSecondary,
      fontSize: `${theme.typography.fontSize.sm}px`,
      padding: '4px',
    },
    content: {
      padding: `${theme.spacing.md}px`,
      maxHeight: '300px',
      overflowY: 'auto' as const,
    },
    text: {
      margin: 0,
      fontSize: `${theme.typography.fontSize.sm}px`,
      color: theme.colors.text,
      lineHeight: 1.5,
    },
    context: {
      marginTop: `${theme.spacing.md}px`,
      borderTop: `1px solid ${theme.colors.border}`,
      paddingTop: `${theme.spacing.sm}px`,
    },
    contextLabel: {
      fontSize: `${theme.typography.fontSize.xs}px`,
      fontWeight: theme.typography.fontWeight.bold,
      color: theme.colors.textSecondary,
      display: 'block',
      marginBottom: `${theme.spacing.xs}px`,
    },
    contextData: {
      margin: 0,
      fontSize: `${theme.typography.fontSize.xs}px`,
      fontFamily: 'monospace',
      color: theme.colors.textSecondary,
      backgroundColor: theme.colors.background,
      padding: `${theme.spacing.xs}px`,
      borderRadius: `${theme.borderRadius.sm}px`,
      overflowX: 'auto' as const,
    },
  };
}
