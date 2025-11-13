/**
 * Session Manager
 *
 * Manages agent session lifecycle including:
 * - Creating new sessions
 * - Resuming existing sessions
 * - Saving session state
 * - Loading session history
 * - Checkpoint system for undo/restore
 * - Session cleanup
 */

import type { StorageAdapter } from '../types/adapters';
import type { Checkpoint, Session, Step, StopState } from '../types/index';

/**
 * Options for creating a new session
 */
export interface CreateSessionOptions {
  /** User's goal */
  goal: string;

  /** Initial goal (before modifications) */
  initialGoal?: string;

  /** User ID */
  userId?: string;

  /** API key for user */
  apiKey?: string;

  /** Organization ID */
  organizationId?: string;

  /** Agent type */
  agentType?: 'InteractiveAgent' | 'AutoAgent';

  /** Auto-run mode */
  autoRun?: boolean;

  /** Tools configuration */
  toolsConfig?: Record<string, any>;

  /** Parent session ID (for sub-agents) */
  parentSessionId?: string;

  /** Depth level (for sub-agents) */
  depth?: number;

  /** Inherited context (for sub-agents) */
  inheritedContext?: string;

  /** Share secret key */
  shareSecretKey?: string;
}

/**
 * Options for resuming a session
 */
export interface ResumeSessionOptions {
  /** Whether to validate session can be resumed */
  validate?: boolean;

  /** Whether to reset running state */
  resetRunning?: boolean;
}

/**
 * Options for creating a checkpoint
 */
export interface CreateCheckpointOptions {
  /** Checkpoint name */
  name?: string;

  /** Additional state to include */
  additionalState?: Partial<Session>;
}

/**
 * Session Manager class
 */
export class SessionManager {
  constructor(private readonly storage: StorageAdapter) {}

  /**
   * Create a new session
   */
  async createSession(options: CreateSessionOptions): Promise<Session> {
    const session = await this.storage.createSession({
      goal: options.goal,
      initialGoal: options.initialGoal ?? options.goal,
      userId: options.userId,
      apiKey: options.apiKey,
      organizationId: options.organizationId,
      agentType: options.agentType ?? 'InteractiveAgent',
      autoRun: options.autoRun ?? false,
      toolsConfig: options.toolsConfig,
      parentSessionId: options.parentSessionId,
      depth: options.depth ?? 0,
      inheritedContext: options.inheritedContext,
      isSubAgent: !!options.parentSessionId,
      lastCompressedStepId: 0,
      isCompressing: false,
      isRunning: false,
      isDeleted: false,
      status: 'active',
    });

    return session;
  }

  /**
   * Get a session by ID
   */
  async getSession(sessionId: string): Promise<Session | null> {
    return await this.storage.getSession(sessionId);
  }

  /**
   * Resume an existing session
   */
  async resumeSession(sessionId: string, options: ResumeSessionOptions = {}): Promise<Session> {
    const session = await this.storage.getSession(sessionId);

    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    if (session.isDeleted) {
      throw new Error(`Session has been deleted: ${sessionId}`);
    }

    // Validate session can be resumed
    if (options.validate !== false) {
      if (session.status === 'completed') {
        throw new Error(`Session has already completed: ${sessionId}`);
      }

      if (session.status === 'failed') {
        // Allow resuming failed sessions
        console.warn(`Resuming failed session: ${sessionId}. Previous error may still exist.`);
      }
    }

    // Reset running state if needed
    const updates: Partial<Session> = {};

    if (options.resetRunning !== false && session.isRunning) {
      updates.isRunning = false;
    }

    // Update status to active if paused or stopped
    if (session.status === 'paused' || session.status === 'stopped') {
      updates.status = 'active';
    }

    // Apply updates if any
    if (Object.keys(updates).length > 0) {
      return this.storage.updateSession(sessionId, updates);
    }

    return session;
  }

  /**
   * Update session state
   */
  async updateSession(sessionId: string, updates: Partial<Session>): Promise<Session> {
    return await this.storage.updateSession(sessionId, updates);
  }

  /**
   * Mark session as running
   */
  async markAsRunning(sessionId: string): Promise<Session> {
    return await this.storage.updateSession(sessionId, {
      isRunning: true,
      status: 'active',
    });
  }

  /**
   * Mark session as stopped
   */
  async markAsStopped(sessionId: string): Promise<Session> {
    return await this.storage.updateSession(sessionId, {
      isRunning: false,
      status: 'stopped',
    });
  }

  /**
   * Mark session as completed
   */
  async markAsCompleted(sessionId: string, resultSummary?: string): Promise<Session> {
    return await this.storage.updateSession(sessionId, {
      isRunning: false,
      status: 'completed',
      resultSummary,
    });
  }

