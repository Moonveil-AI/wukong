import type React from 'react';
import { useTheme } from '../theme/ThemeContext';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: React.ReactNode;
  risks?: string[];
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDangerous?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  message,
  risks = [],
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  isDangerous = false,
}) => {
  const { theme } = useTheme();

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999,
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-desc"
        style={{
          backgroundColor: theme.colors.surface,
          borderRadius: theme.borderRadius.lg,
          padding: theme.spacing.xl,
          maxWidth: '500px',
          width: '90%',
          boxShadow: theme.shadows.lg,
          color: theme.colors.text,
        }}
      >
        <h2
          id="confirm-dialog-title"
          style={{
            margin: 0,
            marginBottom: theme.spacing.md,
            fontSize: theme.typography.fontSize.lg,
            fontWeight: theme.typography.fontWeight.bold,
            color: isDangerous ? theme.colors.error : theme.colors.text,
          }}
        >
          {title}
        </h2>

        <div
          id="confirm-dialog-desc"
          style={{
            marginBottom: theme.spacing.lg,
            fontSize: theme.typography.fontSize.md,
            lineHeight: 1.5,
          }}
        >
          {message}
        </div>

        {risks.length > 0 && (
          <div
            style={{
              backgroundColor: `${theme.colors.warning}15`, // 15% opacity
              borderLeft: `4px solid ${theme.colors.warning}`,
              padding: theme.spacing.md,
              marginBottom: theme.spacing.lg,
              borderRadius: theme.borderRadius.sm,
            }}
          >
            <strong
              style={{
                color: theme.colors.warning,
                display: 'block',
                marginBottom: theme.spacing.xs,
              }}
            >
              Potential Risks:
            </strong>
            <ul style={{ margin: 0, paddingLeft: theme.spacing.lg }}>
              {risks.map((risk, index) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: risk list is static
                <li key={index} style={{ marginBottom: theme.spacing.xs }}>
                  {risk}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: theme.spacing.md,
          }}
        >
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: `${theme.spacing.sm}px ${theme.spacing.md}px`,
              borderRadius: theme.borderRadius.md,
              border: `1px solid ${theme.colors.border}`,
              backgroundColor: 'transparent',
              color: theme.colors.text,
              cursor: 'pointer',
              fontSize: theme.typography.fontSize.sm,
            }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            style={{
              padding: `${theme.spacing.sm}px ${theme.spacing.md}px`,
              borderRadius: theme.borderRadius.md,
              border: 'none',
              backgroundColor: isDangerous ? theme.colors.error : theme.colors.primary,
              color: theme.colors.surface,
              cursor: 'pointer',
              fontWeight: theme.typography.fontWeight.medium,
              fontSize: theme.typography.fontSize.sm,
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
