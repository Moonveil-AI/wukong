import type React from 'react';
import { useTheme } from '../theme';

export interface Metric {
  label: string;
  value: string | number;
  change?: number; // percentage change
  trend?: 'up' | 'down' | 'neutral';
  description?: string;
}

export interface MetricsDashboardProps {
  metrics: Metric[];
  title?: string;
  className?: string;
}

export const MetricsDashboard: React.FC<MetricsDashboardProps> = ({
  metrics,
  title = 'Agent Performance',
  className = '',
}) => {
  const { theme } = useTheme();

  const getTrendColor = (trend?: 'up' | 'down' | 'neutral') => {
    if (trend === 'up') return theme.colors.success;
    if (trend === 'down') return theme.colors.error;
    return theme.colors.textSecondary;
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
      <h2
        style={{
          margin: `0 0 ${theme.spacing.lg}px 0`,
          fontSize: theme.typography.fontSize.xl,
          fontWeight: theme.typography.fontWeight.bold,
          color: theme.colors.text,
        }}
      >
        {title}
      </h2>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: theme.spacing.lg,
        }}
      >
        {metrics.map((metric) => (
          <div
            key={metric.label}
            style={{
              padding: theme.spacing.md,
              backgroundColor: theme.colors.background,
              borderRadius: theme.borderRadius.md,
              border: `1px solid ${theme.colors.border}`,
            }}
          >
            <div
              style={{
                fontSize: theme.typography.fontSize.sm,
                color: theme.colors.textSecondary,
                marginBottom: theme.spacing.xs,
              }}
            >
              {metric.label}
            </div>

            <div
              style={{
                fontSize: theme.typography.fontSize.xl,
                fontWeight: theme.typography.fontWeight.bold,
                color: theme.colors.text,
                marginBottom: theme.spacing.xs,
                display: 'flex',
                alignItems: 'baseline',
                gap: theme.spacing.sm,
              }}
            >
              {metric.value}
              {metric.change !== undefined && (
                <span
                  style={{
                    fontSize: theme.typography.fontSize.sm,
                    color: getTrendColor(metric.trend),
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  {metric.change > 0 ? '+' : ''}
                  {metric.change}%
                </span>
              )}
            </div>

            {metric.description && (
              <div
                style={{
                  fontSize: theme.typography.fontSize.xs,
                  color: theme.colors.textSecondary,
                }}
              >
                {metric.description}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
