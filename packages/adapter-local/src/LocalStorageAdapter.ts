/**
 * Local Storage Adapter
 *
 * Uses better-sqlite3 for local SQLite database storage
 */

import { randomUUID } from 'node:crypto';
import type {
  Checkpoint,
  ForkAgentTask,
  ParallelToolCall,
  Session,
  Step,
  StorageAdapter,
  Todo,
} from '@wukong/agent';
import Database from 'better-sqlite3';

export interface LocalStorageAdapterConfig {
  /**
   * Path to SQLite database file
   * Use ':memory:' for in-memory database
   */
  dbPath: string;

  /**
   * Enable WAL mode for better concurrency
   * @default true
   */
  enableWAL?: boolean;

  /**
   * Enable verbose mode for debugging
   * @default false
   */
  verbose?: boolean;
}

export class LocalStorageAdapter implements StorageAdapter {
  private db: Database.Database;

  constructor(config: LocalStorageAdapterConfig) {
    this.db = new Database(config.dbPath, {
      verbose: config.verbose ? console.log : undefined,
    });

    // Enable WAL mode for better concurrency
    if (config.enableWAL !== false && config.dbPath !== ':memory:') {
      this.db.pragma('journal_mode = WAL');
    }

    // Enable foreign keys
    this.db.pragma('foreign_keys = ON');

    // Set reasonable defaults
    this.db.pragma('busy_timeout = 5000');
  }

  // ==========================================
  // Session Operations
  // ==========================================

  async createSession(session: Omit<Session, 'id' | 'createdAt' | 'updatedAt'>): Promise<Session> {
    const id = this.generateId('session');
    const now = new Date();

    const stmt = this.db.prepare(`
      INSERT INTO sessions (
        id, goal, initial_goal, status, user_id, api_key, organization_id,
        agent_type, auto_run, tools_config, parent_session_id, depth,
        inherited_context, result_summary, is_sub_agent, last_compressed_step_id,
        compressed_summary, is_compressing, compressing_started_at, is_running,
        is_deleted, last_knowledge_extraction_at, share_secret_key,
        created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `);

    stmt.run(
      id,
      session.goal,
      session.initialGoal || session.goal,
      session.status || 'active',
      session.userId,
      session.apiKey,
      session.organizationId,
      session.agentType,
      session.autoRun ? 1 : 0,
      JSON.stringify(session.toolsConfig || {}),
      session.parentSessionId,
      session.depth || 0,
      session.inheritedContext,
      session.resultSummary,
      session.isSubAgent ? 1 : 0,
      session.lastCompressedStepId || 0,
      session.compressedSummary,
      session.isCompressing ? 1 : 0,
      session.compressingStartedAt?.toISOString(),
      session.isRunning ? 1 : 0,
      session.isDeleted ? 1 : 0,
      session.lastKnowledgeExtractionAt?.toISOString(),
      session.shareSecretKey,
      now.toISOString(),
      now.toISOString(),
    );

    return (await this.getSession(id)) as Session;
  }

  getSession(sessionId: string): Promise<Session | null> {
    const stmt = this.db.prepare(`
      SELECT * FROM sessions WHERE id = ? AND is_deleted = 0
    `);

    const row = stmt.get(sessionId);
    if (!row) return Promise.resolve(null);

    return Promise.resolve(this.mapSessionRow(row as any));
  }

