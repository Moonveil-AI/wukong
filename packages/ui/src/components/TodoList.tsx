import type React from 'react';
import { useState } from 'react';
import { useTheme } from '../theme';
import type { Theme } from '../theme/types';

export type TodoStatus = 'pending' | 'in_progress' | 'completed' | 'blocked';

export interface Todo {
  id: string;
  title: string;
  description?: string;
  status: TodoStatus;
  progress?: number; // 0-100
  dependencies?: string[];
  subtasks?: Todo[];
}

export interface TodoListProps {
  todos: Todo[];
  groupBy?: 'status' | 'none';
  showProgress?: boolean;
  showDependencies?: boolean;
  expandable?: boolean;
  onUpdate?: (todoId: string, updates: Partial<Todo>) => void;
  onToggle?: (todoId: string) => void;
  className?: string;
}

/**
 * TodoList - Expandable checklist with progress tracking
 *
 * Implements Principles 9-10: Show task progress and dependencies
 */
export const TodoList: React.FC<TodoListProps> = ({
  todos,
  groupBy = 'none',
  showProgress = true,
  showDependencies = true,
  expandable = true,
  onUpdate,
  onToggle,
  className = '',
}) => {
  const [expandedTodos, setExpandedTodos] = useState<Set<string>>(new Set());
  const { theme } = useTheme();

  const styles = getStyles(theme);

  const toggleExpand = (todoId: string) => {
    const newExpanded = new Set(expandedTodos);
    if (newExpanded.has(todoId)) {
      newExpanded.delete(todoId);
    } else {
      newExpanded.add(todoId);
    }
    setExpandedTodos(newExpanded);
  };

  const handleStatusToggle = (todoId: string, currentStatus: TodoStatus) => {
    if (!onUpdate) return;

    const newStatus: TodoStatus = currentStatus === 'completed' ? 'pending' : 'completed';
    onUpdate(todoId, { status: newStatus });
    onToggle?.(todoId);
  };

  const calculateOverallProgress = (): number => {
    if (todos.length === 0) return 0;
    const completedCount = todos.filter((t) => t.status === 'completed').length;
    return Math.round((completedCount / todos.length) * 100);
  };

  const groupTodos = (): Record<string, Todo[]> => {
    if (groupBy === 'none') {
      return { all: todos };
    }

    const groups: Record<string, Todo[]> = {
      completed: [],
      // biome-ignore lint/style/useNamingConvention: Status names match API convention
      in_progress: [],
      pending: [],
      blocked: [],
    };

    for (const todo of todos) {
      const group = groups[todo.status];
      if (group) {
        group.push(todo);
      }
    }

    return groups;
  };

  const renderTodo = (todo: Todo, depth = 0) => {
    const isExpanded = expandedTodos.has(todo.id);
    const hasDetails = todo.description || (todo.subtasks && todo.subtasks.length > 0);
    const statusInfo = getStatusInfo(theme, todo.status);

    return (
      <div key={todo.id} style={{ ...styles.todoItem, marginLeft: `${depth * 20}px` }}>
        <div style={styles.todoHeader}>
          <button
            type="button"
            onClick={() => handleStatusToggle(todo.id, todo.status)}
            style={styles.checkbox}
            aria-label={todo.status === 'completed' ? 'Mark as incomplete' : 'Mark as complete'}
            disabled={todo.status === 'blocked'}
          >
            {todo.status === 'completed' && <span style={styles.checkmark}>✓</span>}
            {todo.status === 'in_progress' && <span style={styles.inProgress}>●</span>}
            {todo.status === 'blocked' && <span style={styles.blocked}>✕</span>}
          </button>

          <div style={styles.todoContent}>
            <div style={styles.todoTitleRow}>
              <span
                style={{
                  ...styles.todoTitle,
                  textDecoration: todo.status === 'completed' ? 'line-through' : 'none',
                  color:
                    todo.status === 'completed' ? theme.colors.textSecondary : theme.colors.text,
                }}
              >
                {todo.title}
              </span>
              <span style={{ ...styles.statusBadge, backgroundColor: statusInfo.color }}>
                {statusInfo.label}
              </span>
            </div>

            {showProgress && todo.progress !== undefined && (
              <div style={styles.progressContainer}>
                <div style={styles.progressBar}>
                  <div
                    style={{
                      ...styles.progressFill,
                      width: `${todo.progress}%`,
                      backgroundColor: theme.colors.primary,
                    }}
                  />
                </div>
                <span style={styles.progressText}>{todo.progress}%</span>
              </div>
            )}

            {showDependencies && todo.dependencies && todo.dependencies.length > 0 && (
              <div style={styles.dependencies}>
                <span style={styles.dependenciesLabel}>Depends on:</span>
                {todo.dependencies.map((depId) => {
                  const dep = todos.find((t) => t.id === depId);
                  return (
                    <span key={depId} style={styles.dependency}>
                      {dep?.title || depId}
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          {expandable && hasDetails && (
            <button
              type="button"
              onClick={() => toggleExpand(todo.id)}
              style={styles.expandButton}
              aria-expanded={isExpanded}
              aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
            >
              {isExpanded ? '▼' : '▶'}
            </button>
          )}
        </div>

        {isExpanded && hasDetails && (
          <div style={styles.todoDetails}>
            {todo.description && <p style={styles.todoDescription}>{todo.description}</p>}

            {todo.subtasks && todo.subtasks.length > 0 && (
              <div style={styles.subtasks}>
                <span style={styles.subtasksLabel}>Subtasks:</span>
                {todo.subtasks.map((subtask) => renderTodo(subtask, depth + 1))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const overallProgress = calculateOverallProgress();
  const groupedTodos = groupTodos();

  return (
    <div className={`wukong-todo-list ${className}`} style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>Tasks</h3>
        {showProgress && (
          <div style={styles.overallProgress}>
            <div style={styles.progressBar}>
              <div
                style={{
                  ...styles.progressFill,
                  width: `${overallProgress}%`,
                  backgroundColor: theme.colors.success,
                }}
              />
            </div>
            <span style={styles.progressText}>{overallProgress}%</span>
          </div>
        )}
      </div>

      <div style={styles.todosContainer}>
        {groupBy === 'status' ? (
          Object.entries(groupedTodos).map(([status, groupTodos]) => {
            if (groupTodos.length === 0) return null;
            const statusInfo = getStatusInfo(theme, status as TodoStatus);

            return (
              <div key={status} style={styles.group}>
                <h4 style={styles.groupTitle}>
                  <span style={{ ...styles.groupDot, backgroundColor: statusInfo.color }} />
                  {statusInfo.label} ({groupTodos.length})
                </h4>
                {groupTodos.map((todo) => renderTodo(todo))}
              </div>
            );
          })
        ) : (
          <>{todos.map((todo) => renderTodo(todo))}</>
        )}
      </div>
    </div>
  );
};

function getStyles(theme: Theme) {
  return {
    container: {
      backgroundColor: theme.colors.surface,
      borderRadius: `${theme.borderRadius.md}px`,
      padding: `${theme.spacing.md}px`,
      marginBottom: `${theme.spacing.md}px`,
      border: `1px solid ${theme.colors.border}`,
    },
    header: {
      marginBottom: `${theme.spacing.md}px`,
    },
    title: {
      margin: 0,
      marginBottom: `${theme.spacing.sm}px`,
      fontSize: `${theme.typography.fontSize.lg}px`,
      fontWeight: theme.typography.fontWeight.medium,
      color: theme.colors.text,
    },
    overallProgress: {
      display: 'flex',
      alignItems: 'center',
      gap: `${theme.spacing.sm}px`,
    },
    todosContainer: {
      display: 'flex',
      flexDirection: 'column' as const,
      gap: `${theme.spacing.xs}px`,
    },
    group: {
      marginBottom: `${theme.spacing.md}px`,
    },
    groupTitle: {
      display: 'flex',
      alignItems: 'center',
      gap: `${theme.spacing.xs}px`,
      margin: 0,
      marginBottom: `${theme.spacing.sm}px`,
      fontSize: `${theme.typography.fontSize.sm}px`,
      fontWeight: theme.typography.fontWeight.medium,
      color: theme.colors.textSecondary,
      textTransform: 'uppercase' as const,
    },
    groupDot: {
      width: '8px',
      height: '8px',
      borderRadius: '50%',
    },
    todoItem: {
      padding: `${theme.spacing.sm}px`,
      backgroundColor: theme.colors.background,
      borderRadius: `${theme.borderRadius.sm}px`,
      marginBottom: `${theme.spacing.xs}px`,
    },
    todoHeader: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: `${theme.spacing.sm}px`,
    },
    checkbox: {
      width: '24px',
      height: '24px',
      flexShrink: 0,
      border: `2px solid ${theme.colors.border}`,
      borderRadius: `${theme.borderRadius.sm}px`,
      backgroundColor: theme.colors.surface,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 0,
    },
    checkmark: {
      color: theme.colors.success,
      fontSize: `${theme.typography.fontSize.md}px`,
      fontWeight: theme.typography.fontWeight.bold,
    },
    inProgress: {
      color: theme.colors.primary,
      fontSize: `${theme.typography.fontSize.md}px`,
    },
    blocked: {
      color: theme.colors.error,
      fontSize: `${theme.typography.fontSize.md}px`,
    },
    todoContent: {
      flex: 1,
    },
    todoTitleRow: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: `${theme.spacing.sm}px`,
      marginBottom: `${theme.spacing.xs}px`,
    },
    todoTitle: {
      fontSize: `${theme.typography.fontSize.sm}px`,
      fontWeight: theme.typography.fontWeight.medium,
      flex: 1,
    },
    statusBadge: {
      fontSize: `${theme.typography.fontSize.xs}px`,
      fontWeight: theme.typography.fontWeight.bold,
      color: '#ffffff',
      padding: '2px 6px',
      borderRadius: `${theme.borderRadius.sm}px`,
      textTransform: 'uppercase' as const,
    },
    progressContainer: {
      display: 'flex',
      alignItems: 'center',
      gap: `${theme.spacing.sm}px`,
      marginTop: `${theme.spacing.xs}px`,
    },
    progressBar: {
      flex: 1,
      height: '8px',
      backgroundColor: theme.colors.surface,
      borderRadius: `${theme.borderRadius.sm}px`,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      transition: 'width 0.3s ease',
    },
    progressText: {
      fontSize: `${theme.typography.fontSize.xs}px`,
      color: theme.colors.textSecondary,
      minWidth: '40px',
      textAlign: 'right' as const,
    },
    dependencies: {
      display: 'flex',
      flexWrap: 'wrap' as const,
      gap: `${theme.spacing.xs}px`,
      marginTop: `${theme.spacing.xs}px`,
      fontSize: `${theme.typography.fontSize.xs}px`,
    },
    dependenciesLabel: {
      color: theme.colors.textSecondary,
    },
    dependency: {
      padding: '2px 6px',
      backgroundColor: theme.colors.surface,
      borderRadius: `${theme.borderRadius.sm}px`,
      border: `1px solid ${theme.colors.border}`,
      color: theme.colors.text,
    },
    expandButton: {
      padding: `${theme.spacing.xs}px`,
      border: 'none',
      background: 'none',
      cursor: 'pointer',
      fontSize: `${theme.typography.fontSize.xs}px`,
      color: theme.colors.textSecondary,
      flexShrink: 0,
    },
    todoDetails: {
      marginTop: `${theme.spacing.sm}px`,
      marginLeft: '32px',
      paddingLeft: `${theme.spacing.sm}px`,
      borderLeft: `2px solid ${theme.colors.border}`,
    },
    todoDescription: {
      margin: 0,
      fontSize: `${theme.typography.fontSize.sm}px`,
      color: theme.colors.textSecondary,
      lineHeight: 1.5,
    },
    subtasks: {
      marginTop: `${theme.spacing.sm}px`,
    },
    subtasksLabel: {
      display: 'block',
      fontSize: `${theme.typography.fontSize.xs}px`,
      fontWeight: theme.typography.fontWeight.bold,
      color: theme.colors.textSecondary,
      textTransform: 'uppercase' as const,
      marginBottom: `${theme.spacing.xs}px`,
    },
  };
}

function getStatusInfo(theme: Theme, status: TodoStatus) {
  const statusMap = {
    completed: { label: 'Completed', color: theme.colors.success },
    // biome-ignore lint/style/useNamingConvention: Status names match API convention
    in_progress: { label: 'In Progress', color: theme.colors.primary },
    pending: { label: 'Pending', color: theme.colors.textSecondary },
    blocked: { label: 'Blocked', color: theme.colors.error },
  };

  return statusMap[status];
}
