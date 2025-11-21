import type React from 'react';
import { useTheme } from '../theme/ThemeContext';

export interface UndoButtonProps {
  onUndo: () => void;
  disabled?: boolean;
  actionName?: string;
  className?: string;
  style?: React.CSSProperties;
  variant?: 'text' | 'contained' | 'outlined';
}

export const UndoButton: React.FC<UndoButtonProps> = ({
  onUndo,
  disabled = false,
  actionName,
  className,
  style,
  variant = 'text',
}) => {
  const { theme } = useTheme();

  const getButtonStyle = (): React.CSSProperties => {
    const baseStyle: React.CSSProperties = {
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing.xs,
      padding: `${theme.spacing.sm}px ${theme.spacing.md}px`,
      borderRadius: theme.borderRadius.md,
      fontSize: theme.typography.fontSize.sm,
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1,
      transition: 'all 0.2s ease',
      ...style,
    };

    switch (variant) {
      case 'contained':
        return {
          ...baseStyle,
          backgroundColor: theme.colors.surface,
          color: theme.colors.text,
          border: `1px solid ${theme.colors.border}`,
          boxShadow: theme.shadows.sm,
        };
      case 'outlined':
        return {
          ...baseStyle,
          backgroundColor: 'transparent',
          color: theme.colors.text,
          border: `1px solid ${theme.colors.border}`,
        };
      default:
        return {
          ...baseStyle,
          backgroundColor: 'transparent',
          color: theme.colors.textSecondary,
          border: 'none',
        };
    }
  };

  return (
    <button
      type="button"
      className={className}
      style={getButtonStyle()}
      onClick={onUndo}
      disabled={disabled}
      aria-label={actionName ? `Undo ${actionName}` : 'Undo last action'}
      title={actionName ? `Undo ${actionName}` : 'Undo last action'}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <title>{actionName ? `Undo ${actionName}` : 'Undo last action'}</title>
        <path d="M3 7v6h6" />
        <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
      </svg>
      <span>Undo {actionName}</span>
    </button>
  );
};
