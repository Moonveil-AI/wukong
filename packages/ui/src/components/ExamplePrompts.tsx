import type React from 'react';
import { useState } from 'react';
import { useTheme } from '../theme';
import type { Theme } from '../theme/types';

export interface ExamplePrompt {
  id: string;
  title: string;
  description?: string;
  prompt: string;
  category?: string;
  icon?: string;
}

export interface ExamplePromptsProps {
  examples: ExamplePrompt[];
  onSelect: (prompt: string) => void;
  grouped?: boolean;
  layout?: 'list' | 'grid' | 'compact';
  className?: string;
}

/**
 * ExamplePrompts - Display example commands users can try
 *
 * Implements Principle 3: Show example commands to guide users
 */
export const ExamplePrompts: React.FC<ExamplePromptsProps> = ({
  examples,
  onSelect,
  grouped = true,
  layout = 'grid',
  className = '',
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const { theme } = useTheme();

  const styles = getStyles(theme, layout);

  // Group examples by category
  const examplesByCategory = examples.reduce(
    (acc, example) => {
      const category = example.category || 'General';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(example);
      return acc;
    },
    {} as Record<string, ExamplePrompt[]>,
  );

  const categories = Object.keys(examplesByCategory);
  const displayExamples = selectedCategory ? examplesByCategory[selectedCategory] || [] : examples;

  const handleExampleClick = (example: ExamplePrompt) => {
    onSelect(example.prompt);
  };

  return (
    <div className={`wukong-example-prompts ${className}`} style={styles.container}>
      <h3 style={styles.title}>Try These Examples</h3>

      {grouped && categories.length > 1 && (
        <div style={styles.categoryFilter}>
          <button
            type="button"
            onClick={() => setSelectedCategory(null)}
            style={{
              ...styles.categoryButton,
              ...(selectedCategory === null ? styles.categoryButtonActive : {}),
            }}
            aria-pressed={selectedCategory === null}
          >
            All
          </button>
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => setSelectedCategory(category)}
              style={{
                ...styles.categoryButton,
                ...(selectedCategory === category ? styles.categoryButtonActive : {}),
              }}
              aria-pressed={selectedCategory === category}
            >
              {category}
            </button>
          ))}
        </div>
      )}

      {grouped && selectedCategory === null ? (
        // Show grouped view
        Object.entries(examplesByCategory).map(([category, categoryExamples]) => (
          <div key={category} style={styles.categorySection}>
            <h4 style={styles.categoryTitle}>{category}</h4>
            <div style={styles.examplesGrid}>
              {categoryExamples.map((example) => (
                <ExampleCard
                  key={example.id}
                  example={example}
                  onClick={() => handleExampleClick(example)}
                  styles={styles}
                />
              ))}
            </div>
          </div>
        ))
      ) : (
        // Show flat view
        <div style={styles.examplesGrid}>
          {displayExamples.map((example) => (
            <ExampleCard
              key={example.id}
              example={example}
              onClick={() => handleExampleClick(example)}
              styles={styles}
            />
          ))}
        </div>
      )}

      {displayExamples.length === 0 && <div style={styles.emptyState}>No examples available</div>}
    </div>
  );
};

interface ExampleCardProps {
  example: ExamplePrompt;
  onClick: () => void;
  styles: ReturnType<typeof getStyles>;
}

const ExampleCard: React.FC<ExampleCardProps> = ({ example, onClick, styles }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      style={styles.exampleCard}
      aria-label={`Try example: ${example.title}`}
    >
      {example.icon && <span style={styles.exampleIcon}>{example.icon}</span>}
      <div style={styles.exampleContent}>
        <div style={styles.exampleTitle}>{example.title}</div>
        {example.description && <div style={styles.exampleDescription}>{example.description}</div>}
        <div style={styles.examplePrompt}>{example.prompt}</div>
      </div>
    </button>
  );
};

function getStyles(theme: Theme, layout: 'list' | 'grid' | 'compact') {
  const isCompact = layout === 'compact';
  const isList = layout === 'list';

  return {
    container: {
      backgroundColor: theme.colors.surface,
      borderRadius: `${theme.borderRadius.md}px`,
      padding: `${theme.spacing.md}px`,
      marginBottom: `${theme.spacing.md}px`,
      border: `1px solid ${theme.colors.border}`,
    },
    title: {
      margin: 0,
      marginBottom: `${theme.spacing.md}px`,
      fontSize: `${theme.typography.fontSize.lg}px`,
      fontWeight: theme.typography.fontWeight.medium,
      color: theme.colors.text,
    },
    categoryFilter: {
      display: 'flex',
      flexWrap: 'wrap' as const,
      gap: `${theme.spacing.sm}px`,
      marginBottom: `${theme.spacing.md}px`,
    },
    categoryButton: {
      padding: `${theme.spacing.xs}px ${theme.spacing.md}px`,
      border: `1px solid ${theme.colors.border}`,
      borderRadius: `${theme.borderRadius.sm}px`,
      backgroundColor: theme.colors.background,
      color: theme.colors.textSecondary,
      cursor: 'pointer',
      fontSize: `${theme.typography.fontSize.sm}px`,
      transition: 'all 0.2s',
    },
    categoryButtonActive: {
      backgroundColor: theme.colors.primary,
      color: '#ffffff',
      borderColor: theme.colors.primary,
    },
    categorySection: {
      marginBottom: `${theme.spacing.lg}px`,
    },
    categoryTitle: {
      margin: 0,
      marginBottom: `${theme.spacing.md}px`,
      fontSize: `${theme.typography.fontSize.md}px`,
      fontWeight: theme.typography.fontWeight.medium,
      color: theme.colors.text,
    },
    examplesGrid: {
      display: isList ? 'flex' : 'grid',
      flexDirection: isList ? ('column' as const) : undefined,
      gridTemplateColumns: isCompact
        ? 'repeat(auto-fill, minmax(160px, 1fr))'
        : 'repeat(auto-fill, minmax(240px, 1fr))',
      gap: `${theme.spacing.md}px`,
    },
    exampleCard: {
      display: 'flex',
      alignItems: isCompact ? 'center' : 'flex-start',
      gap: `${theme.spacing.sm}px`,
      padding: `${theme.spacing.md}px`,
      backgroundColor: theme.colors.background,
      borderRadius: `${theme.borderRadius.sm}px`,
      border: `1px solid ${theme.colors.border}`,
      cursor: 'pointer',
      transition: 'all 0.2s',
      textAlign: 'left' as const,
      width: '100%',
    },
    exampleIcon: {
      fontSize: `${theme.typography.fontSize.xl}px`,
      flexShrink: 0,
    },
    exampleContent: {
      flex: 1,
      minWidth: 0,
    },
    exampleTitle: {
      fontSize: `${theme.typography.fontSize.md}px`,
      fontWeight: theme.typography.fontWeight.medium,
      color: theme.colors.text,
      marginBottom: `${theme.spacing.xs}px`,
    },
    exampleDescription: {
      fontSize: `${theme.typography.fontSize.sm}px`,
      color: theme.colors.textSecondary,
      marginBottom: `${theme.spacing.xs}px`,
    },
    examplePrompt: {
      fontSize: `${theme.typography.fontSize.sm}px`,
      color: theme.colors.primary,
      fontStyle: 'italic' as const,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: isCompact ? ('nowrap' as const) : ('normal' as const),
    },
    emptyState: {
      textAlign: 'center' as const,
      padding: `${theme.spacing.xl}px`,
      color: theme.colors.textSecondary,
      fontSize: `${theme.typography.fontSize.md}px`,
    },
  };
}
