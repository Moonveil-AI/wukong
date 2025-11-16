import type React from 'react';
import { useState } from 'react';
import { useTheme } from '../theme';
import type { Theme } from '../theme/types';

export interface Capability {
  category: string;
  can: string[];
  cannot: string[];
}

export interface CapabilitiesPanelProps {
  capabilities: Capability[];
  collapsible?: boolean;
  showLimitations?: boolean;
  style?: 'card' | 'list' | 'grid';
  className?: string;
}

/**
 * CapabilitiesPanel - Display Agent's capability boundaries
 *
 * Implements Principle 1: Show what the agent can and cannot do
 */
export const CapabilitiesPanel: React.FC<CapabilitiesPanelProps> = ({
  capabilities,
  collapsible = true,
  showLimitations = true,
  style = 'card',
  className = '',
}) => {
  const [isExpanded, setIsExpanded] = useState(!collapsible);
  const { theme } = useTheme();

  const styles = getStyles(theme, style);

  return (
    <div className={`wukong-capabilities-panel ${className}`} style={styles.container}>
      {collapsible && (
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          style={styles.toggleButton}
          aria-expanded={isExpanded}
          aria-label={isExpanded ? 'Collapse capabilities' : 'Expand capabilities'}
        >
          <span style={styles.toggleIcon}>{isExpanded ? '▼' : '▶'}</span>
          <span style={styles.title}>Capabilities</span>
        </button>
      )}

      {!collapsible && <h3 style={styles.title}>Capabilities</h3>}

      {isExpanded && (
        <div style={styles.content}>
          {capabilities.map((capability) => (
            <div key={capability.category} style={styles.category}>
              <h4 style={styles.categoryTitle}>{capability.category}</h4>

              <div style={styles.section}>
                <div style={styles.sectionHeader}>
                  <span style={styles.canIcon}>✓</span>
                  <span style={styles.sectionTitle}>Can Do</span>
                </div>
                <ul style={styles.list}>
                  {capability.can.map((item) => (
                    <li key={item} style={styles.listItem}>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {showLimitations && capability.cannot.length > 0 && (
                <div style={styles.section}>
                  <div style={styles.sectionHeader}>
                    <span style={styles.cannotIcon}>✗</span>
                    <span style={styles.sectionTitle}>Cannot Do</span>
                  </div>
                  <ul style={styles.list}>
                    {capability.cannot.map((item) => (
                      <li key={item} style={styles.listItem}>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

function getStyles(theme: Theme, layoutStyle: 'card' | 'list' | 'grid') {
  const baseStyles = {
    container: {
      backgroundColor: theme.colors.surface,
      borderRadius: `${theme.borderRadius.md}px`,
      padding: `${theme.spacing.md}px`,
      marginBottom: `${theme.spacing.md}px`,
      border: `1px solid ${theme.colors.border}`,
    },
    toggleButton: {
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      padding: `${theme.spacing.sm}px`,
      border: 'none',
      background: 'none',
      cursor: 'pointer',
      fontSize: `${theme.typography.fontSize.lg}px`,
      fontWeight: theme.typography.fontWeight.medium,
      color: theme.colors.text,
      textAlign: 'left' as const,
    },
    toggleIcon: {
      marginRight: `${theme.spacing.sm}px`,
      fontSize: `${theme.typography.fontSize.sm}px`,
    },
    title: {
      margin: 0,
      fontSize: `${theme.typography.fontSize.lg}px`,
      fontWeight: theme.typography.fontWeight.medium,
      color: theme.colors.text,
    },
    content: {
      marginTop: `${theme.spacing.md}px`,
      display: layoutStyle === 'grid' ? 'grid' : 'block',
      gridTemplateColumns:
        layoutStyle === 'grid' ? 'repeat(auto-fit, minmax(300px, 1fr))' : undefined,
      gap: layoutStyle === 'grid' ? `${theme.spacing.md}px` : undefined,
    },
    category: {
      marginBottom: `${theme.spacing.lg}px`,
      padding: layoutStyle === 'card' ? `${theme.spacing.md}px` : 0,
      backgroundColor: layoutStyle === 'card' ? theme.colors.background : 'transparent',
      borderRadius: layoutStyle === 'card' ? `${theme.borderRadius.sm}px` : 0,
    },
    categoryTitle: {
      margin: 0,
      marginBottom: `${theme.spacing.md}px`,
      fontSize: `${theme.typography.fontSize.md}px`,
      fontWeight: theme.typography.fontWeight.medium,
      color: theme.colors.text,
    },
    section: {
      marginBottom: `${theme.spacing.md}px`,
    },
    sectionHeader: {
      display: 'flex',
      alignItems: 'center',
      marginBottom: `${theme.spacing.sm}px`,
    },
    sectionTitle: {
      fontSize: `${theme.typography.fontSize.sm}px`,
      fontWeight: theme.typography.fontWeight.medium,
      color: theme.colors.textSecondary,
      textTransform: 'uppercase' as const,
    },
    canIcon: {
      marginRight: `${theme.spacing.xs}px`,
      color: theme.colors.success,
      fontWeight: theme.typography.fontWeight.bold,
    },
    cannotIcon: {
      marginRight: `${theme.spacing.xs}px`,
      color: theme.colors.error,
      fontWeight: theme.typography.fontWeight.bold,
    },
    list: {
      margin: 0,
      paddingLeft: `${theme.spacing.lg}px`,
      listStyleType: 'disc',
    },
    listItem: {
      marginBottom: `${theme.spacing.xs}px`,
      color: theme.colors.text,
      fontSize: `${theme.typography.fontSize.sm}px`,
    },
  };

  return baseStyles;
}
