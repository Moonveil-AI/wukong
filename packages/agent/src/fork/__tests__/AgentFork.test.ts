/**
 * Agent Fork Tests
 *
 * Tests for the Agent Fork system including sub-agent creation,
 * context compression, result summarization, and depth limits.
 */

import { EventEmitter } from 'eventemitter3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ForkAgentTask, Session, Step, StorageAdapter } from '../../types/index';
import { AgentFork } from '../AgentFork';

// Mock storage adapter
class MockStorageAdapter implements Partial<StorageAdapter> {
  private tasks = new Map<string, ForkAgentTask>();
  private sessions = new Map<string, Session>();
  private taskIdCounter = 1;

  async createForkAgentTask(
    task: Omit<ForkAgentTask, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<ForkAgentTask> {
    const id = `task-${this.taskIdCounter++}`;
    const now = new Date();

    const newTask: ForkAgentTask = {
      ...task,
      id,
      createdAt: now,
      updatedAt: now,
    };

    this.tasks.set(id, newTask);
    return newTask;
  }

  async getForkAgentTask(taskId: string): Promise<ForkAgentTask | null> {
    return this.tasks.get(taskId) || null;
  }

  async updateForkAgentTask(
    taskId: string,
    updates: Partial<ForkAgentTask>,
  ): Promise<ForkAgentTask> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    const updatedTask = {
      ...task,
      ...updates,
      updatedAt: new Date(),
    };

    this.tasks.set(taskId, updatedTask);
    return updatedTask;
  }

  async listForkAgentTasks(sessionId: string): Promise<ForkAgentTask[]> {
    return Array.from(this.tasks.values()).filter((task) => task.parentSessionId === sessionId);
  }

  async getSession(sessionId: string): Promise<Session | null> {
    return this.sessions.get(sessionId) || null;
  }

  async createSession(session: Omit<Session, 'id' | 'createdAt' | 'updatedAt'>): Promise<Session> {
    const id = `session-${Date.now()}`;
    const now = new Date();

    const newSession: Session = {
      ...session,
      id,
      createdAt: now,
      updatedAt: now,
      agentType: session.agentType || 'AutoAgent',
      autoRun: session.autoRun ?? true,
      depth: session.depth ?? 0,
      isSubAgent: session.isSubAgent ?? false,
      lastCompressedStepId: session.lastCompressedStepId ?? -1,
      isCompressing: session.isCompressing ?? false,
      isRunning: session.isRunning ?? true,
      isDeleted: session.isDeleted ?? false,
      status: session.status || 'active',
    } as Session;

    this.sessions.set(id, newSession);
    return newSession;
  }

  async listSteps(_sessionId: string): Promise<Step[]> {
    return [];
  }

  async createStep(step: Omit<Step, 'id' | 'createdAt' | 'updatedAt'>): Promise<Step> {
    const now = new Date();
    return {
      ...step,
      id: Date.now(),
      createdAt: now,
      updatedAt: now,
    } as Step;
  }

  // Add other required methods as stubs
  async updateSession(sessionId: string, updates: Partial<Session>): Promise<Session> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');
    const updated = { ...session, ...updates, updatedAt: new Date() };
    this.sessions.set(sessionId, updated);
    return updated;
  }
}

// Mock LLM caller
class MockLLMCaller {
  async call(prompt: string): Promise<string> {
    if (prompt.includes('compress')) {
      return 'Compressed context: Key information preserved.';
    }
    if (prompt.includes('summarize')) {
      return 'Result summary: Task completed successfully.';
    }
    return 'LLM response';
  }
}

