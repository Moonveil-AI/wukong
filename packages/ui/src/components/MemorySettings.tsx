import type React from 'react';
import { useState } from 'react';
import { useTheme } from '../theme';

export interface MemorySettingsProps {
  retentionDays: number;
  onRetentionChange: (days: number) => void;
  rememberContext: boolean;
  onRememberContextChange: (enabled: boolean) => void;
  rememberUserPreferences: boolean;
  onRememberUserPreferencesChange: (enabled: boolean) => void;
  onClearMemory: () => void;
  className?: string;
}

export const MemorySettings: React.FC<MemorySettingsProps> = ({
  retentionDays,
  onRetentionChange,
  rememberContext,
  onRememberContextChange,
  rememberUserPreferences,
  onRememberUserPreferencesChange,
  onClearMemory,
  className = '',
}) => {
  const { theme } = useTheme();
  const [isClearHovered, setIsClearHovered] = useState(false);

  return (
    <div
      className={className}
      style={{
        padding: theme.spacing.md,
        backgroundColor: theme.colors.surface,
        borderRadius: theme.borderRadius.md,
        border: `1px solid ${theme.colors.border}`,
        color: theme.colors.text,
        fontFamily: theme.typography.fontFamily,
      }}
    >
      <h3
        style={{
          margin: `0 0 ${theme.spacing.md}px 0`,
          fontSize: theme.typography.fontSize.lg,
          fontWeight: theme.typography.fontWeight.bold,
        }}
      >
        Memory Settings
      </h3>

      <div
        style={{
          backgroundColor: `${theme.colors.warning}22`,
          border: `1px solid ${theme.colors.warning}`,
          color: theme.colors.warning,
          padding: theme.spacing.sm,
          borderRadius: theme.borderRadius.sm,
          marginBottom: theme.spacing.md,
          fontSize: theme.typography.fontSize.sm,
          display: 'flex',
          alignItems: 'center',
          gap: theme.spacing.sm,
        }}
      >
        <span>⚠️</span>
        <span>These settings are currently mocked and not connected to the backend.</span>
      </div>

      <div style={{ marginBottom: theme.spacing.md }}>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: theme.spacing.sm,
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={rememberContext}
            onChange={(e) => onRememberContextChange(e.target.checked)}
            style={{ accentColor: theme.colors.primary }}
          />
          <span style={{ fontSize: theme.typography.fontSize.md }}>
            Remember conversation context
          </span>
        </label>
        <p
          style={{
            margin: `${theme.spacing.xs}px 0 0 ${theme.spacing.lg}px`,
            fontSize: theme.typography.fontSize.sm,
            color: theme.colors.textSecondary,
          }}
        >
          Allow the agent to use past interactions to improve responses.
        </p>
      </div>

      <div style={{ marginBottom: theme.spacing.md }}>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: theme.spacing.sm,
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={rememberUserPreferences}
            onChange={(e) => onRememberUserPreferencesChange(e.target.checked)}
            style={{ accentColor: theme.colors.primary }}
          />
          <span style={{ fontSize: theme.typography.fontSize.md }}>Remember user preferences</span>
        </label>
        <p
          style={{
            margin: `${theme.spacing.xs}px 0 0 ${theme.spacing.lg}px`,
            fontSize: theme.typography.fontSize.sm,
            color: theme.colors.textSecondary,
          }}
        >
          Allow the agent to store your preferences and settings.
        </p>
      </div>

      <div style={{ marginBottom: theme.spacing.lg }}>
        <label
          htmlFor="retention-days"
          style={{
            display: 'block',
            marginBottom: theme.spacing.xs,
            fontSize: theme.typography.fontSize.md,
          }}
        >
          Retention Period: {retentionDays} days
        </label>
        <input
          id="retention-days"
          type="range"
          min="1"
          max="365"
          value={retentionDays}
          onChange={(e) => onRetentionChange(Number(e.target.value))}
          style={{
            width: '100%',
            accentColor: theme.colors.primary,
          }}
        />
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: theme.typography.fontSize.xs,
            color: theme.colors.textSecondary,
          }}
        >
          <span>1 day</span>
          <span>1 year</span>
        </div>
      </div>

      <div style={{ borderTop: `1px solid ${theme.colors.border}`, paddingTop: theme.spacing.md }}>
        <button
          type="button"
          onClick={() => {
            if (
              window.confirm(
                'Are you sure you want to clear all memory? This action cannot be undone.',
              )
            ) {
              onClearMemory();
            }
          }}
          onMouseEnter={() => setIsClearHovered(true)}
          onMouseLeave={() => setIsClearHovered(false)}
          style={{
            padding: `${theme.spacing.xs}px ${theme.spacing.md}px`,
            backgroundColor: theme.colors.error,
            color: '#fff',
            border: 'none',
            borderRadius: theme.borderRadius.sm,
            cursor: 'pointer',
            fontSize: theme.typography.fontSize.sm,
            fontWeight: theme.typography.fontWeight.medium,
            transition: 'opacity 0.2s',
            opacity: isClearHovered ? 0.9 : 1,
          }}
        >
          Clear All Memory
        </button>
      </div>
    </div>
  );
};
