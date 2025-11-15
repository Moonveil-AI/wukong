/**
 * Todo Manager
 *
 * Manages task decomposition, progress tracking, and dynamic todo updates for agent sessions.
 *
 * Features:
 * - Generate todos from goal using LLM
 * - Track progress across multiple todos
 * - Update todo status and results
 * - Handle dependencies between todos
 * - Calculate weighted progress
 * - Dynamic todo list adjustments
 */

import EventEmitter3 from 'eventemitter3';
import type { Todo, TodoStatus } from '../types';
import type { LLMAdapter } from '../types/adapters';
import type { StorageAdapter } from '../types/adapters';

/**
 * Todo generation options
 */
export interface TodoGenerationOptions {
  /** Session ID */
  sessionId: string;

  /** User's goal */
  goal: string;

  /** Maximum number of todos to generate */
  maxTodos?: number;

  /** Additional context for generation */
  context?: string;
}

/**
 * Todo update options
 */
export interface TodoUpdateOptions {
  /** New status */
  status?: TodoStatus;

  /** Result data */
  result?: Record<string, any>;

  /** Error message */
  error?: string;

  /** Actual steps taken */
  actualSteps?: number;

  /** Actual tokens used */
  actualTokens?: number;

  /** Duration in seconds */
  durationSeconds?: number;
}

/**
 * Progress information
 */
export interface ProgressInfo {
  /** Total todos */
  total: number;

  /** Completed todos */
  completed: number;

  /** In progress todos */
  inProgress: number;

  /** Failed todos */
  failed: number;

  /** Pending todos */
  pending: number;

  /** Simple progress (0-100) */
  percentage: number;

  /** Weighted progress based on estimated steps (0-100) */
  weightedPercentage: number;

  /** Estimated total steps */
  estimatedTotalSteps: number;

  /** Actual steps taken */
  actualSteps: number;
}

/**
 * Generated todo item
 */
interface GeneratedTodo {
  title: string;
  description?: string;
  estimatedSteps?: number;
  priority?: number;
  dependencies?: string[];
}

/**
 * Todo Manager Events
 */
export interface TodoManagerEvents {
  'todos:generated': (todos: Todo[]) => void;
  'todo:started': (todo: Todo) => void;
  'todo:completed': (todo: Todo) => void;
  'todo:failed': (todo: Todo) => void;
  'todo:updated': (todo: Todo, changes: Partial<Todo>) => void;
  'progress:updated': (progress: ProgressInfo) => void;
}

/**
 * Todo Manager
 *
 * Manages task decomposition and progress tracking for agent sessions.
 */
export class TodoManager {
  private readonly storage: StorageAdapter;
  private readonly llm: LLMAdapter;
  private readonly eventEmitter: EventEmitter3;

  constructor(storage: StorageAdapter, llm: LLMAdapter) {
    this.storage = storage;
    this.llm = llm;
    this.eventEmitter = new EventEmitter3();
  }

  /**
   * Register an event listener
   */
  on<K extends keyof TodoManagerEvents>(event: K, listener: TodoManagerEvents[K]): void {
    this.eventEmitter.on(event, listener as any);
  }

  /**
   * Register a one-time event listener
   */
  once<K extends keyof TodoManagerEvents>(event: K, listener: TodoManagerEvents[K]): void {
    this.eventEmitter.once(event, listener as any);
  }

  /**
   * Remove an event listener
   */
  off<K extends keyof TodoManagerEvents>(event: K, listener: TodoManagerEvents[K]): void {
    this.eventEmitter.off(event, listener as any);
  }

  /**
   * Emit an event
   */
  private emit<K extends keyof TodoManagerEvents>(event: K, ...args: any[]): void {
    this.eventEmitter.emit(event, ...args);
  }

  /**
   * Generate todos from a goal using LLM
   */
  async generateTodos(options: TodoGenerationOptions): Promise<Todo[]> {
    const { sessionId, goal, maxTodos = 10, context } = options;

    // Build prompt for LLM
    const prompt = this.buildGenerationPrompt(goal, maxTodos, context);

    // Call LLM to generate todos
    const response = await this.llm.call(prompt, {
      model: 'gpt-4',
      temperature: 0.3,
      maxTokens: 2000,
    });

    // Extract JSON from response
    const generatedTodos = this.parseGeneratedTodos(response.text);

    // Create todos in storage
    const todos: Omit<Todo, 'createdAt' | 'updatedAt'>[] = generatedTodos.map((todo, index) => ({
      id: `${sessionId}-todo-${Date.now()}-${index}`,
      sessionId,
      title: todo.title,
      description: todo.description,
      orderIndex: index,
      status: 'pending' as TodoStatus,
      dependencies: todo.dependencies || [],
      priority: todo.priority || 0,
      estimatedSteps: todo.estimatedSteps || 1,
      actualSteps: 0,
      actualTokens: 0,
    }));

    // Batch create todos
    const createdTodos = await this.storage.batchCreateTodos(todos);

    // Emit event
    this.emit('todos:generated', createdTodos);

    return createdTodos;
  }

