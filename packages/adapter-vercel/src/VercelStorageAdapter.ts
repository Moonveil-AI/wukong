/**
 * Vercel Storage Adapter
 *
 * Uses Vercel Postgres for structured data storage
 */

import { sql } from '@vercel/postgres';
import type {
  Checkpoint,
  ForkAgentTask,
  ParallelToolCall,
  Session,
  Step,
  StorageAdapter,
  Todo,
} from '@wukong/agent';

export interface VercelStorageAdapterConfig {
  /**
   * Postgres connection string
   * Usually from process.env.POSTGRES_URL
   */
  postgresUrl: string;
}

export class VercelStorageAdapter implements StorageAdapter {
  constructor(config: VercelStorageAdapterConfig) {
    // Connection is handled automatically by @vercel/postgres
    // Store config if needed for future use
    if (config.postgresUrl) {
      // Config is used implicitly by @vercel/postgres via environment
    }
  }

  // ==========================================
  // Session Operations
  // ==========================================

  async createSession(session: Omit<Session, 'id' | 'createdAt' | 'updatedAt'>): Promise<Session> {
    const id = this.generateId('session');
    const now = new Date();

    const result = await sql`
      INSERT INTO sessions (
        id, goal, initial_goal, status, user_id, api_key, organization_id,
        agent_type, auto_run, tools_config, parent_session_id, depth,
        inherited_context, result_summary, is_sub_agent, last_compressed_step_id,
        compressed_summary, is_compressing, compressing_started_at, is_running,
        is_deleted, last_knowledge_extraction_at, share_secret_key,
        created_at, updated_at
      ) VALUES (
        ${id}, ${session.goal}, ${session.initialGoal || session.goal}, ${session.status || 'active'},
        ${session.userId}, ${session.apiKey}, ${session.organizationId},
        ${session.agentType}, ${session.autoRun}, ${JSON.stringify(session.toolsConfig || {})},
        ${session.parentSessionId}, ${session.depth || 0}, ${session.inheritedContext},
        ${session.resultSummary}, ${session.isSubAgent}, ${session.lastCompressedStepId || 0},
        ${session.compressedSummary}, ${session.isCompressing}, ${session.compressingStartedAt?.toISOString()},
        ${session.isRunning}, ${session.isDeleted}, ${session.lastKnowledgeExtractionAt?.toISOString()},
        ${session.shareSecretKey}, ${now.toISOString()}, ${now.toISOString()}
      )
      RETURNING *
    `;

    return this.mapSessionRow(result.rows[0]);
  }

  async getSession(sessionId: string): Promise<Session | null> {
    const result = await sql`
      SELECT * FROM sessions WHERE id = ${sessionId} AND is_deleted = false
    `;

    if (result.rows.length === 0) return null;
    return this.mapSessionRow(result.rows[0]);
  }

