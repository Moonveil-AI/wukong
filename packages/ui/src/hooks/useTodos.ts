import type { Todo, WukongAgent } from '@wukong/agent';
import { useEffect, useState } from 'react';

export function useTodos(agent: WukongAgent | null) {
  const [todos, setTodos] = useState<Todo[]>([]);

  useEffect(() => {
    if (!agent) return;

    const handleTodosGenerated = (data: any) => {
      setTodos(data.todos);
    };

    const handleTodoStarted = (data: any) => {
      setTodos((prev) =>
        prev.map((t) => (t.id === data.todo.id ? { ...t, status: 'in_progress' } : t)),
      );
    };

    const handleTodoCompleted = (data: any) => {
      setTodos((prev) =>
        prev.map((t) => (t.id === data.todo.id ? { ...t, status: 'completed' } : t)),
      );
    };

    const handleTodoFailed = (data: any) => {
      setTodos((prev) =>
        prev.map((t) =>
          t.id === data.todo.id ? { ...t, status: 'failed', error: data.error } : t,
        ),
      );
    };

    const handleTodosUpdated = (data: any) => {
      setTodos((prev) => {
        const newTodos = [...prev];
        for (const change of data.changes) {
          const todoIndex = newTodos.findIndex((t: Todo) => t.id === change.todoId);
          if (todoIndex !== -1) {
            newTodos[todoIndex] = {
              ...newTodos[todoIndex],
              [change.field]: change.newValue,
            } as Todo;
          }
        }
        return newTodos;
      });
    };

    agent.on('todos:generated', handleTodosGenerated);
    agent.on('todo:started', handleTodoStarted);
    agent.on('todo:completed', handleTodoCompleted);
    agent.on('todo:failed', handleTodoFailed);
    agent.on('todos:updated', handleTodosUpdated);

    return () => {
      agent.off('todos:generated', handleTodosGenerated);
      agent.off('todo:started', handleTodoStarted);
      agent.off('todo:completed', handleTodoCompleted);
      agent.off('todo:failed', handleTodoFailed);
      agent.off('todos:updated', handleTodosUpdated);
    };
  }, [agent]);

  // Manually update todo (if needed by UI, e.g. for local optimistic updates or if agent supports it)
  const updateTodo = (todoId: string, updates: Partial<Todo>) => {
    setTodos((prev) => prev.map((t) => (t.id === todoId ? { ...t, ...updates } : t)));
  };

  return {
    todos,
    updateTodo,
  };
}
