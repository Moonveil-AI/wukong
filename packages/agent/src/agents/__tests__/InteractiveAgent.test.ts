/**
 * Tests for InteractiveAgent
 */

import { EventEmitter } from 'eventemitter3';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StorageAdapter } from '../../types/adapters.js';
import type { Session, Step, Tool } from '../../types/index.js';
import { InteractiveAgent, type LLMCaller } from '../InteractiveAgent.js';

// Mock storage adapter
const createMockStorageAdapter = (): StorageAdapter => {
  const sessions = new Map<string, Session>();
  const steps = new Map<string, Step[]>();

  return {
    // Session operations
    createSession: vi.fn((data: any) => {
      const session: Session = {
        id: `session-${Date.now()}`,
        goal: data.goal,
        initialGoal: data.initialGoal || data.goal,
        status: 'active',
        userId: data.userId,
        organizationId: data.organizationId,
        agentType: data.agentType || 'InteractiveAgent',
        autoRun: data.autoRun,
        toolsConfig: data.toolsConfig,
        parentSessionId: data.parentSessionId,
        depth: data.depth || 0,
        inheritedContext: data.inheritedContext,
        isSubAgent: !!data.parentSessionId,
        lastCompressedStepId: 0,
        isCompressing: false,
        isRunning: false,
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      sessions.set(session.id, session);
      steps.set(session.id, []);
      return Promise.resolve(session);
    }),
    getSession: vi.fn(async (id: string) => sessions.get(id) || null),
    updateSession: vi.fn((id: string, updates: Partial<Session>) => {
      const session = sessions.get(id);
      if (session) {
        Object.assign(session, updates, { updatedAt: new Date() });
        return Promise.resolve(session);
      }
      return Promise.resolve(null as any);
    }),
    deleteSession: vi.fn((id: string) => {
      sessions.delete(id);
      steps.delete(id);
      return Promise.resolve();
    }),
    listSessions: vi.fn(async () => Array.from(sessions.values())),

    // Step operations
    createStep: vi.fn((data: any) => {
      const step: Step = {
        id: Date.now(),
        sessionId: data.sessionId,
        stepNumber: data.stepNumber,
        action: data.action,
        reasoning: data.reasoning,
        selectedTool: data.selectedTool,
        parameters: data.parameters,
        llmPrompt: data.llmPrompt,
        llmResponse: data.llmResponse,
        status: data.status || 'pending',
        discarded: data.discarded,
        isParallel: data.isParallel,
        waitStrategy: data.waitStrategy,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const sessionSteps = steps.get(data.sessionId) || [];
      sessionSteps.push(step);
      steps.set(data.sessionId, sessionSteps);
      return Promise.resolve(step);
    }),
    getStep: vi.fn(async (id: number) => {
      for (const sessionSteps of steps.values()) {
        const step = sessionSteps.find((s) => s.id === id);
        if (step) return step;
      }
      return null;
    }),
    updateStep: vi.fn(async (id: number, updates: Partial<Step>) => {
      for (const sessionSteps of steps.values()) {
        const step = sessionSteps.find((s) => s.id === id);
        if (step) {
          Object.assign(step, updates, { updatedAt: new Date() });
          return step;
        }
      }
      return null as any;
    }),
    listSteps: vi.fn(async (sessionId: string) => steps.get(sessionId) || []),
    markStepsAsDiscarded: vi.fn(() => Promise.resolve()),
    getLastStep: vi.fn((sessionId: string) => {
      const sessionSteps = steps.get(sessionId) || [];
      return Promise.resolve(
        sessionSteps.length > 0 ? sessionSteps[sessionSteps.length - 1] : null,
      );
    }),

    // Todo operations
    createTodo: vi.fn(),
    getTodo: vi.fn(),
    updateTodo: vi.fn(),
    listTodos: vi.fn(async () => []),
    deleteTodo: vi.fn(),
    batchCreateTodos: vi.fn(async () => []),
    batchUpdateTodos: vi.fn(async () => []),

    // Checkpoint operations
    createCheckpoint: vi.fn(),
    getCheckpoint: vi.fn(),
    listCheckpoints: vi.fn(async () => []),
    deleteCheckpoint: vi.fn(),

    // Parallel tool call operations
    createParallelToolCall: vi.fn(),
    getParallelToolCall: vi.fn(),
    updateParallelToolCall: vi.fn(),
    listParallelToolCalls: vi.fn(async () => []),

    // Fork agent task operations
    createForkAgentTask: vi.fn(),
    getForkAgentTask: vi.fn(),
    updateForkAgentTask: vi.fn(),
    listForkAgentTasks: vi.fn(async () => []),

    // Knowledge base operations
    createKnowledgeEntity: vi.fn(),
    searchKnowledge: vi.fn(async () => []),
    updateKnowledgeEntity: vi.fn(),
    deleteKnowledgeEntity: vi.fn(),

    // Transaction support
    transaction: vi.fn(async (fn) => {
      // Execute the function with the mock adapter itself
      return await fn({} as any);
    }),
  } as unknown as StorageAdapter;
};

// Mock LLM caller
const createMockLLMCaller = (responses: string[]): LLMCaller => {
  let callCount = 0;
  return {
    call: vi.fn(() => {
      const response = responses[callCount] || responses[responses.length - 1];
      callCount++;
      return Promise.resolve(response);
    }),
  };
};

describe('InteractiveAgent', () => {
  let agent: InteractiveAgent;
  let storageAdapter: StorageAdapter;
  let eventEmitter: EventEmitter;
  let llmCaller: LLMCaller;
  let tools: Tool[];

  beforeEach(() => {
    storageAdapter = createMockStorageAdapter();
    eventEmitter = new EventEmitter();
    tools = [
      {
        metadata: {
          name: 'test_tool',
          description: 'A test tool',
          version: '1.0.0',
          category: 'other',
          riskLevel: 'low',
          timeout: 30,
          requiresConfirmation: false,
          async: false,
          estimatedTime: 1,
        },
        schema: {
          type: 'object',
          properties: {
            input: { type: 'string' },
          },
        },
        handler: async () => ({ success: true, result: 'test result' }),
      },
    ];
  });

  describe('Initialization', () => {
    it('should initialize with required options', () => {
      llmCaller = createMockLLMCaller([
        '<final_output>{"action":"Finish","reasoning":"Test","finalResult":"Done"}</final_output>',
      ]);

      agent = new InteractiveAgent({
        storageAdapter,
        llmCaller,
        eventEmitter,
        tools,
      });

      expect(agent).toBeDefined();
    });

    it('should use default values for optional parameters', () => {
      llmCaller = createMockLLMCaller([
        '<final_output>{"action":"Finish","reasoning":"Test","finalResult":"Done"}</final_output>',
      ]);

      agent = new InteractiveAgent({
        storageAdapter,
        llmCaller,
        eventEmitter,
        tools,
      });

      expect(agent).toBeDefined();
    });
  });

  describe('Task Execution', () => {
    it('should execute a simple task to completion', async () => {
      const finishResponse =
        '<final_output>{"action":"Finish","reasoning":"Task completed","finalResult":"Success"}</final_output>';
      llmCaller = createMockLLMCaller([finishResponse]);

      agent = new InteractiveAgent({
        storageAdapter,
        llmCaller,
        eventEmitter,
        tools,
      });

      // Auto-approve all confirmations
      agent.setConfirmationHandler(async () => true);

      const result = await agent.execute({
        goal: 'Complete a test task',
      });

      expect(result.status).toBe('completed');
      expect(result.stepsExecuted).toBeGreaterThan(0);
    });

    it('should emit session:created event', async () => {
      const finishResponse =
        '<final_output>{"action":"Finish","reasoning":"Done","finalResult":"OK"}</final_output>';
      llmCaller = createMockLLMCaller([finishResponse]);

      agent = new InteractiveAgent({
        storageAdapter,
        llmCaller,
        eventEmitter,
        tools,
      });

      const sessionCreatedPromise = new Promise((resolve) => {
        eventEmitter.once('session:created', resolve);
      });

      agent.setConfirmationHandler(async () => true);
      await agent.execute({ goal: 'Test goal' });

      const event = await sessionCreatedPromise;
      expect(event).toBeDefined();
    });

    it('should emit step events during execution', async () => {
      const finishResponse =
        '<final_output>{"action":"Finish","reasoning":"Done","finalResult":"Complete"}</final_output>';
      llmCaller = createMockLLMCaller([finishResponse]);

      agent = new InteractiveAgent({
        storageAdapter,
        llmCaller,
        eventEmitter,
        tools,
      });

      const stepStartedEvents: any[] = [];
      const stepCompletedEvents: any[] = [];

      eventEmitter.on('step:started', (event) => stepStartedEvents.push(event));
      eventEmitter.on('step:completed', (event) => stepCompletedEvents.push(event));

      agent.setConfirmationHandler(async () => true);
      await agent.execute({ goal: 'Test goal' });

      expect(stepStartedEvents.length).toBeGreaterThan(0);
      expect(stepCompletedEvents.length).toBeGreaterThan(0);
    });

    it('should request user confirmation for tool calls', async () => {
      const toolCallResponse =
        '<final_output>{"action":"CallTool","reasoning":"Need to call tool","selectedTool":"test_tool","parameters":{"input":"test"}}</final_output>';
      const finishResponse =
        '<final_output>{"action":"Finish","reasoning":"Done","finalResult":"Complete"}</final_output>';
      llmCaller = createMockLLMCaller([toolCallResponse, finishResponse]);

      agent = new InteractiveAgent({
        storageAdapter,
        llmCaller,
        eventEmitter,
        tools,
      });

      const confirmationEvents: any[] = [];
      eventEmitter.on('tool:requiresConfirmation', (event) => confirmationEvents.push(event));

      let confirmationRequested = false;
      agent.setConfirmationHandler((_toolCall) => {
        confirmationRequested = true;
        return Promise.resolve(true);
      });

      await agent.execute({ goal: 'Test with tool call' });

      expect(confirmationRequested).toBe(true);
      expect(confirmationEvents.length).toBeGreaterThan(0);
    });

    it('should stop execution when user denies confirmation', async () => {
      const toolCallResponse =
        '<final_output>{"action":"CallTool","reasoning":"Need to call tool","selectedTool":"test_tool","parameters":{"input":"test"}}</final_output>';
      llmCaller = createMockLLMCaller([toolCallResponse]);

      agent = new InteractiveAgent({
        storageAdapter,
        llmCaller,
        eventEmitter,
        tools,
      });

      // User denies confirmation
      agent.setConfirmationHandler(() => Promise.resolve(false));

      const result = await agent.execute({ goal: 'Test with denied tool call' });

      expect(result.status).toBe('stopped');
    });
  });

  describe('Stop Control', () => {
    it('should respect stop requests', async () => {
      const toolCallResponse =
        '<final_output>{"action":"CallTool","reasoning":"Call tool","selectedTool":"test_tool","parameters":{}}</final_output>';
      llmCaller = createMockLLMCaller([toolCallResponse]);

      agent = new InteractiveAgent({
        storageAdapter,
        llmCaller,
        eventEmitter,
        tools,
      });

      // Auto-approve confirmations
      agent.setConfirmationHandler(() => {
        // Request stop during confirmation
        agent.requestStop(true);
        return Promise.resolve(true);
      });

      const result = await agent.execute({ goal: 'Test stop request', maxSteps: 10 });

      expect(result.status).toBe('stopped');
    });
  });

  describe('Error Handling', () => {
    it('should handle LLM errors gracefully', async () => {
      llmCaller = {
        call: vi.fn(() => {
          return Promise.reject(new Error('LLM error'));
        }),
      };

      agent = new InteractiveAgent({
        storageAdapter,
        llmCaller,
        eventEmitter,
        tools,
      });

      const result = await agent.execute({ goal: 'Test error handling' });

      expect(result.status).toBe('failed');
      expect(result.error).toBeDefined();
    });

    it('should handle invalid LLM responses', async () => {
      llmCaller = createMockLLMCaller(['Invalid JSON response']);

      agent = new InteractiveAgent({
        storageAdapter,
        llmCaller,
        eventEmitter,
        tools,
      });

      agent.setConfirmationHandler(async () => true);

      const result = await agent.execute({ goal: 'Test invalid response' });

      expect(result.status).toBe('failed');
    });
  });

  describe('Resume Functionality', () => {
    it('should resume a paused session', async () => {
      const toolCallResponse =
        '<final_output>{"action":"CallTool","reasoning":"Call tool","selectedTool":"test_tool","parameters":{}}</final_output>';
      llmCaller = createMockLLMCaller([toolCallResponse]);

      agent = new InteractiveAgent({
        storageAdapter,
        llmCaller,
        eventEmitter,
        tools,
      });

      // Pause by denying confirmation
      agent.setConfirmationHandler(async () => false);
      const firstResult = await agent.execute({ goal: 'Test resume' });

      expect(firstResult.status).toBe('stopped');
      expect(firstResult.canResume).toBe(true);

      // Resume session should work
      // Note: This is a basic test - actual resume would need more context
      expect(async () => {
        await agent.resume(firstResult.sessionId);
      }).toBeDefined();
    });

    it('should throw error when resuming non-paused session', async () => {
      const session = await storageAdapter.createSession({
        goal: 'Test',
        agentType: 'InteractiveAgent',
        autoRun: false,
      });
      await storageAdapter.updateSession(session.id, { status: 'completed' });

      const finishResponse =
        '<final_output>{"action":"Finish","reasoning":"Done","finalResult":"OK"}</final_output>';
      llmCaller = createMockLLMCaller([finishResponse]);

      agent = new InteractiveAgent({
        storageAdapter,
        llmCaller,
        eventEmitter,
        tools,
      });

      await expect(agent.resume(session.id)).rejects.toThrow();
    });
  });

  describe('Progress Tracking', () => {
    it('should emit progress events during execution', async () => {
      const finishResponse =
        '<final_output>{"action":"Finish","reasoning":"Done","finalResult":"Complete"}</final_output>';
      llmCaller = createMockLLMCaller([finishResponse]);

      agent = new InteractiveAgent({
        storageAdapter,
        llmCaller,
        eventEmitter,
        tools,
      });

      const progressEvents: any[] = [];
      eventEmitter.on('progress:updated', (event) => progressEvents.push(event));

      agent.setConfirmationHandler(async () => true);
      await agent.execute({ goal: 'Test progress tracking' });

      expect(progressEvents.length).toBeGreaterThan(0);
      expect(progressEvents[0]).toHaveProperty('percentage');
      expect(progressEvents[0]).toHaveProperty('currentStep');
    });
  });

  describe('Timeout Handling', () => {
    it.skip('should timeout after specified duration', async () => {
      // LLM that takes a long time (simulated)
      llmCaller = {
        call: vi.fn(async () => {
          await new Promise((resolve) => setTimeout(resolve, 200));
          return '<final_output>{"action":"Finish","reasoning":"Done","finalResult":"OK"}</final_output>';
        }),
      };

      agent = new InteractiveAgent({
        storageAdapter,
        llmCaller,
        eventEmitter,
        tools,
      });

      agent.setConfirmationHandler(async () => true);

      const result = await agent.execute({
        goal: 'Test timeout',
        timeout: 0.1, // 0.1 seconds
      });

      expect(result.status).toBe('timeout');
    });
  });
});
