/**
 * TodoManager Tests
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Todo } from '../../types';
import type { LLMAdapter, StorageAdapter } from '../../types/adapters';
import { TodoManager } from '../TodoManager';

// Mock storage adapter
const createMockStorage = (): StorageAdapter => {
  const todos: Todo[] = [];

  return {
    // Session operations (not used in these tests)
    createSession: vi.fn(),
    getSession: vi.fn(),
    updateSession: vi.fn(),
    deleteSession: vi.fn(),
    listSessions: vi.fn(),

    // Step operations (not used in these tests)
    createStep: vi.fn(),
    getStep: vi.fn(),
    updateStep: vi.fn(),
    listSteps: vi.fn(),
    markStepsAsDiscarded: vi.fn(),
    getLastStep: vi.fn(),

    // Todo operations
    createTodo: vi.fn(async (todo: Omit<Todo, 'createdAt' | 'updatedAt'>) => {
      const created: Todo = {
        ...todo,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      todos.push(created);
      return created;
    }),

    getTodo: vi.fn(async (todoId: string) => {
      return todos.find((t) => t.id === todoId) || null;
    }),

    updateTodo: vi.fn(async (todoId: string, updates: Partial<Todo>) => {
      const index = todos.findIndex((t) => t.id === todoId);
      if (index === -1) {
        throw new Error('Todo not found');
      }
      todos[index] = {
        ...todos[index],
        ...updates,
        updatedAt: new Date(),
      };
      return todos[index];
    }),

    deleteTodo: vi.fn(async (todoId: string) => {
      const index = todos.findIndex((t) => t.id === todoId);
      if (index !== -1) {
        todos.splice(index, 1);
      }
    }),

    listTodos: vi.fn(async (sessionId: string) => {
      return todos.filter((t) => t.sessionId === sessionId);
    }),

    batchCreateTodos: vi.fn(async (todosToCreate: Omit<Todo, 'createdAt' | 'updatedAt'>[]) => {
      const created = todosToCreate.map((todo) => ({
        ...todo,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));
      todos.push(...created);
      return created;
    }),

    batchUpdateTodos: vi.fn(async (updates: Array<{ id: string; updates: Partial<Todo> }>) => {
      return updates.map(({ id, updates: todoUpdates }) => {
        const index = todos.findIndex((t) => t.id === id);
        if (index === -1) {
          throw new Error('Todo not found');
        }
        todos[index] = {
          ...todos[index],
          ...todoUpdates,
          updatedAt: new Date(),
        };
        return todos[index];
      });
    }),

    // Parallel tool call operations (not used in these tests)
    createParallelToolCall: vi.fn(),
    getParallelToolCall: vi.fn(),
    updateParallelToolCall: vi.fn(),
    listParallelToolCalls: vi.fn(),

    // Fork agent task operations (not used in these tests)
    createForkAgentTask: vi.fn(),
    getForkAgentTask: vi.fn(),
    updateForkAgentTask: vi.fn(),
    listForkAgentTasks: vi.fn(),

    // Checkpoint operations (not used in these tests)
    createCheckpoint: vi.fn(),
    getCheckpoint: vi.fn(),
    listCheckpoints: vi.fn(),
    deleteCheckpoint: vi.fn(),

    // Transaction support
    transaction: vi.fn(async (fn) => fn({} as any)),
  } as unknown as StorageAdapter;
};

// Mock LLM adapter
const createMockLLM = (responseText?: string): LLMAdapter => {
  const defaultResponse = `{
  "tasks": [
    {
      "title": "Read data file",
      "description": "Load the CSV file",
      "estimatedSteps": 2,
      "priority": 10,
      "dependencies": []
    },
    {
      "title": "Clean data",
      "description": "Remove invalid entries",
      "estimatedSteps": 3,
      "priority": 8,
      "dependencies": [0]
    },
    {
      "title": "Generate report",
      "description": "Create summary report",
      "estimatedSteps": 5,
      "priority": 5,
      "dependencies": [1]
    }
  ]
}`;

  return {
    call: vi.fn(async () => ({
      text: responseText || defaultResponse,
      tokensUsed: {
        prompt: 100,
        completion: 200,
        total: 300,
      },
      model: 'gpt-4',
      responseTimeMs: 1000,
      finishReason: 'stop' as const,
    })),
    callWithMessages: vi.fn(),
    callWithStreaming: vi.fn(),
    countTokens: vi.fn(async (text: string) => text.split(' ').length),
    getCapabilities: vi.fn(() => ({
      maxTokens: 4096,
      supportsStreaming: true,
      supportsFunctionCalling: true,
      supportsVision: false,
    })),
  } as unknown as LLMAdapter;
};

describe('TodoManager', () => {
  let storage: StorageAdapter;
  let llm: LLMAdapter;
  let todoManager: TodoManager;

  beforeEach(() => {
    storage = createMockStorage();
    llm = createMockLLM();
    todoManager = new TodoManager(storage, llm);
  });

  describe('generateTodos', () => {
    it('should generate todos from a goal', async () => {
      const todos = await todoManager.generateTodos({
        sessionId: 'session-1',
        goal: 'Analyze sales data',
      });

      expect(todos).toHaveLength(3);
      expect(todos[0].title).toBe('Read data file');
      expect(todos[0].description).toBe('Load the CSV file');
      expect(todos[0].estimatedSteps).toBe(2);
      expect(todos[0].status).toBe('pending');
    });

    it('should emit todos:generated event', async () => {
      const listener = vi.fn();
      todoManager.on('todos:generated', listener);

      const todos = await todoManager.generateTodos({
        sessionId: 'session-1',
        goal: 'Analyze sales data',
      });

      expect(listener).toHaveBeenCalledWith(todos);
    });

    it('should handle LLM response with code blocks', async () => {
      const llmWithCodeBlock = createMockLLM(`\`\`\`json
{
  "tasks": [
    {
      "title": "Test task",
      "description": "Test description",
      "estimatedSteps": 1,
      "priority": 5,
      "dependencies": []
    }
  ]
}
\`\`\``);

      const manager = new TodoManager(storage, llmWithCodeBlock);
      const todos = await manager.generateTodos({
        sessionId: 'session-1',
        goal: 'Test goal',
      });

      expect(todos).toHaveLength(1);
      expect(todos[0].title).toBe('Test task');
    });
  });

  describe('getTodos', () => {
    it('should get all todos for a session', async () => {
      await todoManager.generateTodos({
        sessionId: 'session-1',
        goal: 'Analyze sales data',
      });

      const todos = await todoManager.getTodos('session-1');

      expect(todos).toHaveLength(3);
      expect(todos.every((t) => t.sessionId === 'session-1')).toBe(true);
    });
  });

  describe('markStarted', () => {
    it('should mark a todo as started', async () => {
      const todos = await todoManager.generateTodos({
        sessionId: 'session-1',
        goal: 'Analyze sales data',
      });

      const updated = await todoManager.markStarted(todos[0].id);

      expect(updated.status).toBe('in_progress');
      expect(updated.startedAt).toBeDefined();
    });

    it('should emit todo:started event', async () => {
      const listener = vi.fn();
      todoManager.on('todo:started', listener);

      const todos = await todoManager.generateTodos({
        sessionId: 'session-1',
        goal: 'Analyze sales data',
      });

      await todoManager.markStarted(todos[0].id);

      expect(listener).toHaveBeenCalled();
    });

    it('should emit progress:updated event', async () => {
      const listener = vi.fn();
      todoManager.on('progress:updated', listener);

      const todos = await todoManager.generateTodos({
        sessionId: 'session-1',
        goal: 'Analyze sales data',
      });

      await todoManager.markStarted(todos[0].id);

      expect(listener).toHaveBeenCalled();
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          inProgress: 1,
        }),
      );
    });

    it('should check dependencies before starting', async () => {
      const todos = await todoManager.generateTodos({
        sessionId: 'session-1',
        goal: 'Analyze sales data',
      });

      // Try to start task 2 which depends on task 1
      await expect(todoManager.markStarted(todos[1].id)).rejects.toThrow(
        'dependencies not satisfied',
      );
    });
  });

  describe('markCompleted', () => {
    it('should mark a todo as completed', async () => {
      const todos = await todoManager.generateTodos({
        sessionId: 'session-1',
        goal: 'Analyze sales data',
      });

      await todoManager.markStarted(todos[0].id);
      const updated = await todoManager.markCompleted(todos[0].id, {
        actualSteps: 3,
        result: { success: true },
      });

      expect(updated.status).toBe('completed');
      expect(updated.completedAt).toBeDefined();
      expect(updated.actualSteps).toBe(3);
      expect(updated.result).toEqual({ success: true });
    });

    it('should emit todo:completed event', async () => {
      const listener = vi.fn();
      todoManager.on('todo:completed', listener);

      const todos = await todoManager.generateTodos({
        sessionId: 'session-1',
        goal: 'Analyze sales data',
      });

      await todoManager.markStarted(todos[0].id);
      await todoManager.markCompleted(todos[0].id);

      expect(listener).toHaveBeenCalled();
    });
  });

  describe('markFailed', () => {
    it('should mark a todo as failed', async () => {
      const todos = await todoManager.generateTodos({
        sessionId: 'session-1',
        goal: 'Analyze sales data',
      });

      await todoManager.markStarted(todos[0].id);
      const updated = await todoManager.markFailed(todos[0].id, 'File not found');

      expect(updated.status).toBe('failed');
      expect(updated.error).toBe('File not found');
      expect(updated.completedAt).toBeDefined();
    });

    it('should emit todo:failed event', async () => {
      const listener = vi.fn();
      todoManager.on('todo:failed', listener);

      const todos = await todoManager.generateTodos({
        sessionId: 'session-1',
        goal: 'Analyze sales data',
      });

      await todoManager.markStarted(todos[0].id);
      await todoManager.markFailed(todos[0].id, 'Error occurred');

      expect(listener).toHaveBeenCalled();
    });
  });

  describe('getProgress', () => {
    it('should calculate progress correctly', async () => {
      const todos = await todoManager.generateTodos({
        sessionId: 'session-1',
        goal: 'Analyze sales data',
      });

      // Mark first todo as completed
      await todoManager.markStarted(todos[0].id);
      await todoManager.markCompleted(todos[0].id);

      const progress = await todoManager.getProgress('session-1');

      expect(progress.total).toBe(3);
      expect(progress.completed).toBe(1);
      expect(progress.inProgress).toBe(0);
      expect(progress.pending).toBe(2);
      expect(progress.percentage).toBe(33); // 1/3 * 100 = 33.33 rounded
    });

    it('should calculate weighted progress based on estimated steps', async () => {
      const todos = await todoManager.generateTodos({
        sessionId: 'session-1',
        goal: 'Analyze sales data',
      });

      // Total estimated steps: 2 + 3 + 5 = 10
      // Complete first task (2 steps)
      await todoManager.markStarted(todos[0].id);
      await todoManager.markCompleted(todos[0].id);

      const progress = await todoManager.getProgress('session-1');

      expect(progress.estimatedTotalSteps).toBe(10);
      expect(progress.weightedPercentage).toBe(20); // 2/10 * 100 = 20
    });
  });

  describe('addTodo', () => {
    it('should add a new todo to a session', async () => {
      await todoManager.generateTodos({
        sessionId: 'session-1',
        goal: 'Analyze sales data',
      });

      const newTodo = await todoManager.addTodo('session-1', {
        title: 'Additional validation',
        description: 'Extra step',
        estimatedSteps: 2,
      });

      expect(newTodo.title).toBe('Additional validation');
      expect(newTodo.orderIndex).toBe(3); // After 3 existing todos

      const allTodos = await todoManager.getTodos('session-1');
      expect(allTodos).toHaveLength(4);
    });
  });

  describe('removeTodo', () => {
    it('should remove a todo', async () => {
      const todos = await todoManager.generateTodos({
        sessionId: 'session-1',
        goal: 'Analyze sales data',
      });

      await todoManager.removeTodo(todos[0].id);

      const remaining = await todoManager.getTodos('session-1');
      expect(remaining).toHaveLength(2);
      expect(remaining.find((t) => t.id === todos[0].id)).toBeUndefined();
    });
  });

  describe('reorderTodos', () => {
    it('should reorder todos', async () => {
      const todos = await todoManager.generateTodos({
        sessionId: 'session-1',
        goal: 'Analyze sales data',
      });

      // Reverse order
      const newOrder = [todos[2].id, todos[1].id, todos[0].id];
      const reordered = await todoManager.reorderTodos(newOrder);

      expect(reordered[0].id).toBe(todos[2].id);
      expect(reordered[0].orderIndex).toBe(0);
      expect(reordered[1].id).toBe(todos[1].id);
      expect(reordered[1].orderIndex).toBe(1);
      expect(reordered[2].id).toBe(todos[0].id);
      expect(reordered[2].orderIndex).toBe(2);
    });
  });

  describe('updateTodo', () => {
    it('should update a todo', async () => {
      const todos = await todoManager.generateTodos({
        sessionId: 'session-1',
        goal: 'Analyze sales data',
      });

      const updated = await todoManager.updateTodo(todos[0].id, {
        status: 'in_progress',
        actualSteps: 1,
      });

      expect(updated.status).toBe('in_progress');
      expect(updated.actualSteps).toBe(1);
    });

    it('should emit todo:updated event', async () => {
      let receivedTodo: Todo | undefined;
      let receivedUpdates: Partial<Todo> | undefined;

      todoManager.on('todo:updated', (todo, updates) => {
        receivedTodo = todo;
        receivedUpdates = updates;
      });

      const todos = await todoManager.generateTodos({
        sessionId: 'session-1',
        goal: 'Analyze sales data',
      });

      const updates = { status: 'in_progress' as const };
      await todoManager.updateTodo(todos[0].id, updates);

      expect(receivedTodo).toBeDefined();
      expect(receivedTodo?.id).toBe(todos[0].id);
      expect(receivedUpdates).toEqual(updates);
    });
  });
});