  async updateSession(sessionId: string, updates: Partial<Session>): Promise<Session> {
    const now = new Date();

    const setClauses: string[] = [];
    const values: any[] = [];

    const updateFields: Record<string, string> = {
      goal: 'goal',
      status: 'status',
      userId: 'user_id',
      apiKey: 'api_key',
      organizationId: 'organization_id',
      agentType: 'agent_type',
      autoRun: 'auto_run',
      toolsConfig: 'tools_config',
      parentSessionId: 'parent_session_id',
      depth: 'depth',
      inheritedContext: 'inherited_context',
      resultSummary: 'result_summary',
      isSubAgent: 'is_sub_agent',
      lastCompressedStepId: 'last_compressed_step_id',
      compressedSummary: 'compressed_summary',
      isCompressing: 'is_compressing',
      compressingStartedAt: 'compressing_started_at',
      isRunning: 'is_running',
      isDeleted: 'is_deleted',
      lastKnowledgeExtractionAt: 'last_knowledge_extraction_at',
      shareSecretKey: 'share_secret_key',
    };

    for (const [key, dbField] of Object.entries(updateFields)) {
      if (key in updates) {
        setClauses.push(`${dbField} = ?`);
        let value = (updates as any)[key];

        // Handle special types
        if (key === 'toolsConfig') {
          value = JSON.stringify(value || {});
        } else if (
          key === 'autoRun' ||
          key === 'isSubAgent' ||
          key === 'isCompressing' ||
          key === 'isRunning' ||
          key === 'isDeleted'
        ) {
          value = value ? 1 : 0;
        } else if (key === 'compressingStartedAt' || key === 'lastKnowledgeExtractionAt') {
          value = value ? new Date(value).toISOString() : null;
        }

        values.push(value);
      }
    }

    if (setClauses.length === 0) {
      throw new Error('No fields to update');
    }

    // Add updated_at
    setClauses.push('updated_at = ?');
    values.push(now.toISOString());

    // Add session ID for WHERE clause
    values.push(sessionId);

    const stmt = this.db.prepare(`
      UPDATE sessions
      SET ${setClauses.join(', ')}
      WHERE id = ? AND is_deleted = 0
    `);

    stmt.run(...values);

    return (await this.getSession(sessionId)) as Session;
  }

