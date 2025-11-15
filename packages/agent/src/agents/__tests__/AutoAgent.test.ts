/**
 * Tests for AutoAgent
 */

import EventEmitter from 'eventemitter3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StorageAdapter } from '../../types/adapters.js';
import type { Session, Step, Tool } from '../../types/index.js';
import { AutoAgent, type KnowledgeBase, type LLMCaller } from '../AutoAgent.js';

// Mock storage adapter
const createMockStorageAdapter = (): StorageAdapter => {
  const sessions = new Map<string, Session>();
  const steps = new Map<string, Step[]>();
  let sessionIdCounter = 1;
  let stepIdCounter = 1;

  return {
    // Session management
    createSession(data: Partial<Session>): Promise<Session> {
      const session: Session = {
        id: `session-${sessionIdCounter++}`,
        goal: data.goal || '',
        status: 'active',
        agentType: data.agentType || 'AutoAgent',
        autoRun: data.autoRun ?? true,
        userId: data.userId,
        organizationId: data.organizationId,
        depth: data.depth ?? 0,
        isSubAgent: data.isSubAgent ?? false,
        lastCompressedStepId: 0,
        isCompressing: false,
        isRunning: true,
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      sessions.set(session.id, session);
      steps.set(session.id, []);
      return Promise.resolve(session);
    },

    getSession(sessionId: string): Promise<Session | null> {
      return Promise.resolve(sessions.get(sessionId) || null);
    },

    updateSession(sessionId: string, updates: Partial<Session>): Promise<void> {
      const session = sessions.get(sessionId);
      if (session) {
        Object.assign(session, updates, { updatedAt: new Date() });
      }
      return Promise.resolve();
    },

    deleteSession(_sessionId: string): Promise<void> {
      // Not needed for tests
      return Promise.resolve();
    },

    listSessions(_filters?: any): Promise<Session[]> {
      return Promise.resolve(Array.from(sessions.values()));
    },

    // Step management
    createStep(data: Partial<Step>): Promise<Step> {
      const step: Step = {
        id: stepIdCounter++,
        sessionId: data.sessionId || '',
        stepNumber: data.stepNumber || 0,
        action: data.action || 'Plan',
        status: data.status || 'pending',
        discarded: false,
        isParallel: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data,
      };

      const sessionSteps = steps.get(step.sessionId) || [];
      sessionSteps.push(step);
      steps.set(step.sessionId, sessionSteps);

      return Promise.resolve(step);
    },

    getStep(sessionId: string, stepId: number): Promise<Step | null> {
      const sessionSteps = steps.get(sessionId) || [];
      return Promise.resolve(sessionSteps.find((s) => s.id === stepId) || null);
    },

    updateStep(stepId: number, updates: Partial<Step>): Promise<Step> {
      // Find step across all sessions
      for (const [_sessionId, sessionSteps] of steps.entries()) {
        const step = sessionSteps.find((s) => s.id === stepId);
        if (step) {
          Object.assign(step, updates, { updatedAt: new Date() });
          return Promise.resolve(step);
        }
      }
      throw new Error(`Step ${stepId} not found`);
    },

    listSteps(sessionId: string, _options?: any): Promise<Step[]> {
      return Promise.resolve(steps.get(sessionId) || []);
    },

    markStepsAsDiscarded(_sessionId: string, _stepIds: number[]): Promise<void> {
      // No-op for tests
      return Promise.resolve();
    },

    // Checkpoint management (not needed for these tests)
    createCheckpoint(): Promise<any> {
      return Promise.resolve({ id: 'checkpoint-1' });
    },
    getCheckpoint(): Promise<any> {
      return Promise.resolve(null);
    },
    listCheckpoints(): Promise<any[]> {
      return Promise.resolve([]);
    },
    deleteCheckpoint(): Promise<void> {
      // No-op for tests
      return Promise.resolve();
    },

    // Todo management (not needed for these tests)
    createTodo(): Promise<any> {
      return Promise.resolve({ id: 'todo-1' });
    },
    getTodo(): Promise<any> {
      return Promise.resolve(null);
    },
    updateTodo(): Promise<void> {
      // No-op for tests
      return Promise.resolve();
    },
    listTodos(): Promise<any[]> {
      return Promise.resolve([]);
    },
    deleteTodo(): Promise<void> {
      // No-op for tests
      return Promise.resolve();
    },
  };
};

// Mock LLM caller
const createMockLLMCaller = (responses: string[] = []): LLMCaller => {
  let callIndex = 0;
  return {
    call(_prompt: string): Promise<string> {
      if (callIndex >= responses.length) {
        return Promise.resolve(`<final_output>
{
  "action": "Finish",
  "reasoning": "Task completed",
  "finalResult": "Done",
  "summary": "Completed successfully"
}
</final_output>`);
      }
      return Promise.resolve(responses[callIndex++]);
    },
  };
};

// Mock knowledge base
const createMockKnowledgeBase = (results: any[] = []): KnowledgeBase => {
  return {
    search(_query: string, _options?: any): Promise<any[]> {
      return Promise.resolve(results);
    },
  };
};

describe('AutoAgent', () => {
  let storageAdapter: StorageAdapter;
  let llmCaller: LLMCaller;
  let eventEmitter: EventEmitter;
  let knowledgeBase: KnowledgeBase;
  let tools: Tool[];

  beforeEach(() => {
    storageAdapter = createMockStorageAdapter();
    llmCaller = createMockLLMCaller();
    eventEmitter = new EventEmitter();
    knowledgeBase = createMockKnowledgeBase();
    tools = [];
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with required options', () => {
      const agent = new AutoAgent({
        storageAdapter,
        llmCaller,
        eventEmitter,
        tools,
      });

      expect(agent).toBeDefined();
    });

    it('should use default values for optional parameters', () => {
      const agent = new AutoAgent({
        storageAdapter,
        llmCaller,
        eventEmitter,
        tools,
      });

      expect(agent).toBeDefined();
    });

    it('should accept custom configuration', () => {
      const agent = new AutoAgent({
        storageAdapter,
        llmCaller,
        eventEmitter,
        tools,
        knowledgeBase,
        enableToolExecutor: false,
        companyName: 'Test Corp',
        maxSteps: 50,
        timeoutSeconds: 1800,
      });

      expect(agent).toBeDefined();
    });
  });

  describe('execute', () => {
    it('should run autonomously without user interaction', async () => {
      llmCaller = createMockLLMCaller([
        `<final_output>
{
  "action": "CallTool",
  "reasoning": "Analyzing data",
  "selectedTool": "analyze_tool",
  "parameters": { "data": "test" }
}
</final_output>`,
        `<final_output>
{
  "action": "Finish",
  "reasoning": "Analysis complete",
  "finalResult": { "result": "success" },
  "summary": "Data analyzed successfully"
}
</final_output>`,
      ]);

      const agent = new AutoAgent({
        storageAdapter,
        llmCaller,
        eventEmitter,
        tools: [
          {
            metadata: {
              name: 'analyze_tool',
              description: 'Analyzes data',
              version: '1.0.0',
              category: 'data',
              riskLevel: 'low',
              timeout: 30,
              requiresConfirmation: false,
              async: false,
              estimatedTime: 5,
            },
            schema: {
              type: 'object',
              properties: {},
            },
            handler: async () => ({ success: true, result: { analyzed: true } }),
          },
        ],
      });

      let sessionCreated = false;
      let taskCompleted = false;

      eventEmitter.on('session:created', () => {
        sessionCreated = true;
      });

      eventEmitter.on('task:completed', () => {
        taskCompleted = true;
      });

      const result = await agent.execute({
        goal: 'Analyze data',
        maxSteps: 10,
      });

      expect(result.status).toBe('completed');
      expect(result.stepsExecuted).toBeGreaterThan(0);
      expect(sessionCreated).toBe(true);
      expect(taskCompleted).toBe(true);
    });

    it('should search knowledge base on first step', async () => {
      const knowledgeResults = [
        {
          id: 'kb-1',
          content: 'Relevant knowledge',
          score: 0.9,
          metadata: { level: 'public' },
        },
      ];

      knowledgeBase = createMockKnowledgeBase(knowledgeResults);
      let knowledgeSearched = false;
      let knowledgeFound = false;

      eventEmitter.on('knowledge:searching', () => {
        knowledgeSearched = true;
      });

      eventEmitter.on('knowledge:found', () => {
        knowledgeFound = true;
      });

      const agent = new AutoAgent({
        storageAdapter,
        llmCaller,
        eventEmitter,
        tools,
        knowledgeBase,
      });

      await agent.execute({
        goal: 'Test goal with knowledge',
        maxSteps: 5,
      });

      expect(knowledgeSearched).toBe(true);
      expect(knowledgeFound).toBe(true);
    });

    it('should respect maxSteps limit', async () => {
      // Create infinite loop of non-finishing actions
      llmCaller = createMockLLMCaller([
        ...Array(20).fill(`<final_output>
{
  "action": "CallTool",
  "reasoning": "Keep going",
  "selectedTool": "test_tool",
  "parameters": {}
}
</final_output>`),
      ]);

      const agent = new AutoAgent({
        storageAdapter,
        llmCaller,
        eventEmitter,
        tools: [
          {
            metadata: {
              name: 'test_tool',
              description: 'Test tool',
              version: '1.0.0',
              category: 'other',
              riskLevel: 'low',
              timeout: 30,
              requiresConfirmation: false,
              async: false,
              estimatedTime: 1,
            },
            schema: { type: 'object', properties: {} },
            handler: async () => ({ success: true }),
          },
        ],
      });

      const maxSteps = 5;
      const result = await agent.execute({
        goal: 'Test max steps',
        maxSteps,
      });

      expect(result.status).toBe('failed');
      expect(result.stepsExecuted).toBe(maxSteps);
      expect(result.error).toContain('Max steps reached');
    });

    it('should handle timeout', async () => {
      llmCaller = {
        async call() {
          // Simulate slow response
          await new Promise((resolve) => setTimeout(resolve, 100));
          return `<final_output>
{
  "action": "CallTool",
  "reasoning": "Testing",
  "selectedTool": "test_tool",
  "parameters": {}
}
</final_output>`;
        },
      };

      const agent = new AutoAgent({
        storageAdapter,
        llmCaller,
        eventEmitter,
        tools: [
          {
            metadata: {
              name: 'test_tool',
              description: 'Test tool',
              version: '1.0.0',
              category: 'other',
              riskLevel: 'low',
              timeout: 30,
              requiresConfirmation: false,
              async: false,
              estimatedTime: 1,
            },
            schema: { type: 'object', properties: {} },
            handler: async () => ({ success: true }),
          },
        ],
      });

      let timeoutEmitted = false;
      eventEmitter.on('task:timeout', () => {
        timeoutEmitted = true;
      });

      const result = await agent.execute({
        goal: 'Test timeout',
        timeout: 0.05, // 50ms timeout
      });

      expect(result.status).toBe('timeout');
      expect(timeoutEmitted).toBe(true);
    });

    it('should emit progress events', async () => {
      llmCaller = createMockLLMCaller([
        `<final_output>
{
  "action": "CallTool",
  "reasoning": "Step 1",
  "selectedTool": "test_tool",
  "parameters": {}
}
</final_output>`,
        `<final_output>
{
  "action": "Finish",
  "reasoning": "Done",
  "finalResult": "complete"
}
</final_output>`,
      ]);

      const agent = new AutoAgent({
        storageAdapter,
        llmCaller,
        eventEmitter,
        tools: [
          {
            metadata: {
              name: 'test_tool',
              description: 'Test tool',
              version: '1.0.0',
              category: 'other',
              riskLevel: 'low',
              timeout: 30,
              requiresConfirmation: false,
              async: false,
              estimatedTime: 1,
            },
            schema: { type: 'object', properties: {} },
            handler: async () => ({ success: true }),
          },
        ],
      });

      const progressEvents: any[] = [];
      eventEmitter.on('progress:updated', (event) => {
        progressEvents.push(event);
      });

      await agent.execute({
        goal: 'Test progress',
        maxSteps: 10,
      });

      expect(progressEvents.length).toBeGreaterThan(0);
    });

    it('should handle discardable steps', async () => {
      llmCaller = createMockLLMCaller([
        `<final_output>
{
  "action": "CallTool",
  "reasoning": "Step 1",
  "selectedTool": "test_tool",
  "parameters": {}
}
</final_output>`,
        `<final_output>
{
  "action": "Finish",
  "reasoning": "Done",
  "finalResult": "complete",
  "discardableSteps": [1]
}
</final_output>`,
      ]);

      const agent = new AutoAgent({
        storageAdapter,
        llmCaller,
        eventEmitter,
        tools: [
          {
            metadata: {
              name: 'test_tool',
              description: 'Test tool',
              version: '1.0.0',
              category: 'other',
              riskLevel: 'low',
              timeout: 30,
              requiresConfirmation: false,
              async: false,
              estimatedTime: 1,
            },
            schema: { type: 'object', properties: {} },
            handler: async () => ({ success: true }),
          },
        ],
      });

      let stepsDiscarded = false;
      eventEmitter.on('steps:discarded', () => {
        stepsDiscarded = true;
      });

      await agent.execute({
        goal: 'Test discarding',
        maxSteps: 10,
      });

      expect(stepsDiscarded).toBe(true);
    });
  });

  describe('requestStop', () => {
    it('should stop gracefully', async () => {
      llmCaller = {
        async call() {
          // Simulate slow response
          await new Promise((resolve) => setTimeout(resolve, 50));
          return `<final_output>
{
  "action": "CallTool",
  "reasoning": "Testing",
  "selectedTool": "test_tool",
  "parameters": {}
}
</final_output>`;
        },
      };

      const agent = new AutoAgent({
        storageAdapter,
        llmCaller,
        eventEmitter,
        tools: [
          {
            metadata: {
              name: 'test_tool',
              description: 'Test tool',
              version: '1.0.0',
              category: 'other',
              riskLevel: 'low',
              timeout: 30,
              requiresConfirmation: false,
              async: false,
              estimatedTime: 1,
            },
            schema: { type: 'object', properties: {} },
            handler: async () => ({ success: true }),
          },
        ],
      });

      let stoppingEmitted = false;
      let stoppedEmitted = false;

      eventEmitter.on('task:stopping', () => {
        stoppingEmitted = true;
      });

      eventEmitter.on('task:stopped', () => {
        stoppedEmitted = true;
      });

      // Start execution and request stop after a delay
      const executionPromise = agent.execute({
        goal: 'Test stop',
        maxSteps: 100,
      });

      setTimeout(() => {
        agent.requestStop(true);
      }, 30);

      const result = await executionPromise;

      expect(result.status).toBe('stopped');
      expect(stoppingEmitted).toBe(true);
      expect(stoppedEmitted).toBe(true);
    });
  });

  describe('resume', () => {
    it('should resume a paused session', async () => {
      const agent = new AutoAgent({
        storageAdapter,
        llmCaller,
        eventEmitter,
        tools,
      });

      // Create a session
      const session = await storageAdapter.createSession({
        goal: 'Test resume',
        agentType: 'AutoAgent',
        autoRun: true,
      });

      // Update it to paused status
      await storageAdapter.updateSession(session.id, {
        status: 'paused',
      });

      // Resume should work
      const result = await agent.resume(session.id);
      expect(result).toBeDefined();
    });

    it('should throw error if session not found', async () => {
      const agent = new AutoAgent({
        storageAdapter,
        llmCaller,
        eventEmitter,
        tools,
      });

      await expect(agent.resume('non-existent')).rejects.toThrow('not found');
    });

    it('should throw error if session is not paused', async () => {
      const agent = new AutoAgent({
        storageAdapter,
        llmCaller,
        eventEmitter,
        tools,
      });

      const session = await storageAdapter.createSession({
        goal: 'Test',
        agentType: 'AutoAgent',
        autoRun: true,
        status: 'active',
      });

      await expect(agent.resume(session.id)).rejects.toThrow('not paused');
    });
  });

  describe('error handling', () => {
    it('should handle LLM errors gracefully', async () => {
      llmCaller = {
        call() {
          return Promise.reject(new Error('LLM API error'));
        },
      };

      const agent = new AutoAgent({
        storageAdapter,
        llmCaller,
        eventEmitter,
        tools,
      });

      let failedEmitted = false;
      eventEmitter.on('task:failed', () => {
        failedEmitted = true;
      });

      const result = await agent.execute({
        goal: 'Test error',
        maxSteps: 5,
      });

      expect(result.status).toBe('failed');
      expect(result.error).toContain('LLM API error');
      expect(failedEmitted).toBe(true);
    });

    it('should handle knowledge base errors gracefully', async () => {
      knowledgeBase = {
        search() {
          return Promise.reject(new Error('Knowledge base error'));
        },
      };

      let knowledgeError = false;
      eventEmitter.on('knowledge:error', () => {
        knowledgeError = true;
      });

      const agent = new AutoAgent({
        storageAdapter,
        llmCaller,
        eventEmitter,
        tools,
        knowledgeBase,
      });

      const result = await agent.execute({
        goal: 'Test KB error',
        maxSteps: 5,
      });

      // Should continue execution even if knowledge search fails
      expect(knowledgeError).toBe(true);
      expect(result.status).toBe('completed');
    });
  });
});