  /**
   * Get all todos for a session
   */
  getTodos(sessionId: string): Promise<Todo[]> {
    return this.storage.listTodos(sessionId);
  }

  /**
   * Get a single todo by ID
   */
  getTodo(todoId: string): Promise<Todo | null> {
    return this.storage.getTodo(todoId);
  }

  /**
   * Mark a todo as started
   */
  async markStarted(todoId: string): Promise<Todo> {
    const todo = await this.storage.getTodo(todoId);
    if (!todo) {
      throw new Error(`Todo ${todoId} not found`);
    }

    // Check if dependencies are satisfied
    if (todo.dependencies && todo.dependencies.length > 0) {
      const satisfied = await this.areDependenciesSatisfied(todo);
      if (!satisfied) {
        throw new Error(`Cannot start todo ${todoId}: dependencies not satisfied`);
      }
    }

    const updated = await this.storage.updateTodo(todoId, {
      status: 'in_progress',
      startedAt: new Date(),
    });

    this.emit('todo:started', updated);

    // Update progress
    await this.emitProgress(todo.sessionId);

    return updated;
  }

  /**
   * Mark a todo as completed
   */
  async markCompleted(
    todoId: string,
    options?: {
      result?: Record<string, any>;
      actualSteps?: number;
      actualTokens?: number;
    },
  ): Promise<Todo> {
    const todo = await this.storage.getTodo(todoId);
    if (!todo) {
      throw new Error(`Todo ${todoId} not found`);
    }

    const now = new Date();
    const durationSeconds = todo.startedAt
      ? Math.floor((now.getTime() - todo.startedAt.getTime()) / 1000)
      : undefined;

    const updated = await this.storage.updateTodo(todoId, {
      status: 'completed',
      completedAt: now,
      durationSeconds,
      result: options?.result,
      actualSteps: options?.actualSteps,
      actualTokens: options?.actualTokens,
    });

    this.emit('todo:completed', updated);

    // Update progress
    await this.emitProgress(todo.sessionId);

    return updated;
  }

  /**
   * Mark a todo as failed
   */
  async markFailed(todoId: string, error: string): Promise<Todo> {
    const todo = await this.storage.getTodo(todoId);
    if (!todo) {
      throw new Error(`Todo ${todoId} not found`);
    }

    const now = new Date();
    const durationSeconds = todo.startedAt
      ? Math.floor((now.getTime() - todo.startedAt.getTime()) / 1000)
      : undefined;

    const updated = await this.storage.updateTodo(todoId, {
      status: 'failed',
      completedAt: now,
      durationSeconds,
      error,
    });

    this.emit('todo:failed', updated);

    // Update progress
    await this.emitProgress(todo.sessionId);

    return updated;
  }

  /**
   * Update a todo with partial changes
   */
  async updateTodo(todoId: string, updates: TodoUpdateOptions): Promise<Todo> {
    const todo = await this.storage.getTodo(todoId);
    if (!todo) {
      throw new Error(`Todo ${todoId} not found`);
    }

    const updated = await this.storage.updateTodo(todoId, updates);

    this.emit('todo:updated', updated, updates);

    // Update progress if status changed
    if (updates.status) {
      await this.emitProgress(todo.sessionId);
    }

    return updated;
  }

  /**
   * Add a new todo to an existing session
   */
  async addTodo(
    sessionId: string,
    todo: {
      title: string;
      description?: string;
      dependencies?: string[];
      priority?: number;
      estimatedSteps?: number;
    },
  ): Promise<Todo> {
    // Get existing todos to determine order index
    const existingTodos = await this.storage.listTodos(sessionId);
    const maxOrderIndex = existingTodos.reduce((max, t) => Math.max(max, t.orderIndex), -1);

    const newTodo: Omit<Todo, 'createdAt' | 'updatedAt'> = {
      id: `${sessionId}-todo-${Date.now()}`,
      sessionId,
      title: todo.title,
      description: todo.description,
      orderIndex: maxOrderIndex + 1,
      status: 'pending',
      dependencies: todo.dependencies || [],
      priority: todo.priority || 0,
      estimatedSteps: todo.estimatedSteps || 1,
      actualSteps: 0,
      actualTokens: 0,
    };

    const created = await this.storage.createTodo(newTodo);

    // Update progress
    await this.emitProgress(sessionId);

    return created;
  }

  /**
   * Remove a todo
   */
  async removeTodo(todoId: string): Promise<void> {
    const todo = await this.storage.getTodo(todoId);
    if (!todo) {
      throw new Error(`Todo ${todoId} not found`);
    }

    const sessionId = todo.sessionId;

    await this.storage.deleteTodo(todoId);

    // Update progress
    await this.emitProgress(sessionId);
  }

