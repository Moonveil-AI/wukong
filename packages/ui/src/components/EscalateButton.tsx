import type React from 'react';
import { useState } from 'react';
import { useTheme } from '../theme/ThemeContext';

export interface EscalateOption {
  label: string;
  action: () => void;
  icon?: React.ReactNode;
}

export interface EscalateButtonProps {
  onEscalate: (reason: string) => void;
  options?: EscalateOption[];
  errorContext?: string;
  className?: string;
  style?: React.CSSProperties;
}

export const EscalateButton: React.FC<EscalateButtonProps> = ({
  onEscalate,
  options = [],
  errorContext,
  className,
  style,
}) => {
  const { theme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState('');

  const handleEscalate = () => {
    onEscalate(reason);
    setIsOpen(false);
    setReason('');
  };

  return (
    <>
      <button
        type="button"
        className={className}
        onClick={() => setIsOpen(true)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: theme.spacing.xs,
          padding: `${theme.spacing.sm}px ${theme.spacing.md}px`,
          borderRadius: theme.borderRadius.md,
          border: `1px solid ${theme.colors.warning}`,
          backgroundColor: `${theme.colors.warning}10`,
          color: theme.colors.warning,
          cursor: 'pointer',
          fontSize: theme.typography.fontSize.sm,
          transition: 'all 0.2s ease',
          ...style,
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
          <title>Escalate Issue</title>
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <span>Escalate Issue</span>
      </button>

      {isOpen && (
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
              style={{
                marginTop: 0,
                marginBottom: theme.spacing.md,
                fontSize: theme.typography.fontSize.lg,
                fontWeight: theme.typography.fontWeight.bold,
              }}
            >
              Escalate to Human
            </h2>

            <div style={{ marginBottom: theme.spacing.md }}>
              <label
                htmlFor="escalate-reason"
                style={{
                  display: 'block',
                  marginBottom: theme.spacing.xs,
                  fontSize: theme.typography.fontSize.sm,
                  fontWeight: theme.typography.fontWeight.medium,
                }}
              >
                Reason for escalation
              </label>
              <textarea
                id="escalate-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Please describe the issue..."
                style={{
                  width: '100%',
                  minHeight: '100px',
                  padding: theme.spacing.sm,
                  borderRadius: theme.borderRadius.md,
                  border: `1px solid ${theme.colors.border}`,
                  backgroundColor: theme.colors.background,
                  color: theme.colors.text,
                  fontSize: theme.typography.fontSize.sm,
                  resize: 'vertical',
                }}
              />
            </div>

            {errorContext && (
              <div
                style={{
                  marginBottom: theme.spacing.lg,
                  padding: theme.spacing.sm,
                  backgroundColor: `${theme.colors.error}10`,
                  borderRadius: theme.borderRadius.md,
                  fontSize: theme.typography.fontSize.xs,
                  color: theme.colors.error,
                }}
              >
                <strong>Error Context:</strong>
                <pre style={{ margin: `${theme.spacing.xs}px 0 0`, whiteSpace: 'pre-wrap' }}>
                  {errorContext}
                </pre>
              </div>
            )}

            {options.length > 0 && (
              <div style={{ marginBottom: theme.spacing.lg }}>
                <p
                  style={{
                    marginBottom: theme.spacing.sm,
                    fontSize: theme.typography.fontSize.sm,
                    color: theme.colors.textSecondary,
                  }}
                >
                  Or choose an option:
                </p>
                <div style={{ display: 'flex', gap: theme.spacing.sm, flexWrap: 'wrap' }}>
                  {options.map((option, index) => (
                    <button
                      type="button"
                      // biome-ignore lint/suspicious/noArrayIndexKey: options list is static
                      key={index}
                      onClick={() => {
                        option.action();
                        setIsOpen(false);
                      }}
                      style={{
                        padding: `${theme.spacing.xs}px ${theme.spacing.sm}px`,
                        borderRadius: theme.borderRadius.full,
                        border: `1px solid ${theme.colors.border}`,
                        backgroundColor: theme.colors.background,
                        color: theme.colors.text,
                        cursor: 'pointer',
                        fontSize: theme.typography.fontSize.xs,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      {option.icon}
                      {option.label}
                    </button>
                  ))}
                </div>
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
                onClick={() => setIsOpen(false)}
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
                Cancel
              </button>
              <button
                type="button"
                onClick={handleEscalate}
                disabled={!reason.trim()}
                style={{
                  padding: `${theme.spacing.sm}px ${theme.spacing.md}px`,
                  borderRadius: theme.borderRadius.md,
                  border: 'none',
                  backgroundColor: theme.colors.primary,
                  color: '#fff',
                  cursor: reason.trim() ? 'pointer' : 'not-allowed',
                  opacity: reason.trim() ? 1 : 0.5,
                  fontWeight: theme.typography.fontWeight.medium,
                  fontSize: theme.typography.fontSize.sm,
                }}
              >
                Submit Escalation
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