  /**
   * Mark session as failed
   */
  async markAsFailed(sessionId: string, errorMessage?: string): Promise<Session> {
    return await this.storage.updateSession(sessionId, {
      isRunning: false,
      status: 'failed',
      resultSummary: errorMessage,
    });
  }

  /**
   * Mark session as paused
   */
  async markAsPaused(sessionId: string): Promise<Session> {
    return await this.storage.updateSession(sessionId, {
      isRunning: false,
      status: 'paused',
    });
  }

  /**
   * Delete a session (soft delete)
   */
  async deleteSession(sessionId: string): Promise<void> {
    await this.storage.updateSession(sessionId, {
      isDeleted: true,
      isRunning: false,
    });
  }

  /**
   * Load session history (steps)
   */
  async loadHistory(
    sessionId: string,
    options?: {
      includeDiscarded?: boolean;
      limit?: number;
    },
  ): Promise<Step[]> {
    return await this.storage.listSteps(sessionId, {
      includeDiscarded: options?.includeDiscarded ?? false,
      limit: options?.limit,
    });
  }

  /**
   * Get the last step for a session
   */
  async getLastStep(sessionId: string): Promise<Step | null> {
    return await this.storage.getLastStep(sessionId);
  }

  /**
   * Mark steps as discarded for token optimization
   */
  async markStepsAsDiscarded(sessionId: string, stepIds: number[]): Promise<void> {
    if (stepIds.length === 0) {
      return;
    }

    await this.storage.markStepsAsDiscarded(sessionId, stepIds);
  }

  /**
   * Update session goal
   */
  async updateGoal(sessionId: string, newGoal: string): Promise<Session> {
    return await this.storage.updateSession(sessionId, {
      goal: newGoal,
    });
  }

  /**
   * Get session with history
   */
  async getSessionWithHistory(
    sessionId: string,
    includeDiscarded = false,
  ): Promise<{ session: Session; history: Step[] }> {
    const session = await this.storage.getSession(sessionId);

    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const history = await this.loadHistory(sessionId, {
      includeDiscarded,
    });

    return { session, history };
  }

  /**
   * List sessions for a user
   */
  async listSessions(filters: {
    userId?: string;
    organizationId?: string;
    status?: Session['status'];
    limit?: number;
    offset?: number;
  }): Promise<{ sessions: Session[]; total: number }> {
    return await this.storage.listSessions(filters);
  }

  // ==========================================
  // Checkpoint Operations
  // ==========================================

  /**
   * Create a checkpoint for undo/restore
   */
  async createCheckpoint(
    sessionId: string,
    options: CreateCheckpointOptions = {},
  ): Promise<Checkpoint> {
    // Get current session state
    const session = await this.storage.getSession(sessionId);

    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Get last step ID
    const lastStep = await this.storage.getLastStep(sessionId);
    const stepId = lastStep?.id ?? 0;

    // Create checkpoint with session state
    const checkpoint = await this.storage.createCheckpoint({
      sessionId,
      name: options.name,
      stepId,
      sessionState: {
        goal: session.goal,
        status: session.status,
        lastCompressedStepId: session.lastCompressedStepId,
        compressedSummary: session.compressedSummary,
        ...options.additionalState,
      },
    });

    return checkpoint;
  }

  /**
   * List checkpoints for a session
   */
  async listCheckpoints(sessionId: string): Promise<Checkpoint[]> {
    return await this.storage.listCheckpoints(sessionId);
  }

  /**
   * Get a checkpoint by ID
   */
  async getCheckpoint(checkpointId: string): Promise<Checkpoint | null> {
    return await this.storage.getCheckpoint(checkpointId);
  }

  /**
   * Restore session from a checkpoint
   */
  async restoreFromCheckpoint(checkpointId: string): Promise<Session> {
    const checkpoint = await this.storage.getCheckpoint(checkpointId);

    if (!checkpoint) {
      throw new Error(`Checkpoint not found: ${checkpointId}`);
    }

    const session = await this.storage.getSession(checkpoint.sessionId);

    if (!session) {
      throw new Error(`Session not found: ${checkpoint.sessionId}`);
    }

    // Restore session state from checkpoint
    const restoredSession = await this.storage.updateSession(checkpoint.sessionId, {
      ...checkpoint.sessionState,
      status: 'active', // Mark as active so it can be resumed
      isRunning: false,
    });

    // Mark steps after checkpoint as discarded
    const allSteps = await this.storage.listSteps(checkpoint.sessionId, {
      includeDiscarded: false,
    });

    const stepsToDiscard = allSteps
      .filter((step) => step.id > checkpoint.stepId)
      .map((step) => step.id);

    if (stepsToDiscard.length > 0) {
      await this.storage.markStepsAsDiscarded(checkpoint.sessionId, stepsToDiscard);
    }

    return restoredSession;
  }