describe('AgentFork', () => {
  let agentFork: AgentFork;
  let storageAdapter: MockStorageAdapter;
  let llmCaller: MockLLMCaller;
  let eventEmitter: EventEmitter;
  let consoleErrorSpy: any;

  beforeEach(() => {
    storageAdapter = new MockStorageAdapter() as any;
    llmCaller = new MockLLMCaller() as any;
    eventEmitter = new EventEmitter();

    // Suppress console.error for tests
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    agentFork = new AgentFork(
      storageAdapter as any,
      llmCaller as any,
      eventEmitter,
      [], // tools
      {}, // apiKeys
    );
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('forkAutoAgent', () => {
    it('should create a fork task correctly', async () => {
      const taskId = await agentFork.forkAutoAgent({
        goal: 'Generate video script',
        contextSummary: 'Product is AI assistant',
        parentSessionId: 'parent-session-1',
        currentDepth: 0,
        maxSteps: 20,
        timeoutSeconds: 300,
      });

      expect(taskId).toBeDefined();
      expect(taskId).toMatch(/^task-/);

      const task = await storageAdapter.getForkAgentTask(taskId);
      expect(task).toBeDefined();
      expect(task?.goal).toBe('Generate video script');
      expect(task?.depth).toBe(1);
      // Status could be 'pending' or 'running' depending on timing
      expect(['pending', 'running']).toContain(task?.status);
    });

    it('should emit subagent:started event', async () => {
      const onStarted = vi.fn();
      eventEmitter.on('subagent:started', onStarted);

      await agentFork.forkAutoAgent({
        goal: 'Test task',
        parentSessionId: 'parent-1',
        currentDepth: 0,
      });

      // Wait for event to be emitted
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(onStarted).toHaveBeenCalled();
      const eventData = onStarted.mock.calls[0][0];
      expect(eventData.goal).toBe('Test task');
      expect(eventData.depth).toBe(1);
    });

    it('should enforce depth limits', async () => {
      await expect(
        agentFork.forkAutoAgent({
          goal: 'Test task',
          parentSessionId: 'parent-1',
          currentDepth: 3,
          maxDepth: 3,
        }),
      ).rejects.toThrow(/Maximum fork depth.*exceeded/);
    });

    it('should use default values when not specified', async () => {
      const taskId = await agentFork.forkAutoAgent({
        goal: 'Test task',
        parentSessionId: 'parent-1',
        currentDepth: 0,
      });

      const task = await storageAdapter.getForkAgentTask(taskId);
      expect(task?.maxSteps).toBe(20); // DEFAULT_MAX_STEPS
      expect(task?.timeoutSeconds).toBe(300); // DEFAULT_TIMEOUT_SECONDS
    });
  });

  describe('compressContext', () => {
    it('should return short context as-is', async () => {
      const shortContext = 'This is a short context';
      const compressed = await agentFork.compressContext(shortContext, {
        maxLength: 500,
      });

      expect(compressed).toBe(shortContext);
    });

    it('should compress long context using LLM', async () => {
      const longContext = 'A'.repeat(1000);
      const compressed = await agentFork.compressContext(longContext, {
        maxLength: 100,
      });

      expect(compressed).toBeDefined();
      expect(compressed.length).toBeLessThanOrEqual(100);
      expect(compressed).toContain('Compressed context');
    });

    it('should fallback to truncation if LLM fails', async () => {
      // Mock LLM to throw error
      const failingLLM = {
        call: async () => {
          throw new Error('LLM error');
        },
      };

      const fork = new AgentFork(storageAdapter as any, failingLLM as any, eventEmitter, [], {});

      const longContext = 'A'.repeat(1000);
      const compressed = await fork.compressContext(longContext, {
        maxLength: 100,
      });

      expect(compressed.length).toBeLessThanOrEqual(103); // 100 + '...'
      expect(compressed).toContain('...');
    });
  });

  describe('compressResult', () => {
    it('should return short result as-is', async () => {
      const shortResult = 'Task completed successfully';
      const compressed = await agentFork.compressResult(shortResult, 500);

      expect(compressed).toBe(shortResult);
    });

    it('should compress long result using LLM', async () => {
      const longResult = { data: 'A'.repeat(1000) };
      const compressed = await agentFork.compressResult(longResult, 100);

      expect(compressed).toBeDefined();
      expect(compressed.length).toBeLessThanOrEqual(100);
      expect(compressed).toContain('Result summary');
    });

    it('should handle object results', async () => {
      const objectResult = {
        status: 'completed',
        data: { items: [1, 2, 3] },
      };
      const compressed = await agentFork.compressResult(objectResult, 50);

      expect(compressed).toBeDefined();
      expect(typeof compressed).toBe('string');
    });
  });

  describe('getSubAgents', () => {
    it('should return sub-agents for a parent session', async () => {
      // Create multiple sub-agents
      await agentFork.forkAutoAgent({
        goal: 'Task 1',
        parentSessionId: 'parent-1',
        currentDepth: 0,
      });

      await agentFork.forkAutoAgent({
        goal: 'Task 2',
        parentSessionId: 'parent-1',
        currentDepth: 0,
      });

      await agentFork.forkAutoAgent({
        goal: 'Task 3',
        parentSessionId: 'parent-2',
        currentDepth: 0,
      });

      const subAgents = await agentFork.getSubAgents('parent-1');
      expect(subAgents).toHaveLength(2);
      expect(subAgents.every((task) => task.parentSessionId === 'parent-1')).toBe(true);
    });

    it('should return empty array if no sub-agents exist', async () => {
      const subAgents = await agentFork.getSubAgents('nonexistent');
      expect(subAgents).toEqual([]);
    });
  });

  describe('getParentSession', () => {
    it('should return parent session for a sub-agent', async () => {
      // Create parent session
      const parentSession = await storageAdapter.createSession({
        goal: 'Parent goal',
        status: 'active',
        agentType: 'AutoAgent',
        autoRun: true,
        depth: 0,
        isSubAgent: false,
        lastCompressedStepId: -1,
        isCompressing: false,
        isRunning: true,
        isDeleted: false,
      });

      // Create sub-agent session
      const subSession = await storageAdapter.createSession({
        goal: 'Sub-agent goal',
        status: 'active',
        agentType: 'AutoAgent',
        autoRun: true,
        depth: 1,
        isSubAgent: true,
        parentSessionId: parentSession.id,
        lastCompressedStepId: -1,
        isCompressing: false,
        isRunning: true,
        isDeleted: false,
      });

      const parent = await agentFork.getParentSession(subSession.id);
      expect(parent).toBeDefined();
      expect(parent?.id).toBe(parentSession.id);
    });

    it('should return null if no parent exists', async () => {
      const session = await storageAdapter.createSession({
        goal: 'Root session',
        status: 'active',
        agentType: 'AutoAgent',
        autoRun: true,
        depth: 0,
        isSubAgent: false,
        lastCompressedStepId: -1,
        isCompressing: false,
        isRunning: true,
        isDeleted: false,
      });

      const parent = await agentFork.getParentSession(session.id);
      expect(parent).toBeNull();
    });
  });

  describe('waitForSubAgent', () => {
    it('should wait for sub-agent completion', async () => {
      const taskId = await agentFork.forkAutoAgent({
        goal: 'Test task',
        parentSessionId: 'parent-1',
        currentDepth: 0,
      });

      // Simulate task completion after a delay
      setTimeout(async () => {
        await storageAdapter.updateForkAgentTask(taskId, {
          status: 'completed',
          subSessionId: 'sub-session-1',
          resultSummary: 'Task completed successfully',
          stepsExecuted: 5,
          tokensUsed: 1000,
          executionDurationMs: 5000,
        });
      }, 100);

      const result = await agentFork.waitForSubAgent(taskId);
      expect(result.sessionId).toBe('sub-session-1');
      expect(result.summary).toBe('Task completed successfully');
      expect(result.stepsExecuted).toBe(5);
      expect(result.tokensUsed).toBe(1000);
    });

    it('should throw error if task fails', async () => {
      const taskId = await agentFork.forkAutoAgent({
        goal: 'Test task',
        parentSessionId: 'parent-1',
        currentDepth: 0,
      });

      // Simulate task failure
      setTimeout(async () => {
        await storageAdapter.updateForkAgentTask(taskId, {
          status: 'failed',
          errorMessage: 'Test error',
        });
      }, 100);

      await expect(agentFork.waitForSubAgent(taskId)).rejects.toThrow('Test error');
    });

    it('should throw error if task times out', async () => {
      const taskId = await agentFork.forkAutoAgent({
        goal: 'Test task',
        parentSessionId: 'parent-1',
        currentDepth: 0,
      });

      // Simulate task timeout
      setTimeout(async () => {
        await storageAdapter.updateForkAgentTask(taskId, {
          status: 'timeout',
          errorMessage: 'Execution timeout',
        });
      }, 100);

      await expect(agentFork.waitForSubAgent(taskId)).rejects.toThrow('Execution timeout');
    });
  });

  describe('waitForMultipleSubAgents', () => {
    it('should wait for multiple sub-agents to complete', async () => {
      const taskId1 = await agentFork.forkAutoAgent({
        goal: 'Task 1',
        parentSessionId: 'parent-1',
        currentDepth: 0,
      });

      const taskId2 = await agentFork.forkAutoAgent({
        goal: 'Task 2',
        parentSessionId: 'parent-1',
        currentDepth: 0,
      });

      // Simulate task completions
      setTimeout(async () => {
        await storageAdapter.updateForkAgentTask(taskId1, {
          status: 'completed',
          subSessionId: 'sub-1',
          resultSummary: 'Task 1 completed',
          stepsExecuted: 3,
          tokensUsed: 500,
          executionDurationMs: 3000,
        });

        await storageAdapter.updateForkAgentTask(taskId2, {
          status: 'completed',
          subSessionId: 'sub-2',
          resultSummary: 'Task 2 completed',
          stepsExecuted: 4,
          tokensUsed: 600,
          executionDurationMs: 4000,
        });
      }, 100);

      const results = await agentFork.waitForMultipleSubAgents([taskId1, taskId2]);
      expect(results).toHaveLength(2);
      expect(results[0].summary).toBe('Task 1 completed');
      expect(results[1].summary).toBe('Task 2 completed');
    });
  });
});
