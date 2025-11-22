import type React from 'react';
import { useState } from 'react';
import { useTheme } from '../theme/ThemeContext';
import { ConfirmDialog } from './ConfirmDialog';

export interface StopButtonProps {
  onStop: () => void;
  requireConfirmation?: boolean;
  confirmTitle?: string;
  confirmMessage?: string;
  className?: string;
  style?: React.CSSProperties;
  label?: string;
  variant?: 'default' | 'icon' | 'floating';
}

export const StopButton: React.FC<StopButtonProps> = ({
  onStop,
  requireConfirmation = true,
  confirmTitle = 'Stop Execution?',
  confirmMessage = 'Are you sure you want to stop the current agent execution? This action cannot be undone.',
  className,
  style,
  label = 'Stop',
  variant = 'default',
}) => {
  const { theme } = useTheme();
  const [showConfirm, setShowConfirm] = useState(false);

  const handleClick = () => {
    if (requireConfirmation) {
      setShowConfirm(true);
    } else {
      onStop();
    }
  };

  const handleConfirm = () => {
    setShowConfirm(false);
    onStop();
  };

  const getButtonStyle = (): React.CSSProperties => {
    const baseStyle: React.CSSProperties = {
      backgroundColor: theme.colors.error,
      color: '#fff',
      border: 'none',
      borderRadius: theme.borderRadius.md,
      padding: `${theme.spacing.sm + 2}px ${theme.spacing.md + 4}px`,
      cursor: 'pointer',
      fontWeight: theme.typography.fontWeight.medium,
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing.xs,
      transition: 'background-color 0.2s ease',
      ...style,
    };

    if (variant === 'icon') {
      return {
        ...baseStyle,
        padding: theme.spacing.sm,
        width: '32px',
        height: '32px',
        justifyContent: 'center',
      };
    }

    if (variant === 'floating') {
      return {
        ...baseStyle,
        position: 'fixed',
        bottom: theme.spacing.xl,
        right: theme.spacing.xl,
        boxShadow: theme.shadows.lg,
        zIndex: 100,
        borderRadius: theme.borderRadius.full,
        padding: `${theme.spacing.md}px ${theme.spacing.xl}px`,
      };
    }

    return baseStyle;
  };

  return (
    <>
      <button
        type="button"
        className={className}
        style={getButtonStyle()}
        onClick={handleClick}
        aria-label="Stop execution"
        title="Stop execution"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="currentColor"
          xmlns="http://www.w3.org/2000/svg"
        >
          <title>Stop Icon</title>
          <rect width="12" height="12" rx="2" />
        </svg>
        {variant !== 'icon' && <span>{label}</span>}
      </button>

      <ConfirmDialog
        open={showConfirm}
        title={confirmTitle}
        message={confirmMessage}
        onConfirm={handleConfirm}
        onCancel={() => setShowConfirm(false)}
        confirmLabel="Stop Execution"
        isDangerous={true}
        risks={['Partial data may be lost', 'Current step will be interrupted']}
      />
    </>
  );
};
