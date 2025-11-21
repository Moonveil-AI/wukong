import type React from 'react';
import { useTheme } from '../theme';

export interface TrustFactor {
  label: string;
  score: number; // 0-100
  impact: 'positive' | 'negative' | 'neutral';
  description?: string;
}

export interface TrustScoreProps {
  score: number; // 0-100
  factors: TrustFactor[];
  history?: { date: string; score: number }[];
  className?: string;
}

export const TrustScore: React.FC<TrustScoreProps> = ({
  score,
  factors,
  history,
  className = '',
}) => {
  const { theme } = useTheme();

  const getScoreColor = (val: number) => {
    if (val >= 80) return theme.colors.success;
    if (val >= 60) return theme.colors.warning;
    return theme.colors.error;
  };

  return (
    <div
      className={className}
      style={{
        backgroundColor: theme.colors.surface,
        borderRadius: theme.borderRadius.lg,
        border: `1px solid ${theme.colors.border}`,
        padding: theme.spacing.lg,
        fontFamily: theme.typography.fontFamily,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: theme.spacing.lg,
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: theme.typography.fontSize.xl,
            fontWeight: theme.typography.fontWeight.bold,
            color: theme.colors.text,
          }}
        >
          Trust Score
        </h2>
        <div
          style={{
            fontSize: '2.5rem',
            fontWeight: 'bold',
            color: getScoreColor(score),
          }}
        >
          {score}
        </div>
      </div>

      <div style={{ marginBottom: theme.spacing.lg }}>
        <h3
          style={{
            fontSize: theme.typography.fontSize.md,
            marginBottom: theme.spacing.md,
            color: theme.colors.text,
          }}
        >
          Trust Factors
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.sm }}>
          {factors.map((factor) => (
            <div
              key={factor.label}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: theme.spacing.sm,
                backgroundColor: theme.colors.background,
                borderRadius: theme.borderRadius.sm,
              }}
            >
              <div>
                <div
                  style={{
                    fontWeight: theme.typography.fontWeight.medium,
                    color: theme.colors.text,
                  }}
                >
                  {factor.label}
                </div>
                {factor.description && (
                  <div
                    style={{
                      fontSize: theme.typography.fontSize.xs,
                      color: theme.colors.textSecondary,
                    }}
                  >
                    {factor.description}
                  </div>
                )}
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: theme.spacing.xs,
                  color:
                    factor.impact === 'positive'
                      ? theme.colors.success
                      : factor.impact === 'negative'
                        ? theme.colors.error
                        : theme.colors.textSecondary,
                }}
              >
                {factor.impact === 'positive' ? '↑' : factor.impact === 'negative' ? '↓' : '•'}
                {factor.score}
              </div>
            </div>
          ))}
        </div>
      </div>

      {history && history.length > 0 && (
        <div>
          <h3
            style={{
              fontSize: theme.typography.fontSize.md,
              marginBottom: theme.spacing.md,
              color: theme.colors.text,
            }}
          >
            History
          </h3>
          {/* Simple bar chart for history */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              height: '100px',
              gap: '4px',
              borderBottom: `1px solid ${theme.colors.border}`,
              paddingBottom: '4px',
            }}
          >
            {history.map((item, index) => (
              <div
                key={`${item.date}-${index}`}
                style={{
                  flex: 1,
                  backgroundColor: getScoreColor(item.score),
                  height: `${item.score}%`,
                  borderRadius: `${theme.borderRadius.sm}px ${theme.borderRadius.sm}px 0 0`,
                  position: 'relative',
                  minWidth: '4px',
                }}
                title={`${item.date}: ${item.score}`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
