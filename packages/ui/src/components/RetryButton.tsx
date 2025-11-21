import type React from 'react';
import { useState } from 'react';
import { useTheme } from '../theme';

export interface RetryButtonProps {
  onRetry: () => void;
  label?: string;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
  className?: string;
}

export const RetryButton: React.FC<RetryButtonProps> = ({
  onRetry,
  label = 'Retry',
  variant = 'primary',
  disabled = false,
  className = '',
}) => {
  const { theme } = useTheme();
  const [isHovered, setIsHovered] = useState(false);

  const getBackgroundColor = () => {
    if (disabled) return theme.colors.border;
    if (variant === 'primary') return theme.colors.primary;
    if (variant === 'secondary') return theme.colors.secondary;
    return 'transparent';
  };

  const getTextColor = () => {
    if (disabled) return theme.colors.textSecondary;
    if (variant === 'ghost') return theme.colors.primary;
    return '#ffffff';
  };

  return (
    <button
      type="button"
      className={className}
      onClick={onRetry}
      disabled={disabled}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: theme.spacing.xs,
        padding: `${theme.spacing.xs}px ${theme.spacing.md}px`,
        backgroundColor: getBackgroundColor(),
        color: getTextColor(),
        border: variant === 'ghost' ? `1px solid ${theme.colors.primary}` : 'none',
        borderRadius: theme.borderRadius.md,
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: theme.typography.fontSize.md,
        fontFamily: theme.typography.fontFamily,
        fontWeight: theme.typography.fontWeight.medium,
        opacity: disabled ? 0.7 : isHovered ? 0.9 : 1,
        transition: 'all 0.2s ease',
      }}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <title>Retry Icon</title>
        <path d="M21 2v6h-6" />
        <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
        <path d="M3 22v-6h6" />
        <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
      </svg>
      {label}
    </button>
  );
};
