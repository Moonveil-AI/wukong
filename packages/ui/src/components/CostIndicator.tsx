import type React from 'react';
import { useTheme } from '../theme';
import type { Theme } from '../theme/types';

export interface CostIndicatorProps {
  totalTokens: number;
  inputTokens?: number;
  outputTokens?: number;
  cost?: number; // Estimated cost in USD
  savings?: number; // Estimated savings in USD
  currency?: string;
  showBreakdown?: boolean;
  className?: string;
}

/**
 * CostIndicator - Token usage and cost display
 *
 * Implements Principle 16: Keep track of costs
 */
export const CostIndicator: React.FC<CostIndicatorProps> = ({
  totalTokens,
  inputTokens,
  outputTokens,
  cost,
  savings,
  currency = '$',
  showBreakdown = true,
  className = '',
}) => {
  const { theme } = useTheme();
  const styles = getStyles(theme);

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num);
  };

  const formatCurrency = (amount: number) => {
    return `${currency}${amount.toFixed(4)}`;
  };

  return (
    <div className={`wukong-cost-indicator ${className}`} style={styles.container}>
      <div style={styles.mainStat}>
        <span style={styles.icon}>🪙</span>
        <div style={styles.tokenInfo}>
          <span style={styles.totalTokens}>{formatNumber(totalTokens)} Tokens</span>
          {cost !== undefined && <span style={styles.cost}>{formatCurrency(cost)}</span>}
        </div>
      </div>

      {showBreakdown &&
        (inputTokens !== undefined || outputTokens !== undefined || savings !== undefined) && (
          <div style={styles.breakdown}>
            {(inputTokens !== undefined || outputTokens !== undefined) && (
              <div style={styles.tokenBreakdown}>
                {inputTokens !== undefined && (
                  <span style={styles.breakdownItem} title="Input Tokens">
                    In: {formatNumber(inputTokens)}
                  </span>
                )}
                {outputTokens !== undefined && (
                  <span style={styles.breakdownItem} title="Output Tokens">
                    Out: {formatNumber(outputTokens)}
                  </span>
                )}
              </div>
            )}

            {savings !== undefined && savings > 0 && (
              <div style={styles.savings} title="Estimated savings from optimizations">
                Saved: {formatCurrency(savings)}
              </div>
            )}
          </div>
        )}
    </div>
  );
};

function getStyles(theme: Theme) {
  return {
    container: {
      display: 'inline-flex',
      flexDirection: 'column' as const,
      backgroundColor: theme.colors.surface,
      borderRadius: `${theme.borderRadius.md}px`,
      border: `1px solid ${theme.colors.border}`,
      padding: `${theme.spacing.sm}px ${theme.spacing.md}px`,
      fontFamily: theme.typography.fontFamily,
    },
    mainStat: {
      display: 'flex',
      alignItems: 'center',
      gap: `${theme.spacing.sm}px`,
    },
    icon: {
      fontSize: `${theme.typography.fontSize.lg}px`,
    },
    tokenInfo: {
      display: 'flex',
      flexDirection: 'column' as const,
    },
    totalTokens: {
      fontSize: `${theme.typography.fontSize.sm}px`,
      fontWeight: theme.typography.fontWeight.bold,
      color: theme.colors.text,
    },
    cost: {
      fontSize: `${theme.typography.fontSize.xs}px`,
      color: theme.colors.textSecondary,
    },
    breakdown: {
      marginTop: `${theme.spacing.xs}px`,
      paddingTop: `${theme.spacing.xs}px`,
      borderTop: `1px solid ${theme.colors.border}`,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      fontSize: `${theme.typography.fontSize.xs}px`,
      color: theme.colors.textSecondary,
      gap: `${theme.spacing.md}px`,
    },
    tokenBreakdown: {
      display: 'flex',
      gap: `${theme.spacing.xs}px`,
    },
    breakdownItem: {
      whiteSpace: 'nowrap' as const,
    },
    savings: {
      color: theme.colors.success,
      fontWeight: theme.typography.fontWeight.medium,
    },
  };
}