  /**
   * Reorder todos
   */
  async reorderTodos(todoIds: string[]): Promise<Todo[]> {
    // Get first todo to determine session
    if (todoIds.length === 0) {
      return [];
    }

    const firstTodoId = todoIds[0];
    if (!firstTodoId) {
      return [];
    }

    const firstTodo = await this.storage.getTodo(firstTodoId);
    if (!firstTodo) {
      throw new Error(`Todo ${firstTodoId} not found`);
    }

    // Update order indexes
    const updates = todoIds.map((id, index) => ({
      id,
      updates: { orderIndex: index },
    }));

    const updated = await this.storage.batchUpdateTodos(updates);

    return updated;
  }

  /**
   * Get progress information for a session
   */
  async getProgress(sessionId: string): Promise<ProgressInfo> {
    const todos = await this.storage.listTodos(sessionId);

    return this.calculateProgress(todos);
  }

  /**
   * Check if a todo's dependencies are satisfied
   */
  private async areDependenciesSatisfied(todo: Todo): Promise<boolean> {
    if (!todo.dependencies || todo.dependencies.length === 0) {
      return true;
    }

    // Get all dependency todos
    const dependencyTodos = await Promise.all(
      todo.dependencies.map((depId) => this.storage.getTodo(depId)),
    );

    // Check if all dependencies are completed
    return dependencyTodos.every((dep) => dep && dep.status === 'completed');
  }

  /**
   * Calculate progress from todos
   */
  private calculateProgress(todos: Todo[]): ProgressInfo {
    const total = todos.length;
    const completed = todos.filter((t) => t.status === 'completed').length;
    const inProgress = todos.filter((t) => t.status === 'in_progress').length;
    const failed = todos.filter((t) => t.status === 'failed').length;
    const pending = todos.filter((t) => t.status === 'pending').length;

    // Simple percentage
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Weighted percentage based on estimated steps
    const estimatedTotalSteps = todos.reduce((sum, t) => sum + (t.estimatedSteps || 1), 0);
    const completedSteps = todos
      .filter((t) => t.status === 'completed')
      .reduce((sum, t) => sum + (t.estimatedSteps || 1), 0);
    const weightedPercentage =
      estimatedTotalSteps > 0 ? Math.round((completedSteps / estimatedTotalSteps) * 100) : 0;

    // Actual steps taken
    const actualSteps = todos.reduce((sum, t) => sum + t.actualSteps, 0);

    return {
      total,
      completed,
      inProgress,
      failed,
      pending,
      percentage,
      weightedPercentage,
      estimatedTotalSteps,
      actualSteps,
    };
  }

  /**
   * Emit progress update event
   */
  private async emitProgress(sessionId: string): Promise<void> {
    const progress = await this.getProgress(sessionId);
    this.emit('progress:updated', progress);
  }

  /**
   * Build prompt for generating todos
   */
  private buildGenerationPrompt(goal: string, maxTodos: number, context?: string): string {
    return `You are an expert task planner. Given a user's goal, break it down into a clear, actionable task list.

USER'S GOAL:
${goal}

${context ? `CONTEXT:\n${context}\n` : ''}

Generate a task list with ${maxTodos} or fewer tasks. Each task should:
- Have a clear, descriptive title
- Include a brief description
- Have an estimated number of steps (1-10)
- Have a priority (0-10, higher = more important)
- List dependencies (using task indices, 0-based)

Return ONLY valid JSON in this exact format:
{
  "tasks": [
    {
      "title": "Task title",
      "description": "Brief description",
      "estimatedSteps": 3,
      "priority": 5,
      "dependencies": []
    }
  ]
}

Guidelines:
- Break down complex tasks into smaller, manageable ones
- Order tasks logically
- Use dependencies to show task relationships
- Keep tasks at an appropriate granularity (not too broad, not too fine)
- Estimate steps realistically

Return ONLY the JSON, no other text.`;
  }

  /**
   * Parse generated todos from LLM response
   */
  private parseGeneratedTodos(responseText: string): GeneratedTodo[] {
    try {
      // Try to extract JSON from response
      let jsonText = responseText.trim();

      // Remove markdown code blocks if present
      const codeBlockMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (codeBlockMatch?.[1]) {
        jsonText = codeBlockMatch[1].trim();
      }

      // Remove XML-style tags if present
      const xmlMatch = jsonText.match(/<json>([\s\S]*?)<\/json>/i);
      if (xmlMatch?.[1]) {
        jsonText = xmlMatch[1].trim();
      }

      // Parse JSON
      const parsed = JSON.parse(jsonText);

      // Validate structure
      if (!(parsed.tasks && Array.isArray(parsed.tasks))) {
        throw new Error('Invalid response: missing tasks array');
      }

      // Validate each task
      return parsed.tasks.map((task: any) => {
        if (!task.title) {
          throw new Error('Invalid task: missing title');
        }

        return {
          title: task.title,
          description: task.description,
          estimatedSteps: task.estimatedSteps || 1,
          priority: task.priority || 0,
          dependencies: task.dependencies || [],
        };
      });
    } catch (error) {
      throw new Error(
        `Failed to parse generated todos: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}
