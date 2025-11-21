import type React from 'react';
import { useState } from 'react';
import { useTheme } from '../theme/ThemeContext';
import { DiffView } from './DiffView';

export interface SandboxPreviewProps {
  originalContent: string;
  modifiedContent: string;
  onApply: () => void;
  onDiscard: () => void;
  mode?: 'side-by-side' | 'tabbed';
  className?: string;
  style?: React.CSSProperties;
  title?: string;
}

export const SandboxPreview: React.FC<SandboxPreviewProps> = ({
  originalContent,
  modifiedContent,
  onApply,
  onDiscard,
  mode = 'tabbed',
  className,
  style,
  title = 'Preview Changes',
}) => {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState<'preview' | 'diff'>('preview');

  return (
    <div
      className={className}
      style={{
        border: `1px solid ${theme.colors.border}`,
        borderRadius: theme.borderRadius.lg,
        backgroundColor: theme.colors.surface,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        ...style,
      }}
    >
      <div
        style={{
          padding: theme.spacing.md,
          borderBottom: `1px solid ${theme.colors.border}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: theme.colors.background,
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: theme.typography.fontSize.md,
            fontWeight: theme.typography.fontWeight.medium,
            color: theme.colors.text,
          }}
        >
          {title}
        </h3>
        {mode === 'tabbed' && (
          <div style={{ display: 'flex', gap: theme.spacing.sm }}>
            <button
              type="button"
              onClick={() => setActiveTab('preview')}
              style={{
                padding: `${theme.spacing.xs}px ${theme.spacing.md}px`,
                borderRadius: theme.borderRadius.md,
                border: 'none',
                backgroundColor: activeTab === 'preview' ? theme.colors.primary : 'transparent',
                color: activeTab === 'preview' ? '#fff' : theme.colors.textSecondary,
                cursor: 'pointer',
                fontSize: theme.typography.fontSize.sm,
              }}
            >
              Result
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('diff')}
              style={{
                padding: `${theme.spacing.xs}px ${theme.spacing.md}px`,
                borderRadius: theme.borderRadius.md,
                border: 'none',
                backgroundColor: activeTab === 'diff' ? theme.colors.primary : 'transparent',
                color: activeTab === 'diff' ? '#fff' : theme.colors.textSecondary,
                cursor: 'pointer',
                fontSize: theme.typography.fontSize.sm,
              }}
            >
              Diff
            </button>
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflow: 'auto', minHeight: '300px' }}>
        {mode === 'side-by-side' ? (
          <div style={{ display: 'flex', height: '100%', minHeight: '300px' }}>
            <div
              style={{
                flex: 1,
                borderRight: `1px solid ${theme.colors.border}`,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div
                style={{
                  padding: theme.spacing.sm,
                  borderBottom: `1px solid ${theme.colors.border}`,
                  fontSize: theme.typography.fontSize.xs,
                  fontWeight: theme.typography.fontWeight.bold,
                  color: theme.colors.textSecondary,
                  backgroundColor: theme.colors.background,
                }}
              >
                Original
              </div>
              <div
                style={{
                  padding: theme.spacing.md,
                  fontFamily: 'monospace',
                  whiteSpace: 'pre-wrap',
                  color: theme.colors.text,
                  overflow: 'auto',
                  flex: 1,
                }}
              >
                {originalContent}
              </div>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div
                style={{
                  padding: theme.spacing.sm,
                  borderBottom: `1px solid ${theme.colors.border}`,
                  fontSize: theme.typography.fontSize.xs,
                  fontWeight: theme.typography.fontWeight.bold,
                  color: theme.colors.textSecondary,
                  backgroundColor: theme.colors.background,
                }}
              >
                Modified
              </div>
              <div
                style={{
                  padding: theme.spacing.md,
                  fontFamily: 'monospace',
                  whiteSpace: 'pre-wrap',
                  color: theme.colors.text,
                  overflow: 'auto',
                  flex: 1,
                }}
              >
                {modifiedContent}
              </div>
            </div>
          </div>
        ) : activeTab === 'diff' ? (
          <DiffView
            oldText={originalContent}
            newText={modifiedContent}
            style={{ border: 'none', height: '100%' }}
          />
        ) : (
          <div
            style={{
              padding: theme.spacing.md,
              fontFamily: 'monospace',
              whiteSpace: 'pre-wrap',
              color: theme.colors.text,
            }}
          >
            {modifiedContent}
          </div>
        )}
      </div>

      <div
        style={{
          padding: theme.spacing.md,
          borderTop: `1px solid ${theme.colors.border}`,
          display: 'flex',
          justifyContent: 'flex-end',
          gap: theme.spacing.md,
          backgroundColor: theme.colors.background,
        }}
      >
        <button
          type="button"
          onClick={onDiscard}
          style={{
            padding: `${theme.spacing.sm}px ${theme.spacing.md}px`,
            borderRadius: theme.borderRadius.md,
            border: `1px solid ${theme.colors.border}`,
            backgroundColor: theme.colors.surface,
            color: theme.colors.text,
            cursor: 'pointer',
            fontSize: theme.typography.fontSize.sm,
          }}
        >
          Discard
        </button>
        <button
          type="button"
          onClick={onApply}
          style={{
            padding: `${theme.spacing.sm}px ${theme.spacing.md}px`,
            borderRadius: theme.borderRadius.md,
            border: 'none',
            backgroundColor: theme.colors.primary,
            color: '#fff',
            cursor: 'pointer',
            fontSize: theme.typography.fontSize.sm,
            fontWeight: theme.typography.fontWeight.medium,
          }}
        >
          Apply Changes
        </button>
      </div>
    </div>
  );
};
