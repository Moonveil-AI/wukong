import type React from 'react';
import { useMemo, useState } from 'react';
import { useTheme } from '../theme';
import type { Theme } from '../theme/types';

export interface Skill {
  id: string;
  name: string;
  description: string;
  category: string;
  tags?: string[];
}

export interface SkillsTreeProps {
  skills: Skill[];
  view?: 'tree' | 'grid' | 'list';
  searchable?: boolean;
  onSkillClick?: (skill: Skill) => void;
  className?: string;
}

/**
 * SkillsTree - Display available skills in tree or grid view
 *
 * Implements Principle 2: Show what skills are available
 */
export const SkillsTree: React.FC<SkillsTreeProps> = ({
  skills,
  view = 'grid',
  searchable = true,
  onSkillClick,
  className = '',
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const { theme } = useTheme();

  const styles = getStyles(theme, view);

  // Group skills by category
  const skillsByCategory = useMemo(() => {
    const grouped: Record<string, Skill[]> = {};
    for (const skill of skills) {
      if (!grouped[skill.category]) {
        grouped[skill.category] = [];
      }
      const categoryArray = grouped[skill.category];
      if (categoryArray) {
        categoryArray.push(skill);
      }
    }
    return grouped;
  }, [skills]);

  // Filter skills based on search
  const filteredSkills = useMemo(() => {
    if (!searchTerm) return skills;
    const term = searchTerm.toLowerCase();
    return skills.filter(
      (skill) =>
        skill.name.toLowerCase().includes(term) ||
        skill.description.toLowerCase().includes(term) ||
        skill.tags?.some((tag) => tag.toLowerCase().includes(term)),
    );
  }, [skills, searchTerm]);

  // Get filtered skills by category
  const filteredByCategory = useMemo(() => {
    const grouped: Record<string, Skill[]> = {};
    for (const skill of filteredSkills) {
      if (!grouped[skill.category]) {
        grouped[skill.category] = [];
      }
      const categoryArray = grouped[skill.category];
      if (categoryArray) {
        categoryArray.push(skill);
      }
    }
    return grouped;
  }, [filteredSkills]);

  const categories = Object.keys(skillsByCategory);
  const displayCategories = selectedCategory ? [selectedCategory] : Object.keys(filteredByCategory);

  return (
    <div className={`wukong-skills-tree ${className}`} style={styles.container}>
      <h3 style={styles.title}>Available Skills</h3>

      {searchable && (
        <div style={styles.searchContainer}>
          <input
            type="text"
            placeholder="Search skills..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={styles.searchInput}
            aria-label="Search skills"
          />
        </div>
      )}

      {view === 'tree' && (
        <div style={styles.categoryFilter}>
          <button
            type="button"
            onClick={() => setSelectedCategory(null)}
            style={{
              ...styles.categoryButton,
              ...(selectedCategory === null ? styles.categoryButtonActive : {}),
            }}
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
            >
              {category}
            </button>
          ))}
        </div>
      )}

      <div style={styles.skillsContainer}>
        {displayCategories.map((category) => {
          const categorySkills = filteredByCategory[category];
          if (!categorySkills || categorySkills.length === 0) return null;

          return (
            <div key={category} style={styles.categorySection}>
              <h4 style={styles.categoryTitle}>{category}</h4>
              <div style={styles.skillsGrid}>
                {categorySkills.map((skill) => (
                  <div
                    key={skill.id}
                    style={styles.skillCard}
                    onClick={() => onSkillClick?.(skill)}
                    role={onSkillClick ? 'button' : undefined}
                    tabIndex={onSkillClick ? 0 : undefined}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && onSkillClick) {
                        onSkillClick(skill);
                      }
                    }}
                  >
                    <div style={styles.skillName}>{skill.name}</div>
                    <div style={styles.skillDescription}>{skill.description}</div>
                    {skill.tags && skill.tags.length > 0 && (
                      <div style={styles.tagsContainer}>
                        {skill.tags.map((tag) => (
                          <span key={tag} style={styles.tag}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {filteredSkills.length === 0 && (
        <div style={styles.emptyState}>No skills found matching "{searchTerm}"</div>
      )}
    </div>
  );
};

function getStyles(theme: Theme, view: 'tree' | 'grid' | 'list') {
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
    searchContainer: {
      marginBottom: `${theme.spacing.md}px`,
    },
    searchInput: {
      width: '100%',
      padding: `${theme.spacing.sm}px ${theme.spacing.md}px`,
      fontSize: `${theme.typography.fontSize.md}px`,
      border: `1px solid ${theme.colors.border}`,
      borderRadius: `${theme.borderRadius.sm}px`,
      backgroundColor: theme.colors.background,
      color: theme.colors.text,
      outline: 'none',
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
    skillsContainer: {
      display: 'flex',
      flexDirection: 'column' as const,
      gap: `${theme.spacing.lg}px`,
    },
    categorySection: {
      marginBottom: `${theme.spacing.md}px`,
    },
    categoryTitle: {
      margin: 0,
      marginBottom: `${theme.spacing.md}px`,
      fontSize: `${theme.typography.fontSize.md}px`,
      fontWeight: theme.typography.fontWeight.medium,
      color: theme.colors.text,
    },
    skillsGrid: {
      display: view === 'list' ? 'flex' : 'grid',
      flexDirection: view === 'list' ? ('column' as const) : undefined,
      gridTemplateColumns: view === 'grid' ? 'repeat(auto-fill, minmax(250px, 1fr))' : undefined,
      gap: `${theme.spacing.md}px`,
    },
    skillCard: {
      padding: `${theme.spacing.md}px`,
      backgroundColor: theme.colors.background,
      borderRadius: `${theme.borderRadius.sm}px`,
      border: `1px solid ${theme.colors.border}`,
      cursor: 'pointer',
      transition: 'all 0.2s',
    },
    skillName: {
      fontSize: `${theme.typography.fontSize.md}px`,
      fontWeight: theme.typography.fontWeight.medium,
      color: theme.colors.text,
      marginBottom: `${theme.spacing.xs}px`,
    },
    skillDescription: {
      fontSize: `${theme.typography.fontSize.sm}px`,
      color: theme.colors.textSecondary,
      marginBottom: `${theme.spacing.sm}px`,
    },
    tagsContainer: {
      display: 'flex',
      flexWrap: 'wrap' as const,
      gap: `${theme.spacing.xs}px`,
    },
    tag: {
      padding: `${theme.spacing.xs / 2}px ${theme.spacing.xs}px`,
      fontSize: `${theme.typography.fontSize.xs}px`,
      backgroundColor: theme.colors.surface,
      color: theme.colors.textSecondary,
      borderRadius: `${theme.borderRadius.sm}px`,
      border: `1px solid ${theme.colors.border}`,
    },
    emptyState: {
      textAlign: 'center' as const,
      padding: `${theme.spacing.xl}px`,
      color: theme.colors.textSecondary,
      fontSize: `${theme.typography.fontSize.md}px`,
    },
  };
}
