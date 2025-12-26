/**
 * SessionManager Tests
 */

import { beforeEach, describe, expect, it } from 'vitest';
import type { StorageAdapter } from '../../types/adapters';
import type { Checkpoint, Session, Step } from '../../types/index';
import { SessionManager } from '../SessionManager';

// Mock storage adapter
const createMockStorageAdapter = (): StorageAdapter => {
  const sessions = new Map<string, Session>();
  const steps = new Map<string, Step[]>();
  const checkpoints = new Map<string, Checkpoint>();
  let sessionIdCounter = 1;
  let stepIdCounter = 1;
  let checkpointIdCounter = 1;

  return {
    // Session operations
    createSession(data: any): Promise<Session> {
      const session: Session = {
        ...data,
        id: data.id || `session-${sessionIdCounter++}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      sessions.set(session.id, session);
      return Promise.resolve(session);
    },

    getSession(sessionId: string): Promise<Session | null> {
      return Promise.resolve(sessions.get(sessionId) ?? null);
    },

    updateSession(sessionId: string, updates: Partial<Session>): Promise<Session> {
      const session = sessions.get(sessionId);
      if (!session) {
        throw new Error(`Session not found: ${sessionId}`);
      }
      const updated = {
        ...session,
        ...updates,
        updatedAt: new Date(),
      };
      sessions.set(sessionId, updated);
      return Promise.resolve(updated);
    },

    deleteSession(sessionId: string): Promise<void> {
      sessions.delete(sessionId);
      return Promise.resolve();
    },

    async listSessions(filters: any) {
      const allSessions = Array.from(sessions.values());
      let filtered = allSessions;

      if (filters.userId) {
        filtered = filtered.filter((s) => s.userId === filters.userId);
      }
      if (filters.status) {
        filtered = filtered.filter((s) => s.status === filters.status);
      }

      const offset = filters.offset ?? 0;
      const limit = filters.limit ?? filtered.length;

      return {
        sessions: filtered.slice(offset, offset + limit),
        total: filtered.length,
      };
    },

    // Step operations
    createStep(data: any): Promise<Step> {
      const step: Step = {
        id: stepIdCounter++,
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const sessionSteps = steps.get(data.sessionId) ?? [];
      sessionSteps.push(step);
      steps.set(data.sessionId, sessionSteps);

      return Promise.resolve(step);
    },

    async getStep(stepId: number): Promise<Step | null> {
      for (const sessionSteps of steps.values()) {
        const step = sessionSteps.find((s) => s.id === stepId);
        if (step) return step;
      }
      return null;
    },

    async updateStep(stepId: number, updates: Partial<Step>): Promise<Step> {
      for (const sessionSteps of steps.values()) {
        const index = sessionSteps.findIndex((s) => s.id === stepId);
        if (index !== -1) {
          const updated = {
            ...sessionSteps[index],
            ...updates,
            updatedAt: new Date(),
          };
          sessionSteps[index] = updated;
          return updated;
        }
      }
      throw new Error(`Step not found: ${stepId}`);
    },

    async listSteps(sessionId: string, filters?: any): Promise<Step[]> {
      const sessionSteps = steps.get(sessionId) ?? [];
      let filtered = sessionSteps;

      if (filters?.includeDiscarded === false) {
        filtered = filtered.filter((s) => !s.discarded);
      }

      if (filters?.limit) {
        filtered = filtered.slice(0, filters.limit);
      }

      return filtered;
    },

    markStepsAsDiscarded(sessionId: string, stepIds: number[]): Promise<void> {
      const sessionSteps = steps.get(sessionId) ?? [];
      for (const step of sessionSteps) {
        if (stepIds.includes(step.id)) {
          step.discarded = true;
        }
      }
      return Promise.resolve();
    },

    getLastStep(sessionId: string): Promise<Step | null> {
      const sessionSteps = steps.get(sessionId) ?? [];
      return Promise.resolve(sessionSteps[sessionSteps.length - 1] ?? null);
    },

    // Checkpoint operations
    createCheckpoint(data: any): Promise<Checkpoint> {
      const checkpoint: Checkpoint = {
        id: `checkpoint-${checkpointIdCounter++}`,
        ...data,
        createdAt: new Date(),
      };
      checkpoints.set(checkpoint.id, checkpoint);
      return Promise.resolve(checkpoint);
    },

    getCheckpoint(checkpointId: string): Promise<Checkpoint | null> {
      return Promise.resolve(checkpoints.get(checkpointId) ?? null);
    },

    async listCheckpoints(sessionId: string): Promise<Checkpoint[]> {
      return Array.from(checkpoints.values()).filter((c) => c.sessionId === sessionId);
    },

    deleteCheckpoint(checkpointId: string): Promise<void> {
      checkpoints.delete(checkpointId);
      return Promise.resolve();
    },

    // Todo operations (not needed for these tests)
    createTodo(): Promise<any> {
      throw new Error('Not implemented');
    },
    getTodo(): Promise<any> {
      throw new Error('Not implemented');
    },
    updateTodo(): Promise<any> {
      throw new Error('Not implemented');
    },
    deleteTodo(): Promise<void> {
      throw new Error('Not implemented');
    },
    listTodos(): Promise<any[]> {
      return Promise.resolve([]);
    },
    batchCreateTodos(): Promise<any[]> {
      throw new Error('Not implemented');
    },
    batchUpdateTodos(): Promise<any[]> {
      throw new Error('Not implemented');
    },

    // Transaction support
    transaction<T>(fn: (tx: StorageAdapter) => Promise<T>): Promise<T> {
      return fn(this);
    },
  };
};

describe('SessionManager', () => {
  let manager: SessionManager;
  let storage: StorageAdapter;

  beforeEach(() => {
    storage = createMockStorageAdapter();
    manager = new SessionManager(storage);
  });

  describe('createSession', () => {
    it('should create a new session with default values', async () => {
      const session = await manager.createSession({
        goal: 'Test goal',
      });

      expect(session).toBeDefined();
      expect(session.id).toBeDefined();
      expect(session.goal).toBe('Test goal');
      expect(session.initialGoal).toBe('Test goal');
      expect(session.agentType).toBe('InteractiveAgent');
      expect(session.autoRun).toBe(false);
      expect(session.depth).toBe(0);
      expect(session.isSubAgent).toBe(false);
      expect(session.isRunning).toBe(false);
      expect(session.isDeleted).toBe(false);
      expect(session.status).toBe('active');
    });

    it('should create a session with custom options', async () => {
      const session = await manager.createSession({
        goal: 'Test goal',
        userId: 'user-123',
        organizationId: 'org-456',
        agentType: 'AutoAgent',
        autoRun: true,
      });

      expect(session.userId).toBe('user-123');
      expect(session.organizationId).toBe('org-456');
      expect(session.agentType).toBe('AutoAgent');
      expect(session.autoRun).toBe(true);
    });

    it('should create a sub-agent session', async () => {
      const parentSession = await manager.createSession({
        goal: 'Parent goal',
      });

      const subSession = await manager.createSession({
        goal: 'Sub goal',
        parentSessionId: parentSession.id,
        depth: 1,
        inheritedContext: 'Parent context',
      });

      expect(subSession.parentSessionId).toBe(parentSession.id);
      expect(subSession.depth).toBe(1);
      expect(subSession.inheritedContext).toBe('Parent context');
      expect(subSession.isSubAgent).toBe(true);
    });
  });

  describe('getSession', () => {
    it('should get an existing session', async () => {
      const created = await manager.createSession({
        goal: 'Test goal',
      });

      const retrieved = await manager.getSession(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
    });

    it('should return null for non-existent session', async () => {
      const retrieved = await manager.getSession('non-existent');

      expect(retrieved).toBeNull();
    });
  });

  describe('resumeSession', () => {
    it('should resume a paused session', async () => {
      const session = await manager.createSession({
        goal: 'Test goal',
      });

      await manager.markAsPaused(session.id);

      const resumed = await manager.resumeSession(session.id);

      expect(resumed.status).toBe('active');
      expect(resumed.isRunning).toBe(false);
    });

    it('should resume a stopped session', async () => {
      const session = await manager.createSession({
        goal: 'Test goal',
      });

      await manager.markAsStopped(session.id);

      const resumed = await manager.resumeSession(session.id);

      expect(resumed.status).toBe('active');
    });

    it('should throw error for completed session', async () => {
      const session = await manager.createSession({
        goal: 'Test goal',
      });

      await manager.markAsCompleted(session.id);

      await expect(manager.resumeSession(session.id)).rejects.toThrow('already completed');
    });

    it('should throw error for non-existent session', async () => {
      await expect(manager.resumeSession('non-existent')).rejects.toThrow('not found');
    });

    it('should throw error for deleted session', async () => {
      const session = await manager.createSession({
        goal: 'Test goal',
      });

      await manager.deleteSession(session.id);

      await expect(manager.resumeSession(session.id)).rejects.toThrow('deleted');
    });

    it('should reset running state', async () => {
      const session = await manager.createSession({
        goal: 'Test goal',
      });

      await manager.markAsRunning(session.id);

      const resumed = await manager.resumeSession(session.id);

      expect(resumed.isRunning).toBe(false);
    });
  });

  describe('status management', () => {
    it('should mark session as running', async () => {
      const session = await manager.createSession({
        goal: 'Test goal',
      });

      const updated = await manager.markAsRunning(session.id);

      expect(updated.isRunning).toBe(true);
      expect(updated.status).toBe('active');
    });

    it('should mark session as stopped', async () => {
      const session = await manager.createSession({
        goal: 'Test goal',
      });

      const updated = await manager.markAsStopped(session.id);

      expect(updated.isRunning).toBe(false);
      expect(updated.status).toBe('stopped');
    });

    it('should mark session as completed', async () => {
      const session = await manager.createSession({
        goal: 'Test goal',
      });

      const updated = await manager.markAsCompleted(session.id, 'Task completed successfully');

      expect(updated.isRunning).toBe(false);
      expect(updated.status).toBe('completed');
      expect(updated.resultSummary).toBe('Task completed successfully');
    });

    it('should mark session as failed', async () => {
      const session = await manager.createSession({
        goal: 'Test goal',
      });

      const updated = await manager.markAsFailed(session.id, 'Error occurred');

      expect(updated.isRunning).toBe(false);
      expect(updated.status).toBe('failed');
      expect(updated.resultSummary).toBe('Error occurred');
    });

    it('should mark session as paused', async () => {
      const session = await manager.createSession({
        goal: 'Test goal',
      });

      const updated = await manager.markAsPaused(session.id);

      expect(updated.isRunning).toBe(false);
      expect(updated.status).toBe('paused');
    });
  });

  describe('loadHistory', () => {
    it('should load session history', async () => {
      const session = await manager.createSession({
        goal: 'Test goal',
      });

      // Create some steps
      await storage.createStep({
        sessionId: session.id,
        stepNumber: 1,
        action: 'CallTool',
        status: 'completed',
        discarded: false,
        isParallel: false,
      });

      await storage.createStep({
        sessionId: session.id,
        stepNumber: 2,
        action: 'Finish',
        status: 'completed',
        discarded: false,
        isParallel: false,
      });

      const history = await manager.loadHistory(session.id);

      expect(history).toHaveLength(2);
      expect(history[0].stepNumber).toBe(1);
      expect(history[1].stepNumber).toBe(2);
    });

    it('should exclude discarded steps by default', async () => {
      const session = await manager.createSession({
        goal: 'Test goal',
      });

      const step1 = await storage.createStep({
        sessionId: session.id,
        stepNumber: 1,
        action: 'CallTool',
        status: 'completed',
        discarded: false,
        isParallel: false,
      });

      const step2 = await storage.createStep({
        sessionId: session.id,
        stepNumber: 2,
        action: 'CallTool',
        status: 'completed',
        discarded: false,
        isParallel: false,
      });

      // Mark step 1 as discarded
      await manager.markStepsAsDiscarded(session.id, [step1.id]);

      const history = await manager.loadHistory(session.id);

      expect(history).toHaveLength(1);
      expect(history[0].id).toBe(step2.id);
    });

    it('should include discarded steps when requested', async () => {
      const session = await manager.createSession({
        goal: 'Test goal',
      });

      await storage.createStep({
        sessionId: session.id,
        stepNumber: 1,
        action: 'CallTool',
        status: 'completed',
        discarded: true,
        isParallel: false,
      });

      const history = await manager.loadHistory(session.id, {
        includeDiscarded: true,
      });

      expect(history).toHaveLength(1);
    });
  });

  describe('checkpoint operations', () => {
    it('should create a checkpoint', async () => {
      const session = await manager.createSession({
        goal: 'Test goal',
      });

      // Create a step
      await storage.createStep({
        sessionId: session.id,
        stepNumber: 1,
        action: 'CallTool',
        status: 'completed',
        discarded: false,
        isParallel: false,
      });

      const checkpoint = await manager.createCheckpoint(session.id, {
        name: 'Test checkpoint',
      });

      expect(checkpoint).toBeDefined();
      expect(checkpoint.id).toBeDefined();
      expect(checkpoint.sessionId).toBe(session.id);
      expect(checkpoint.name).toBe('Test checkpoint');
      expect(checkpoint.sessionState.goal).toBe('Test goal');
    });

    it('should list checkpoints for a session', async () => {
      const session = await manager.createSession({
        goal: 'Test goal',
      });

      await manager.createCheckpoint(session.id, {
        name: 'Checkpoint 1',
      });
      await manager.createCheckpoint(session.id, {
        name: 'Checkpoint 2',
      });

      const checkpoints = await manager.listCheckpoints(session.id);

      expect(checkpoints).toHaveLength(2);
    });

    it('should restore from checkpoint', async () => {
      const session = await manager.createSession({
        goal: 'Original goal',
      });

      // Create steps
      const _step1 = await storage.createStep({
        sessionId: session.id,
        stepNumber: 1,
        action: 'CallTool',
        status: 'completed',
        discarded: false,
        isParallel: false,
      });

      // Create checkpoint after step 1
      const checkpoint = await manager.createCheckpoint(session.id);

      // Create more steps
      const step2 = await storage.createStep({
        sessionId: session.id,
        stepNumber: 2,
        action: 'CallTool',
        status: 'completed',
        discarded: false,
        isParallel: false,
      });

      // Restore from checkpoint
      const restored = await manager.restoreFromCheckpoint(checkpoint.id);

      expect(restored.status).toBe('active');
      expect(restored.isRunning).toBe(false);

      // Check that step 2 is marked as discarded
      const history = await manager.loadHistory(session.id, {
        includeDiscarded: true,
      });

      const restoredStep2 = history.find((s) => s.id === step2.id);
      expect(restoredStep2?.discarded).toBe(true);
    });

    it('should delete a checkpoint', async () => {
      const session = await manager.createSession({
        goal: 'Test goal',
      });

      const checkpoint = await manager.createCheckpoint(session.id);

      await manager.deleteCheckpoint(checkpoint.id);

      const retrieved = await manager.getCheckpoint(checkpoint.id);
      expect(retrieved).toBeNull();
    });
  });

  describe('stop state management', () => {
    it('should save stop state', async () => {
      const session = await manager.createSession({
        goal: 'Test goal',
      });

      await storage.createStep({
        sessionId: session.id,
        stepNumber: 1,
        action: 'CallTool',
        status: 'completed',
        discarded: false,
        isParallel: false,
      });

      const stopState = await manager.saveStopState(session.id, { partial: 'result' });

      expect(stopState.sessionId).toBe(session.id);
      expect(stopState.completedSteps).toBe(1);
      expect(stopState.partialResult).toEqual({ partial: 'result' });
      expect(stopState.canResume).toBe(true);

      const updated = await manager.getSession(session.id);
      expect(updated?.status).toBe('stopped');
      expect(updated?.isRunning).toBe(false);
    });

    it('should get stop state', async () => {
      const session = await manager.createSession({
        goal: 'Test goal',
      });

      await manager.markAsStopped(session.id);

      await storage.createStep({
        sessionId: session.id,
        stepNumber: 1,
        action: 'CallTool',
        status: 'completed',
        discarded: false,
        isParallel: false,
      });

      const stopState = await manager.getStopState(session.id);

      expect(stopState).toBeDefined();
      expect(stopState?.sessionId).toBe(session.id);
      expect(stopState?.completedSteps).toBe(1);
      expect(stopState?.canResume).toBe(true);
    });
  });

  describe('validation helpers', () => {
    it('should validate existing session', async () => {
      const session = await manager.createSession({
        goal: 'Test goal',
      });

      const validated = await manager.validateSession(session.id);

      expect(validated.id).toBe(session.id);
    });

    it('should throw error for non-existent session', async () => {
      await expect(manager.validateSession('non-existent')).rejects.toThrow('not found');
    });

    it('should throw error for deleted session', async () => {
      const session = await manager.createSession({
        goal: 'Test goal',
      });

      await manager.deleteSession(session.id);

      await expect(manager.validateSession(session.id)).rejects.toThrow('deleted');
    });

    it('should check if session is running', async () => {
      const session = await manager.createSession({
        goal: 'Test goal',
      });

      expect(await manager.isRunning(session.id)).toBe(false);

      await manager.markAsRunning(session.id);

      expect(await manager.isRunning(session.id)).toBe(true);
    });

    it('should check if session can be resumed', async () => {
      const session = await manager.createSession({
        goal: 'Test goal',
      });

      // Active session cannot be resumed (it's already running)
      expect(await manager.canResume(session.id)).toBe(false);

      // Paused session can be resumed
      await manager.markAsPaused(session.id);
      expect(await manager.canResume(session.id)).toBe(true);

      // Stopped session can be resumed
      await manager.markAsStopped(session.id);
      expect(await manager.canResume(session.id)).toBe(true);

      // Failed session can be resumed
      await manager.markAsFailed(session.id);
      expect(await manager.canResume(session.id)).toBe(true);

      // Completed session cannot be resumed
      await manager.markAsCompleted(session.id);
      expect(await manager.canResume(session.id)).toBe(false);
    });
  });

  describe('updateGoal', () => {
    it('should update session goal', async () => {
      const session = await manager.createSession({
        goal: 'Original goal',
      });

      const updated = await manager.updateGoal(session.id, 'Updated goal');

      expect(updated.goal).toBe('Updated goal');
    });
  });

  describe('getSessionWithHistory', () => {
    it('should get session with history', async () => {
      const session = await manager.createSession({
        goal: 'Test goal',
      });

      await storage.createStep({
        sessionId: session.id,
        stepNumber: 1,
        action: 'CallTool',
        status: 'completed',
        discarded: false,
        isParallel: false,
      });

      const result = await manager.getSessionWithHistory(session.id);

      expect(result.session.id).toBe(session.id);
      expect(result.history).toHaveLength(1);
    });
  });

  describe('listSessions', () => {
    it('should list sessions with filters', async () => {
      await manager.createSession({
        goal: 'Goal 1',
        userId: 'user-1',
      });

      await manager.createSession({
        goal: 'Goal 2',
        userId: 'user-2',
      });

      await manager.createSession({
        goal: 'Goal 3',
        userId: 'user-1',
      });

      const result = await manager.listSessions({
        userId: 'user-1',
      });

      expect(result.sessions).toHaveLength(2);
      expect(result.total).toBe(2);
    });
  });

  describe('compression state', () => {
    it('should mark session as compressing', async () => {
      const session = await manager.createSession({
        goal: 'Test goal',
      });

      const updated = await manager.markAsCompressing(session.id);

      expect(updated.isCompressing).toBe(true);
      expect(updated.compressingStartedAt).toBeDefined();
    });

    it('should update compression state', async () => {
      const session = await manager.createSession({
        goal: 'Test goal',
      });

      await manager.markAsCompressing(session.id);

      const updated = await manager.updateCompressionState(session.id, 5, 'Compressed summary');

      expect(updated.lastCompressedStepId).toBe(5);
      expect(updated.compressedSummary).toBe('Compressed summary');
      expect(updated.isCompressing).toBe(false);
    });
  });
});