  async updateSession(sessionId: string, updates: Partial<Session>): Promise<Session> {
    const now = new Date();

    // Build dynamic update query
    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

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
        const value = (updates as any)[key];
        setClauses.push(`${dbField} = $${paramIndex}`);
        values.push(
          key === 'toolsConfig' && typeof value === 'object' ? JSON.stringify(value) : value,
        );
        paramIndex++;
      }
    }

    // Always update updated_at
    setClauses.push(`updated_at = $${paramIndex}`);
    values.push(now.toISOString());
    paramIndex++;

    if (setClauses.length === 0) {
      return this.getSession(sessionId) as Promise<Session>;
    }

    // Add session ID as last parameter
    values.push(sessionId);

    const query = `
      UPDATE sessions 
      SET ${setClauses.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await sql.query(query, values);
    return this.mapSessionRow(result.rows[0]);
  }

  async deleteSession(sessionId: string): Promise<void> {
    await sql`
      UPDATE sessions 
      SET is_deleted = true, updated_at = ${new Date().toISOString()}
      WHERE id = ${sessionId}
    `;
  }

  async listSessions(filters: {
    userId?: string;
    organizationId?: string;
    status?: Session['status'];
    limit?: number;
    offset?: number;
  }): Promise<{ sessions: Session[]; total: number }> {
    const whereClauses: string[] = ['is_deleted = false'];
    const values: any[] = [];
    let paramIndex = 1;

    if (filters.userId) {
      whereClauses.push(`user_id = $${paramIndex}`);
      values.push(filters.userId);
      paramIndex++;
    }

    if (filters.organizationId) {
      whereClauses.push(`organization_id = $${paramIndex}`);
      values.push(filters.organizationId);
      paramIndex++;
    }

    if (filters.status) {
      whereClauses.push(`status = $${paramIndex}`);
      values.push(filters.status);
      paramIndex++;
    }

    const whereClause = whereClauses.join(' AND ');

    // Get total count
    const countQuery = `SELECT COUNT(*) as count FROM sessions WHERE ${whereClause}`;
    const countResult = await sql.query(countQuery, values);
    const total = Number.parseInt(countResult.rows[0].count, 10);

    // Get paginated results
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    const query = `
      SELECT * FROM sessions 
      WHERE ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const result = await sql.query(query, [...values, limit, offset]);
    const sessions = result.rows.map((row: any) => this.mapSessionRow(row));

    return { sessions, total };
  }

  // ==========================================
  // Step Operations
  // ==========================================

  async createStep(step: Omit<Step, 'id' | 'createdAt' | 'updatedAt'>): Promise<Step> {
    const now = new Date();

    const result = await sql`
      INSERT INTO steps (
        session_id, step_number, llm_prompt, llm_response, action, reasoning,
        selected_tool, parameters, step_result, error_message, status, discarded,
        is_parallel, wait_strategy, parallel_status, started_at, completed_at,
        execution_duration_ms, created_at, updated_at
      ) VALUES (
        ${step.sessionId}, ${step.stepNumber}, ${step.llmPrompt}, ${step.llmResponse},
        ${step.action}, ${step.reasoning}, ${step.selectedTool}, ${JSON.stringify(step.parameters || {})},
        ${step.stepResult}, ${step.errorMessage}, ${step.status || 'pending'}, ${step.discarded},
        ${step.isParallel}, ${step.waitStrategy}, ${step.parallelStatus},
        ${step.startedAt?.toISOString()}, ${step.completedAt?.toISOString()}, ${step.executionDurationMs},
        ${now.toISOString()}, ${now.toISOString()}
      )
      RETURNING *
    `;

    return this.mapStepRow(result.rows[0]);
  }

  async getStep(stepId: number): Promise<Step | null> {
    const result = await sql`
      SELECT * FROM steps WHERE id = ${stepId}
    `;

    if (result.rows.length === 0) return null;
    return this.mapStepRow(result.rows[0]);
  }

  async updateStep(stepId: number, updates: Partial<Step>): Promise<Step> {
    const now = new Date();

    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    const updateFields: Record<string, string> = {
      llmPrompt: 'llm_prompt',
      llmResponse: 'llm_response',
      action: 'action',
      reasoning: 'reasoning',
      selectedTool: 'selected_tool',
      parameters: 'parameters',
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
        const value = (updates as any)[key];
        setClauses.push(`${dbField} = $${paramIndex}`);
        values.push(
          key === 'parameters' && typeof value === 'object' ? JSON.stringify(value) : value,
        );
        paramIndex++;
      }
    }

    setClauses.push(`updated_at = $${paramIndex}`);
    values.push(now.toISOString());
    paramIndex++;

    if (setClauses.length === 0) {
      return this.getStep(stepId) as Promise<Step>;
    }

    values.push(stepId);

    const query = `
      UPDATE steps 
      SET ${setClauses.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await sql.query(query, values);
    return this.mapStepRow(result.rows[0]);
  }

  async listSteps(
    sessionId: string,
    filters?: {
      includeDiscarded?: boolean;
      limit?: number;
      offset?: number;
    },
  ): Promise<Step[]> {
    const whereClauses = [`session_id = '${sessionId}'`];

    if (!filters?.includeDiscarded) {
      whereClauses.push('discarded = false');
    }

    const whereClause = whereClauses.join(' AND ');
    const limit = filters?.limit || 1000;
    const offset = filters?.offset || 0;

    const query = `
      SELECT * FROM steps 
      WHERE ${whereClause}
      ORDER BY step_number ASC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const result = await sql.query(query);
    return result.rows.map((row: any) => this.mapStepRow(row));
  }

  async markStepsAsDiscarded(sessionId: string, stepIds: number[]): Promise<void> {
    if (stepIds.length === 0) return;

    const placeholders = stepIds.map((_, i) => `$${i + 1}`).join(', ');
    const query = `
      UPDATE steps 
      SET discarded = true, updated_at = $${stepIds.length + 1}
      WHERE session_id = $${stepIds.length + 2} AND id IN (${placeholders})
    `;

    await sql.query(query, [...stepIds, new Date().toISOString(), sessionId]);
  }

  async getLastStep(sessionId: string): Promise<Step | null> {
    const result = await sql`
      SELECT * FROM steps 
      WHERE session_id = ${sessionId}
      ORDER BY step_number DESC
      LIMIT 1
    `;

    if (result.rows.length === 0) return null;
    return this.mapStepRow(result.rows[0]);
  }

  // ==========================================
  // Todo Operations
  // ==========================================

  async createTodo(todo: Omit<Todo, 'createdAt' | 'updatedAt'>): Promise<Todo> {
    const now = new Date();

    const result = await sql`
      INSERT INTO todos (
        id, session_id, title, description, order_index, status, dependencies,
        priority, estimated_steps, actual_steps, estimated_tokens, actual_tokens,
        result, error, started_at, completed_at, duration_seconds,
        created_at, updated_at
      ) VALUES (
        ${todo.id}, ${todo.sessionId}, ${todo.title}, ${todo.description},
        ${todo.orderIndex}, ${todo.status || 'pending'}, ${JSON.stringify(todo.dependencies || [])},
        ${todo.priority || 0}, ${todo.estimatedSteps}, ${todo.actualSteps || 0},
        ${todo.estimatedTokens}, ${todo.actualTokens || 0}, ${JSON.stringify(todo.result || null)},
        ${todo.error}, ${todo.startedAt?.toISOString()}, ${todo.completedAt?.toISOString()}, ${todo.durationSeconds},
        ${now.toISOString()}, ${now.toISOString()}
      )
      RETURNING *
    `;

    return this.mapTodoRow(result.rows[0]);
  }

  async getTodo(todoId: string): Promise<Todo | null> {
    const result = await sql`
      SELECT * FROM todos WHERE id = ${todoId}
    `;

    if (result.rows.length === 0) return null;
    return this.mapTodoRow(result.rows[0]);
  }

  async updateTodo(todoId: string, updates: Partial<Todo>): Promise<Todo> {
    const now = new Date();

    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    const updateFields: Record<string, string> = {
      title: 'title',
      description: 'description',
      orderIndex: 'order_index',
      status: 'status',
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
        const value = (updates as any)[key];
        setClauses.push(`${dbField} = $${paramIndex}`);
        values.push(
          ['dependencies', 'result'].includes(key) && typeof value === 'object'
            ? JSON.stringify(value)
            : value,
        );
        paramIndex++;
      }
    }

    setClauses.push(`updated_at = $${paramIndex}`);
    values.push(now.toISOString());
    paramIndex++;

    if (setClauses.length === 0) {
      return this.getTodo(todoId) as Promise<Todo>;
    }

    values.push(todoId);

    const query = `
      UPDATE todos 
      SET ${setClauses.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await sql.query(query, values);
    return this.mapTodoRow(result.rows[0]);
  }

  async deleteTodo(todoId: string): Promise<void> {
    await sql`
      DELETE FROM todos WHERE id = ${todoId}
    `;
  }

  async listTodos(sessionId: string): Promise<Todo[]> {
    const result = await sql`
      SELECT * FROM todos 
      WHERE session_id = ${sessionId}
      ORDER BY order_index ASC
    `;

    return result.rows.map((row: any) => this.mapTodoRow(row));
  }

  async batchCreateTodos(todos: Omit<Todo, 'createdAt' | 'updatedAt'>[]): Promise<Todo[]> {
    if (todos.length === 0) return [];

    const results: Todo[] = [];

    // Insert todos one by one (Vercel Postgres doesn't support bulk inserts via template strings easily)
    for (const todo of todos) {
      const result = await this.createTodo(todo);
      results.push(result);
    }

    return results;
  }

  async batchUpdateTodos(updates: Array<{ id: string; updates: Partial<Todo> }>): Promise<Todo[]> {
    if (updates.length === 0) return [];

    const results: Todo[] = [];

    for (const { id, updates: todoUpdates } of updates) {
      const result = await this.updateTodo(id, todoUpdates);
      results.push(result);
    }

    return results;
  }

  // ==========================================
  // Parallel Tool Call Operations
  // ==========================================

  async createParallelToolCall(
    call: Omit<ParallelToolCall, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<ParallelToolCall> {
    const now = new Date();

    const result = await sql`
      INSERT INTO parallel_tool_calls (
        step_id, tool_id, tool_name, parameters, status, result, error_message,
        progress_percentage, status_message, external_task_id, external_status,
        started_at, completed_at, execution_duration_ms, retry_count, max_retries,
        created_at, updated_at
      ) VALUES (
        ${call.stepId}, ${call.toolId}, ${call.toolName}, ${JSON.stringify(call.parameters)},
        ${call.status || 'pending'}, ${call.result ? JSON.stringify(call.result) : null},
        ${call.errorMessage}, ${call.progressPercentage || 0}, ${call.statusMessage},
        ${call.externalTaskId}, ${call.externalStatus}, ${call.startedAt?.toISOString()},
        ${call.completedAt?.toISOString()}, ${call.executionDurationMs},
        ${call.retryCount || 0}, ${call.maxRetries || 3},
        ${now.toISOString()}, ${now.toISOString()}
      )
      RETURNING *
    `;

    return this.mapParallelToolCallRow(result.rows[0]);
  }

  async getParallelToolCall(callId: number): Promise<ParallelToolCall | null> {
    const result = await sql`
      SELECT * FROM parallel_tool_calls WHERE id = ${callId}
    `;

    if (result.rows.length === 0) return null;
    return this.mapParallelToolCallRow(result.rows[0]);
  }

  async updateParallelToolCall(
    callId: number,
    updates: Partial<ParallelToolCall>,
  ): Promise<ParallelToolCall> {
    const now = new Date();
    const setClauses: string[] = [];
    const values: any[] = [];

    const updateFields: Record<string, string> = {
      stepId: 'step_id',
      toolId: 'tool_id',
      toolName: 'tool_name',
      parameters: 'parameters',
      status: 'status',
      result: 'result',
      errorMessage: 'error_message',
      progressPercentage: 'progress_percentage',
      statusMessage: 'status_message',
      externalTaskId: 'external_task_id',
      externalStatus: 'external_status',
      startedAt: 'started_at',
      completedAt: 'completed_at',
      executionDurationMs: 'execution_duration_ms',
      retryCount: 'retry_count',
      maxRetries: 'max_retries',
    };

    for (const [key, dbField] of Object.entries(updateFields)) {
      if (key in updates) {
        const value = (updates as any)[key];
        setClauses.push(`${dbField} = $${values.length + 1}`);

        if (key === 'parameters' || key === 'result') {
          values.push(value ? JSON.stringify(value) : null);
        } else if (key === 'startedAt' || key === 'completedAt') {
          values.push(value ? new Date(value).toISOString() : null);
        } else {
          values.push(value);
        }
      }
    }

    if (setClauses.length > 0) {
      setClauses.push(`updated_at = $${values.length + 1}`);
      values.push(now.toISOString());
      values.push(callId);

      const query = `
        UPDATE parallel_tool_calls
        SET ${setClauses.join(', ')}
        WHERE id = $${values.length}
        RETURNING *
      `;

      const result = await sql.query(query, values);
      return this.mapParallelToolCallRow(result.rows[0]);
    }

    return (await this.getParallelToolCall(callId)) as ParallelToolCall;
  }

  async listParallelToolCalls(stepId: number): Promise<ParallelToolCall[]> {
    const result = await sql`
      SELECT * FROM parallel_tool_calls
      WHERE step_id = ${stepId}
      ORDER BY created_at ASC
    `;

    return result.rows.map((row: any) => this.mapParallelToolCallRow(row));
  }

  // ==========================================
  // Fork Agent Task Operations
  // ==========================================

  async createForkAgentTask(
    task: Omit<ForkAgentTask, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<ForkAgentTask> {
    const id = this.generateId('fork');
    const now = new Date();

    const result = await sql`
      INSERT INTO fork_agent_tasks (
        id, parent_session_id, parent_step_id, sub_session_id, goal, context_summary,
        depth, max_steps, timeout_seconds, status, result_summary, error_message,
        steps_executed, tokens_used, tools_called, started_at, completed_at,
        execution_duration_ms, retry_count, max_retries, created_at, updated_at
      ) VALUES (
        ${id}, ${task.parentSessionId}, ${task.parentStepId}, ${task.subSessionId},
        ${task.goal}, ${task.contextSummary}, ${task.depth}, ${task.maxSteps || 20},
        ${task.timeoutSeconds || 300}, ${task.status || 'pending'}, ${task.resultSummary},
        ${task.errorMessage}, ${task.stepsExecuted || 0}, ${task.tokensUsed || 0},
        ${task.toolsCalled || 0}, ${task.startedAt?.toISOString()}, ${task.completedAt?.toISOString()},
        ${task.executionDurationMs}, ${task.retryCount || 0}, ${task.maxRetries || 3},
        ${now.toISOString()}, ${now.toISOString()}
      )
      RETURNING *
    `;

    return this.mapForkAgentTaskRow(result.rows[0]);
  }

  async getForkAgentTask(taskId: string): Promise<ForkAgentTask | null> {
    const result = await sql`
      SELECT * FROM fork_agent_tasks WHERE id = ${taskId}
    `;

    if (result.rows.length === 0) return null;
    return this.mapForkAgentTaskRow(result.rows[0]);
  }

  async updateForkAgentTask(
    taskId: string,
    updates: Partial<ForkAgentTask>,
  ): Promise<ForkAgentTask> {
    const now = new Date();
    const setClauses: string[] = [];
    const values: any[] = [];

    const updateFields: Record<string, string> = {
      parentSessionId: 'parent_session_id',
      parentStepId: 'parent_step_id',
      subSessionId: 'sub_session_id',
      goal: 'goal',
      contextSummary: 'context_summary',
      depth: 'depth',
      maxSteps: 'max_steps',
      timeoutSeconds: 'timeout_seconds',
      status: 'status',
      resultSummary: 'result_summary',
      errorMessage: 'error_message',
      stepsExecuted: 'steps_executed',
      tokensUsed: 'tokens_used',
      toolsCalled: 'tools_called',
      startedAt: 'started_at',
      completedAt: 'completed_at',
      executionDurationMs: 'execution_duration_ms',
      retryCount: 'retry_count',
      maxRetries: 'max_retries',
    };

    for (const [key, dbField] of Object.entries(updateFields)) {
      if (key in updates) {
        const value = (updates as any)[key];
        setClauses.push(`${dbField} = $${values.length + 1}`);

        if (key === 'startedAt' || key === 'completedAt') {
          values.push(value ? new Date(value).toISOString() : null);
        } else {
          values.push(value);
        }
      }
    }

    if (setClauses.length > 0) {
      setClauses.push(`updated_at = $${values.length + 1}`);
      values.push(now.toISOString());
      values.push(taskId);

      const query = `
        UPDATE fork_agent_tasks
        SET ${setClauses.join(', ')}
        WHERE id = $${values.length}
        RETURNING *
      `;

      const result = await sql.query(query, values);
      return this.mapForkAgentTaskRow(result.rows[0]);
    }

    return (await this.getForkAgentTask(taskId)) as ForkAgentTask;
  }

  async listForkAgentTasks(sessionId: string): Promise<ForkAgentTask[]> {
    const result = await sql`
      SELECT * FROM fork_agent_tasks
      WHERE parent_session_id = ${sessionId}
      ORDER BY created_at ASC
    `;

    return result.rows.map((row: any) => this.mapForkAgentTaskRow(row));
  }

  // ==========================================
  // Checkpoint Operations
  // ==========================================

  async createCheckpoint(checkpoint: Omit<Checkpoint, 'id' | 'createdAt'>): Promise<Checkpoint> {
    const id = this.generateId('checkpoint');
    const now = new Date();

    const result = await sql`
      INSERT INTO checkpoints (
        id, session_id, name, step_id, session_state, created_at
      ) VALUES (
        ${id}, ${checkpoint.sessionId}, ${checkpoint.name}, ${checkpoint.stepId},
        ${JSON.stringify(checkpoint.sessionState)}, ${now.toISOString()}
      )
      RETURNING *
    `;

    return this.mapCheckpointRow(result.rows[0]);
  }

  async getCheckpoint(checkpointId: string): Promise<Checkpoint | null> {
    const result = await sql`
      SELECT * FROM checkpoints WHERE id = ${checkpointId}
    `;

    if (result.rows.length === 0) return null;
    return this.mapCheckpointRow(result.rows[0]);
  }

  async listCheckpoints(sessionId: string): Promise<Checkpoint[]> {
    const result = await sql`
      SELECT * FROM checkpoints 
      WHERE session_id = ${sessionId}
      ORDER BY created_at DESC
    `;

    return result.rows.map((row: any) => this.mapCheckpointRow(row));
  }

  async deleteCheckpoint(checkpointId: string): Promise<void> {
    await sql`
      DELETE FROM checkpoints WHERE id = ${checkpointId}
    `;
  }

  // ==========================================
  // Transaction Support
  // ==========================================

  async transaction<T>(fn: (tx: StorageAdapter) => Promise<T>): Promise<T> {
    // Vercel Postgres doesn't expose transaction API in the simple SQL tag
    // For now, we'll execute within the same adapter instance
    // In production, you might want to use a more sophisticated approach
    // or use the pg client directly
    return await fn(this);
  }

  // ==========================================
  // Helper Methods
  // ==========================================

  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

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
      autoRun: row.auto_run,
      toolsConfig:
        typeof row.tools_config === 'string' ? JSON.parse(row.tools_config) : row.tools_config,
      parentSessionId: row.parent_session_id,
      depth: row.depth,
      inheritedContext: row.inherited_context,
      resultSummary: row.result_summary,
      isSubAgent: row.is_sub_agent,
      lastCompressedStepId: row.last_compressed_step_id,
      compressedSummary: row.compressed_summary,
      isCompressing: row.is_compressing,
      compressingStartedAt: row.compressing_started_at,
      isRunning: row.is_running,
      isDeleted: row.is_deleted,
      lastKnowledgeExtractionAt: row.last_knowledge_extraction_at,
      shareSecretKey: row.share_secret_key,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

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
      parameters: typeof row.parameters === 'string' ? JSON.parse(row.parameters) : row.parameters,
      stepResult: row.step_result,
      errorMessage: row.error_message,
      status: row.status,
      discarded: row.discarded,
      isParallel: row.is_parallel,
      waitStrategy: row.wait_strategy,
      parallelStatus: row.parallel_status,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      executionDurationMs: row.execution_duration_ms,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapTodoRow(row: any): Todo {
    return {
      id: row.id,
      sessionId: row.session_id,
      title: row.title,
      description: row.description,
      orderIndex: row.order_index,
      status: row.status,
      dependencies:
        typeof row.dependencies === 'string' ? JSON.parse(row.dependencies) : row.dependencies,
      priority: row.priority,
      estimatedSteps: row.estimated_steps,
      actualSteps: row.actual_steps,
      estimatedTokens: row.estimated_tokens,
      actualTokens: row.actual_tokens,
      result: typeof row.result === 'string' ? JSON.parse(row.result) : row.result,
      error: row.error,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      durationSeconds: row.duration_seconds,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapCheckpointRow(row: any): Checkpoint {
    return {
      id: row.id,
      sessionId: row.session_id,
      name: row.name,
      stepId: row.step_id,
      sessionState:
        typeof row.session_state === 'string' ? JSON.parse(row.session_state) : row.session_state,
      createdAt: row.created_at,
    };
  }

  private mapParallelToolCallRow(row: any): ParallelToolCall {
    return {
      id: row.id,
      stepId: row.step_id,
      toolId: row.tool_id,
      toolName: row.tool_name,
      parameters: typeof row.parameters === 'string' ? JSON.parse(row.parameters) : row.parameters,
      status: row.status,
      result: row.result
        ? typeof row.result === 'string'
          ? JSON.parse(row.result)
          : row.result
        : undefined,
      errorMessage: row.error_message,
      progressPercentage: row.progress_percentage,
      statusMessage: row.status_message,
      externalTaskId: row.external_task_id,
      externalStatus: row.external_status,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      executionDurationMs: row.execution_duration_ms,
      retryCount: row.retry_count,
      maxRetries: row.max_retries,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

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
      startedAt: row.started_at,
      completedAt: row.completed_at,
      executionDurationMs: row.execution_duration_ms,
      retryCount: row.retry_count,
      maxRetries: row.max_retries,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