  deleteSession(sessionId: string): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE sessions
      SET is_deleted = 1, updated_at = ?
      WHERE id = ?
    `);

    stmt.run(new Date().toISOString(), sessionId);
    return Promise.resolve();
  }

  async listSessions(filters: {
    userId?: string;
    organizationId?: string;
    status?: Session['status'];
    limit?: number;
    offset?: number;
  }): Promise<{ sessions: Session[]; total: number }> {
    const whereClauses: string[] = ['is_deleted = 0'];
    const values: any[] = [];

    if (filters.userId) {
      whereClauses.push('user_id = ?');
      values.push(filters.userId);
    }

    if (filters.organizationId) {
      whereClauses.push('organization_id = ?');
      values.push(filters.organizationId);
    }

    if (filters.status) {
      whereClauses.push('status = ?');
      values.push(filters.status);
    }

    const whereClause = whereClauses.join(' AND ');

    // Get total count
    const countStmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM sessions WHERE ${whereClause}
    `);
    const countResult = countStmt.get(...values) as { count: number };
    const total = countResult.count;

    // Get sessions
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    const sessionsStmt = this.db.prepare(`
      SELECT * FROM sessions
      WHERE ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `);

    const rows = sessionsStmt.all(...values, limit, offset);
    const sessions = rows.map((row: any) => this.mapSessionRow(row));

    return { sessions, total };
  }

  // ==========================================
  // Step Operations
  // ==========================================

  async createStep(step: Omit<Step, 'id' | 'createdAt' | 'updatedAt'>): Promise<Step> {
    const now = new Date();

    const stmt = this.db.prepare(`
      INSERT INTO steps (
        session_id, step_number, action, reasoning, selected_tool, parameters,
        llm_prompt, llm_response, step_result, error_message, status, discarded,
        is_parallel, wait_strategy, parallel_status,
        started_at, completed_at, execution_duration_ms,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const info = stmt.run(
      step.sessionId,
      step.stepNumber,
      step.action,
      step.reasoning,
      step.selectedTool,
      JSON.stringify(step.parameters || {}),
      step.llmPrompt,
      step.llmResponse,
      step.stepResult,
      step.errorMessage,
      step.status || 'pending',
      step.discarded ? 1 : 0,
      step.isParallel ? 1 : 0,
      step.waitStrategy,
      step.parallelStatus,
      step.startedAt?.toISOString(),
      step.completedAt?.toISOString(),
      step.executionDurationMs,
      now.toISOString(),
      now.toISOString(),
    );

    return (await this.getStep(info.lastInsertRowid as number)) as Step;
  }

  getStep(stepId: number): Promise<Step | null> {
    const stmt = this.db.prepare('SELECT * FROM steps WHERE id = ?');
    const row = stmt.get(stepId);

    if (!row) return Promise.resolve(null);
    return Promise.resolve(this.mapStepRow(row as any));
  }

  async updateStep(stepId: number, updates: Partial<Step>): Promise<Step> {
    const now = new Date();

    const setClauses: string[] = [];
    const values: any[] = [];

    const updateFields: Record<string, string> = {
      action: 'action',
      reasoning: 'reasoning',
      selectedTool: 'selected_tool',
      parameters: 'parameters',
      llmPrompt: 'llm_prompt',
      llmResponse: 'llm_response',
      stepResult: 'step_result',
      errorMessage: 'error_message',
      status: 'status',
      discarded: 'discarded',
      isParallel: 'is_parallel',
      waitStrategy: 'wait_strategy',
      parallelStatus: 'parallel_status',
      startedAt: 'started_at',
      completedAt: 'completed_at',
      executionDurationMs: 'execution_duration_ms',
    };

    for (const [key, dbField] of Object.entries(updateFields)) {
      if (key in updates) {
        setClauses.push(`${dbField} = ?`);
        let value = (updates as any)[key];

        // Handle special types
        if (key === 'parameters') {
          value = JSON.stringify(value || {});
        } else if (key === 'discarded' || key === 'isParallel') {
          value = value ? 1 : 0;
        } else if (key === 'startedAt' || key === 'completedAt') {
          value = value ? new Date(value).toISOString() : null;
        }

        values.push(value);
      }
    }

    if (setClauses.length === 0) {
      throw new Error('No fields to update');
    }

    // Add updated_at
    setClauses.push('updated_at = ?');
    values.push(now.toISOString());

    // Add step ID for WHERE clause
    values.push(stepId);

    const stmt = this.db.prepare(`
      UPDATE steps
      SET ${setClauses.join(', ')}
      WHERE id = ?
    `);

    stmt.run(...values);

    return (await this.getStep(stepId)) as Step;
  }

  async listSteps(
    sessionId: string,
    filters?: {
      includeDiscarded?: boolean;
      limit?: number;
      offset?: number;
    },
  ): Promise<Step[]> {
    const whereClauses: string[] = ['session_id = ?'];
    const values: any[] = [sessionId];

    if (!filters?.includeDiscarded) {
      whereClauses.push('discarded = 0');
    }

    const whereClause = whereClauses.join(' AND ');

    let query = `
      SELECT * FROM steps
      WHERE ${whereClause}
      ORDER BY step_number ASC
    `;

    if (filters?.limit) {
      query += ' LIMIT ?';
      values.push(filters.limit);

      if (filters.offset) {
        query += ' OFFSET ?';
        values.push(filters.offset);
      }
    }

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...values);

    return rows.map((row: any) => this.mapStepRow(row));
  }

  async markStepsAsDiscarded(sessionId: string, stepIds: number[]): Promise<void> {
    if (stepIds.length === 0) return;

    const placeholders = stepIds.map(() => '?').join(',');
    const stmt = this.db.prepare(`
      UPDATE steps
      SET discarded = 1, updated_at = ?
      WHERE session_id = ? AND id IN (${placeholders})
    `);

    stmt.run(new Date().toISOString(), sessionId, ...stepIds);
  }

  getLastStep(sessionId: string): Promise<Step | null> {
    const stmt = this.db.prepare(`
      SELECT * FROM steps
      WHERE session_id = ?
      ORDER BY step_number DESC
      LIMIT 1
    `);

    const row = stmt.get(sessionId);
    if (!row) return Promise.resolve(null);

    return Promise.resolve(this.mapStepRow(row as any));
  }

  // ==========================================
  // Todo Operations
  // ==========================================

  async createTodo(todo: Omit<Todo, 'createdAt' | 'updatedAt'>): Promise<Todo> {
    const now = new Date();

    const stmt = this.db.prepare(`
      INSERT INTO todos (
        id, session_id, title, description, order_index, status, dependencies, priority,
        estimated_steps, actual_steps, estimated_tokens, actual_tokens,
        result, error, started_at, completed_at, duration_seconds,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      todo.id,
      todo.sessionId,
      todo.title,
      todo.description,
      todo.orderIndex,
      todo.status || 'pending',
      JSON.stringify(todo.dependencies || []),
      todo.priority || 0,
      todo.estimatedSteps,
      todo.actualSteps || 0,
      todo.estimatedTokens,
      todo.actualTokens || 0,
      JSON.stringify(todo.result || {}),
      todo.error,
      todo.startedAt?.toISOString(),
      todo.completedAt?.toISOString(),
      todo.durationSeconds,
      now.toISOString(),
      now.toISOString(),
    );

    return (await this.getTodo(todo.id)) as Todo;
  }

  getTodo(todoId: string): Promise<Todo | null> {
    const stmt = this.db.prepare('SELECT * FROM todos WHERE id = ?');
    const row = stmt.get(todoId);

    if (!row) return Promise.resolve(null);
    return Promise.resolve(this.mapTodoRow(row as any));
  }

  async updateTodo(todoId: string, updates: Partial<Todo>): Promise<Todo> {
    const now = new Date();

    const setClauses: string[] = [];
    const values: any[] = [];

    const updateFields: Record<string, string> = {
      title: 'title',
      description: 'description',
      status: 'status',
      orderIndex: 'order_index',
      dependencies: 'dependencies',
      priority: 'priority',
      estimatedSteps: 'estimated_steps',
      actualSteps: 'actual_steps',
      estimatedTokens: 'estimated_tokens',
      actualTokens: 'actual_tokens',
      result: 'result',
      error: 'error',
      startedAt: 'started_at',
      completedAt: 'completed_at',
      durationSeconds: 'duration_seconds',
    };

    for (const [key, dbField] of Object.entries(updateFields)) {
      if (key in updates) {
        setClauses.push(`${dbField} = ?`);
        let value = (updates as any)[key];

        // Handle special types
        if (key === 'dependencies') {
          value = JSON.stringify(value || []);
        } else if (key === 'result') {
          value = JSON.stringify(value || {});
        } else if (key === 'startedAt' || key === 'completedAt') {
          value = value ? new Date(value).toISOString() : null;
        }

        values.push(value);
      }
    }

    if (setClauses.length === 0) {
      throw new Error('No fields to update');
    }

    // Add updated_at
    setClauses.push('updated_at = ?');
    values.push(now.toISOString());

    // Add todo ID for WHERE clause
    values.push(todoId);

    const stmt = this.db.prepare(`
      UPDATE todos
      SET ${setClauses.join(', ')}
      WHERE id = ?
    `);

    stmt.run(...values);

    return (await this.getTodo(todoId)) as Todo;
  }

  deleteTodo(todoId: string): Promise<void> {
    const stmt = this.db.prepare('DELETE FROM todos WHERE id = ?');
    stmt.run(todoId);
    return Promise.resolve();
  }

  async listTodos(sessionId: string): Promise<Todo[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM todos
      WHERE session_id = ?
      ORDER BY order_index ASC
    `);

    const rows = stmt.all(sessionId);
    return rows.map((row: any) => this.mapTodoRow(row));
  }

  async batchCreateTodos(todos: Omit<Todo, 'createdAt' | 'updatedAt'>[]): Promise<Todo[]> {
    const now = new Date();

    const insert = this.db.transaction((todosToInsert: typeof todos) => {
      const stmt = this.db.prepare(`
        INSERT INTO todos (
          id, session_id, title, description, order_index, status, dependencies, priority,
          estimated_steps, actual_steps, estimated_tokens, actual_tokens,
          result, error, started_at, completed_at, duration_seconds,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const todo of todosToInsert) {
        stmt.run(
          todo.id,
          todo.sessionId,
          todo.title,
          todo.description,
          todo.orderIndex,
          todo.status || 'pending',
          JSON.stringify(todo.dependencies || []),
          todo.priority || 0,
          todo.estimatedSteps,
          todo.actualSteps || 0,
          todo.estimatedTokens,
          todo.actualTokens || 0,
          JSON.stringify(todo.result || {}),
          todo.error,
          todo.startedAt?.toISOString(),
          todo.completedAt?.toISOString(),
          todo.durationSeconds,
          now.toISOString(),
          now.toISOString(),
        );
      }
    });

    insert(todos);

    // Fetch and return created todos
    const ids = todos.map((t) => t.id);
    const placeholders = ids.map(() => '?').join(',');
    const stmt = this.db.prepare(`SELECT * FROM todos WHERE id IN (${placeholders})`);
    const rows = stmt.all(...ids);

    return rows.map((row: any) => this.mapTodoRow(row));
  }

  async batchUpdateTodos(updates: Array<{ id: string; updates: Partial<Todo> }>): Promise<Todo[]> {
    const now = new Date();

    const update = this.db.transaction((updatesToApply: typeof updates) => {
      for (const { id, updates: todoUpdates } of updatesToApply) {
        const setClauses: string[] = [];
        const values: any[] = [];

        const updateFields: Record<string, string> = {
          title: 'title',
          description: 'description',
          status: 'status',
          orderIndex: 'order_index',
          dependencies: 'dependencies',
          priority: 'priority',
          estimatedSteps: 'estimated_steps',
          actualSteps: 'actual_steps',
          estimatedTokens: 'estimated_tokens',
          actualTokens: 'actual_tokens',
          result: 'result',
          error: 'error',
          startedAt: 'started_at',
          completedAt: 'completed_at',
          durationSeconds: 'duration_seconds',
        };

        for (const [key, dbField] of Object.entries(updateFields)) {
          if (key in todoUpdates) {
            setClauses.push(`${dbField} = ?`);
            let value = (todoUpdates as any)[key];

            // Handle special types
            if (key === 'dependencies') {
              value = JSON.stringify(value || []);
            } else if (key === 'result') {
              value = JSON.stringify(value || {});
            } else if (key === 'startedAt' || key === 'completedAt') {
              value = value ? new Date(value).toISOString() : null;
            }

            values.push(value);
          }
        }

        if (setClauses.length > 0) {
          setClauses.push('updated_at = ?');
          values.push(now.toISOString());
          values.push(id);

          const stmt = this.db.prepare(`
            UPDATE todos
            SET ${setClauses.join(', ')}
            WHERE id = ?
          `);

          stmt.run(...values);
        }
      }
    });

    update(updates);

    // Fetch and return updated todos
    const ids = updates.map((u) => u.id);
    const placeholders = ids.map(() => '?').join(',');
    const stmt = this.db.prepare(`SELECT * FROM todos WHERE id IN (${placeholders})`);
    const rows = stmt.all(...ids);

    return rows.map((row: any) => this.mapTodoRow(row));
  }

  // ==========================================
  // Parallel Tool Call Operations
  // ==========================================

  async createParallelToolCall(
    call: Omit<ParallelToolCall, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<ParallelToolCall> {
    const now = new Date();

    const stmt = this.db.prepare(`
      INSERT INTO parallel_tool_calls (
        step_id, tool_id, tool_name, parameters, status, result, error_message,
        progress_percentage, status_message, external_task_id, external_status,
        started_at, completed_at, execution_duration_ms, retry_count, max_retries,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const info = stmt.run(
      call.stepId,
      call.toolId,
      call.toolName,
      JSON.stringify(call.parameters),
      call.status || 'pending',
      call.result ? JSON.stringify(call.result) : null,
      call.errorMessage,
      call.progressPercentage || 0,
      call.statusMessage,
      call.externalTaskId,
      call.externalStatus,
      call.startedAt?.toISOString(),
      call.completedAt?.toISOString(),
      call.executionDurationMs,
      call.retryCount || 0,
      call.maxRetries || 3,
      now.toISOString(),
      now.toISOString(),
    );

    return (await this.getParallelToolCall(Number(info.lastInsertRowid))) as ParallelToolCall;
  }

  getParallelToolCall(callId: number): Promise<ParallelToolCall | null> {
    const stmt = this.db.prepare('SELECT * FROM parallel_tool_calls WHERE id = ?');
    const row = stmt.get(callId);

    if (!row) return Promise.resolve(null);
    return Promise.resolve(this.mapParallelToolCallRow(row as any));
  }

  async updateParallelToolCall(
    callId: number,
    updates: Partial<ParallelToolCall>,
  ): Promise<ParallelToolCall> {
    const now = new Date();
    const setClauses: string[] = [];
    const values: any[] = [];

    // Build dynamic SET clause
    for (const [key, value] of Object.entries(updates)) {
      if (key === 'id' || key === 'createdAt' || key === 'updatedAt') continue;

      const snakeKey = this.camelToSnake(key);
      setClauses.push(`${snakeKey} = ?`);

      // Handle special types
      if (key === 'parameters' || key === 'result') {
        values.push(value ? JSON.stringify(value) : null);
      } else if (key === 'startedAt' || key === 'completedAt') {
        values.push(value ? new Date(value).toISOString() : null);
      } else {
        values.push(value);
      }
    }

    if (setClauses.length > 0) {
      setClauses.push('updated_at = ?');
      values.push(now.toISOString());
      values.push(callId);

      const stmt = this.db.prepare(`
        UPDATE parallel_tool_calls
        SET ${setClauses.join(', ')}
        WHERE id = ?
      `);

      stmt.run(...values);
    }

    return (await this.getParallelToolCall(callId)) as ParallelToolCall;
  }

  async listParallelToolCalls(stepId: number): Promise<ParallelToolCall[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM parallel_tool_calls
      WHERE step_id = ?
      ORDER BY created_at ASC
    `);

    const rows = stmt.all(stepId);
    return rows.map((row: any) => this.mapParallelToolCallRow(row));
  }

  // ==========================================
  // Fork Agent Task Operations
  // ==========================================

  async createForkAgentTask(
    task: Omit<ForkAgentTask, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<ForkAgentTask> {
    const id = this.generateId('fork');
    const now = new Date();

    const stmt = this.db.prepare(`
      INSERT INTO fork_agent_tasks (
        id, parent_session_id, parent_step_id, sub_session_id, goal, context_summary,
        depth, max_steps, timeout_seconds, status, result_summary, error_message,
        steps_executed, tokens_used, tools_called, started_at, completed_at,
        execution_duration_ms, retry_count, max_retries, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      task.parentSessionId,
      task.parentStepId,
      task.subSessionId,
      task.goal,
      task.contextSummary,
      task.depth,
      task.maxSteps || 20,
      task.timeoutSeconds || 300,
      task.status || 'pending',
      task.resultSummary,
      task.errorMessage,
      task.stepsExecuted || 0,
      task.tokensUsed || 0,
      task.toolsCalled || 0,
      task.startedAt?.toISOString(),
      task.completedAt?.toISOString(),
      task.executionDurationMs,
      task.retryCount || 0,
      task.maxRetries || 3,
      now.toISOString(),
      now.toISOString(),
    );

    return (await this.getForkAgentTask(id)) as ForkAgentTask;
  }

  getForkAgentTask(taskId: string): Promise<ForkAgentTask | null> {
    const stmt = this.db.prepare('SELECT * FROM fork_agent_tasks WHERE id = ?');
    const row = stmt.get(taskId);

    if (!row) return Promise.resolve(null);
    return Promise.resolve(this.mapForkAgentTaskRow(row as any));
  }

  async updateForkAgentTask(
    taskId: string,
    updates: Partial<ForkAgentTask>,
  ): Promise<ForkAgentTask> {
    const now = new Date();
    const setClauses: string[] = [];
    const values: any[] = [];

    // Build dynamic SET clause
    for (const [key, value] of Object.entries(updates)) {
      if (key === 'id' || key === 'createdAt' || key === 'updatedAt') continue;

      const snakeKey = this.camelToSnake(key);
      setClauses.push(`${snakeKey} = ?`);

      // Handle special types
      if (key === 'startedAt' || key === 'completedAt') {
        values.push(value ? new Date(value).toISOString() : null);
      } else {
        values.push(value);
      }
    }

    if (setClauses.length > 0) {
      setClauses.push('updated_at = ?');
      values.push(now.toISOString());
      values.push(taskId);

      const stmt = this.db.prepare(`
        UPDATE fork_agent_tasks
        SET ${setClauses.join(', ')}
        WHERE id = ?
      `);

      stmt.run(...values);
    }

    return (await this.getForkAgentTask(taskId)) as ForkAgentTask;
  }

  async listForkAgentTasks(sessionId: string): Promise<ForkAgentTask[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM fork_agent_tasks
      WHERE parent_session_id = ?
      ORDER BY created_at ASC
    `);

    const rows = stmt.all(sessionId);
    return rows.map((row: any) => this.mapForkAgentTaskRow(row));
  }

  // ==========================================
  // Checkpoint Operations
  // ==========================================

  async createCheckpoint(checkpoint: Omit<Checkpoint, 'id' | 'createdAt'>): Promise<Checkpoint> {
    const id = this.generateId('checkpoint');
    const now = new Date();

    const stmt = this.db.prepare(`
      INSERT INTO checkpoints (
        id, session_id, name, step_number, session_state, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      checkpoint.sessionId,
      checkpoint.name,
      checkpoint.stepId,
      JSON.stringify(checkpoint.sessionState || {}),
      now.toISOString(),
    );

    return (await this.getCheckpoint(id)) as Checkpoint;
  }

  getCheckpoint(checkpointId: string): Promise<Checkpoint | null> {
    const stmt = this.db.prepare('SELECT * FROM checkpoints WHERE id = ?');
    const row = stmt.get(checkpointId);

    if (!row) return Promise.resolve(null);
    return Promise.resolve(this.mapCheckpointRow(row as any));
  }

  async listCheckpoints(sessionId: string): Promise<Checkpoint[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM checkpoints
      WHERE session_id = ?
      ORDER BY created_at DESC
    `);

    const rows = stmt.all(sessionId);
    return rows.map((row: any) => this.mapCheckpointRow(row));
  }

  deleteCheckpoint(checkpointId: string): Promise<void> {
    const stmt = this.db.prepare('DELETE FROM checkpoints WHERE id = ?');
    stmt.run(checkpointId);
    return Promise.resolve();
  }

  // ==========================================
  // Transaction Support
  // ==========================================

  async transaction<T>(fn: (tx: StorageAdapter) => Promise<T>): Promise<T> {
    // Create a transaction wrapper
    const txFn = this.db.transaction((callback: () => T) => callback());
    // Execute the function within a transaction
    // For SQLite, the transaction is handled by better-sqlite3
    return txFn(() => {
      // Execute the callback with this adapter
      // Note: For now, we pass the same adapter instance
      // In a more sophisticated implementation, we'd create a transaction-specific adapter
      return fn(this) as any;
    });
  }

  // ==========================================
  // Helper Methods
  // ==========================================

  /**
   * Generate a unique ID with prefix
   */
  private generateId(prefix: string): string {
    return `${prefix}_${randomUUID()}`;
  }

  /**
   * Convert camelCase to snake_case
   */
  private camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
  }

  /**
   * Map database row to Session object
   */
  private mapSessionRow(row: any): Session {
    return {
      id: row.id,
      goal: row.goal,
      initialGoal: row.initial_goal,
      status: row.status,
      userId: row.user_id,
      apiKey: row.api_key,
      organizationId: row.organization_id,
      agentType: row.agent_type,
      autoRun: Boolean(row.auto_run),
      toolsConfig: row.tools_config ? JSON.parse(row.tools_config) : {},
      parentSessionId: row.parent_session_id,
      depth: row.depth,
      inheritedContext: row.inherited_context,
      resultSummary: row.result_summary,
      isSubAgent: Boolean(row.is_sub_agent),
      lastCompressedStepId: row.last_compressed_step_id,
      compressedSummary: row.compressed_summary,
      isCompressing: Boolean(row.is_compressing),
      compressingStartedAt: row.compressing_started_at
        ? new Date(row.compressing_started_at)
        : undefined,
      isRunning: Boolean(row.is_running),
      isDeleted: Boolean(row.is_deleted),
      lastKnowledgeExtractionAt: row.last_knowledge_extraction_at
        ? new Date(row.last_knowledge_extraction_at)
        : undefined,
      shareSecretKey: row.share_secret_key,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  /**
   * Map database row to Step object
   */
  private mapStepRow(row: any): Step {
    return {
      id: row.id,
      sessionId: row.session_id,
      stepNumber: row.step_number,
      llmPrompt: row.llm_prompt,
      llmResponse: row.llm_response,
      action: row.action,
      reasoning: row.reasoning,
      selectedTool: row.selected_tool,
      parameters: row.parameters ? JSON.parse(row.parameters) : {},
      stepResult: row.step_result,
      errorMessage: row.error_message,
      status: row.status,
      discarded: Boolean(row.discarded),
      isParallel: Boolean(row.is_parallel),
      waitStrategy: row.wait_strategy,
      parallelStatus: row.parallel_status,
      startedAt: row.started_at ? new Date(row.started_at) : undefined,
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      executionDurationMs: row.execution_duration_ms,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  /**
   * Map database row to Todo object
   */
  private mapTodoRow(row: any): Todo {
    return {
      id: row.id,
      sessionId: row.session_id,
      title: row.title,
      description: row.description,
      orderIndex: row.order_index,
      status: row.status,
      dependencies: row.dependencies ? JSON.parse(row.dependencies) : [],
      priority: row.priority,
      estimatedSteps: row.estimated_steps,
      actualSteps: row.actual_steps,
      estimatedTokens: row.estimated_tokens,
      actualTokens: row.actual_tokens,
      result: row.result ? JSON.parse(row.result) : undefined,
      error: row.error,
      startedAt: row.started_at ? new Date(row.started_at) : undefined,
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      durationSeconds: row.duration_seconds,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  /**
   * Map database row to Checkpoint object
   */
  private mapCheckpointRow(row: any): Checkpoint {
    return {
      id: row.id,
      sessionId: row.session_id,
      name: row.name,
      stepId: row.step_number,
      sessionState: row.session_state ? JSON.parse(row.session_state) : {},
      createdAt: new Date(row.created_at),
    };
  }

  /**
   * Map database row to ParallelToolCall object
   */
  private mapParallelToolCallRow(row: any): ParallelToolCall {
    return {
      id: row.id,
      stepId: row.step_id,
      toolId: row.tool_id,
      toolName: row.tool_name,
      parameters: row.parameters ? JSON.parse(row.parameters) : {},
      status: row.status,
      result: row.result ? JSON.parse(row.result) : undefined,
      errorMessage: row.error_message,
      progressPercentage: row.progress_percentage,
      statusMessage: row.status_message,
      externalTaskId: row.external_task_id,
      externalStatus: row.external_status,
      startedAt: row.started_at ? new Date(row.started_at) : undefined,
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      executionDurationMs: row.execution_duration_ms,
      retryCount: row.retry_count,
      maxRetries: row.max_retries,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  /**
   * Map database row to ForkAgentTask object
   */
  private mapForkAgentTaskRow(row: any): ForkAgentTask {
    return {
      id: row.id,
      parentSessionId: row.parent_session_id,
      parentStepId: row.parent_step_id,
      subSessionId: row.sub_session_id,
      goal: row.goal,
      contextSummary: row.context_summary,
      depth: row.depth,
      maxSteps: row.max_steps,
      timeoutSeconds: row.timeout_seconds,
      status: row.status,
      resultSummary: row.result_summary,
      errorMessage: row.error_message,
      stepsExecuted: row.steps_executed,
      tokensUsed: row.tokens_used,
      toolsCalled: row.tools_called,
      startedAt: row.started_at ? new Date(row.started_at) : undefined,
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      executionDurationMs: row.execution_duration_ms,
      retryCount: row.retry_count,
      maxRetries: row.max_retries,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  /**
   * Close the database connection
   */
  close(): void {
    this.db.close();
  }
}