  /**
   * Delete a checkpoint
   */
  async deleteCheckpoint(checkpointId: string): Promise<void> {
    await this.storage.deleteCheckpoint(checkpointId);
  }

  // ==========================================
  // Stop State Management
  // ==========================================

  /**
   * Save stop state for resumption
   */
  async saveStopState(sessionId: string, partialResult?: any): Promise<StopState> {
    const session = await this.storage.getSession(sessionId);

    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const steps = await this.storage.listSteps(sessionId);
    const lastStep = steps[steps.length - 1];

    const stopState: StopState = {
      sessionId,
      completedSteps: steps.length,
      partialResult,
      canResume: true,
      lastStepId: lastStep?.id ?? 0,
    };

    // Update session to stopped state
    await this.storage.updateSession(sessionId, {
      isRunning: false,
      status: 'stopped',
    });

    return stopState;
  }

  /**
   * Get stop state
   */
  async getStopState(sessionId: string): Promise<StopState | null> {
    const session = await this.storage.getSession(sessionId);

    if (!session) {
      return null;
    }

    if (session.status !== 'stopped') {
      return null;
    }

    const steps = await this.storage.listSteps(sessionId);
    const lastStep = steps[steps.length - 1];

    return {
      sessionId,
      completedSteps: steps.length,
      canResume: true,
      lastStepId: lastStep?.id ?? 0,
    };
  }

  // ==========================================
  // Cleanup Operations
  // ==========================================

  /**
   * Clean up old sessions
   */
  async cleanupOldSessions(
    daysOld: number,
    options?: {
      onlyDeleted?: boolean;
      onlyFailed?: boolean;
    },
  ): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    // Get sessions to clean up
    const filters: any = {
      limit: 1000,
    };

    if (options?.onlyDeleted) {
      // Would need to implement in adapter
    }

    const { sessions } = await this.storage.listSessions(filters);

    let cleaned = 0;

    for (const session of sessions) {
      const shouldCleanup =
        session.updatedAt < cutoffDate &&
        (!options?.onlyDeleted || session.isDeleted) &&
        (!options?.onlyFailed || session.status === 'failed');

      if (shouldCleanup) {
        await this.storage.deleteSession(session.id);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Archive a completed session
   */
  async archiveSession(sessionId: string): Promise<void> {
    const session = await this.storage.getSession(sessionId);

    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    if (session.status !== 'completed') {
      throw new Error(`Can only archive completed sessions. Current status: ${session.status}`);
    }

    // Mark as deleted (soft delete)
    await this.deleteSession(sessionId);
  }

  // ==========================================
  // Compression State Management
  // ==========================================

  /**
   * Mark session as compressing
   */
  async markAsCompressing(sessionId: string): Promise<Session> {
    return await this.storage.updateSession(sessionId, {
      isCompressing: true,
      compressingStartedAt: new Date(),
    });
  }

  /**
   * Update compression state
   */
  async updateCompressionState(
    sessionId: string,
    compressedStepId: number,
    summary?: string,
  ): Promise<Session> {
    return await this.storage.updateSession(sessionId, {
      lastCompressedStepId: compressedStepId,
      compressedSummary: summary,
      isCompressing: false,
      compressingStartedAt: undefined,
    });
  }

  // ==========================================
  // Knowledge Extraction State
  // ==========================================

  /**
   * Update last knowledge extraction timestamp
   */
  async updateKnowledgeExtraction(sessionId: string): Promise<Session> {
    return await this.storage.updateSession(sessionId, {
      lastKnowledgeExtractionAt: new Date(),
    });
  }

  // ==========================================
  // Validation Helpers
  // ==========================================

  /**
   * Validate session exists and is accessible
   */
  async validateSession(sessionId: string): Promise<Session> {
    const session = await this.storage.getSession(sessionId);

    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    if (session.isDeleted) {
      throw new Error(`Session has been deleted: ${sessionId}`);
    }

    return session;
  }

  /**
   * Check if session is running
   */
  async isRunning(sessionId: string): Promise<boolean> {
    const session = await this.storage.getSession(sessionId);
    return session?.isRunning ?? false;
  }

  /**
   * Check if session can be resumed
   */
  async canResume(sessionId: string): Promise<boolean> {
    const session = await this.storage.getSession(sessionId);

    if (!session || session.isDeleted) {
      return false;
    }

    // Can resume if paused, stopped, or failed (but not completed)
    return (
      session.status === 'paused' || session.status === 'stopped' || session.status === 'failed'
    );
  }
}
