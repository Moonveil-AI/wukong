/**
 * StepExecutor tests
 */

import type { EventEmitter } from 'eventemitter3';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StorageAdapter } from '../../types/adapters';
import type {
  AskUserAction,
  CallToolAction,
  CallToolsParallelAction,
  FinishAction,
  ForkAutoAgentAction,
  PlanAction,
  Session,
  Tool,
  ToolResult,
} from '../../types/index';
import { StepExecutor } from '../StepExecutor';
import type { ToolRegistry } from '../StepExecutor';

describe('StepExecutor', () => {
  let mockStorageAdapter: StorageAdapter;
  let mockToolRegistry: ToolRegistry;
  let mockEventEmitter: EventEmitter;
  let stepExecutor: StepExecutor;
  let mockSession: Session;

  beforeEach(() => {
    // Mock storage adapter
    mockStorageAdapter = {
      createStep: vi.fn().mockResolvedValue({
        id: 1,
        sessionId: 'session-1',
        stepNumber: 1,
        action: 'CallTool',
        status: 'pending',
        discarded: false,
        isParallel: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      updateStep: vi.fn().mockImplementation((id, updates) => {
        return Promise.resolve({
          id,
          sessionId: 'session-1',
          stepNumber: 1,
          action: 'CallTool',
          status: 'completed',
          discarded: false,
          isParallel: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...updates,
        });
      }),
      listSteps: vi.fn().mockResolvedValue([]),
      getSession: vi.fn().mockResolvedValue({
        id: 'session-1',
        goal: 'Test goal',
        status: 'active',
        agentType: 'AutoAgent',
        autoRun: true,
        depth: 0,
        isSubAgent: false,
        lastCompressedStepId: 0,
        isCompressing: false,
        isRunning: true,
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      updateSession: vi.fn().mockImplementation((id, updates) => {
        return Promise.resolve({
          id,
          goal: 'Test goal',
          status: 'active',
          agentType: 'AutoAgent',
          autoRun: true,
          depth: 0,
          isSubAgent: false,
          lastCompressedStepId: 0,
          isCompressing: false,
          isRunning: true,
          isDeleted: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...updates,
        });
      }),
      createSession: vi.fn().mockResolvedValue({
        id: 'session-2',
        goal: 'Sub goal',
        status: 'active',
        agentType: 'AutoAgent',
        autoRun: true,
        depth: 1,
        isSubAgent: true,
        lastCompressedStepId: 0,
        isCompressing: false,
        isRunning: false,
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      markStepsAsDiscarded: vi.fn().mockResolvedValue(undefined),
      createParallelToolCall: vi.fn().mockImplementation((call) => {
        return Promise.resolve({
          id: 1,
          stepId: call.stepId,
          toolId: call.toolId,
          toolName: call.toolName,
          parameters: call.parameters,
          status: call.status,
          progressPercentage: 0,
          retryCount: 0,
          maxRetries: 3,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }),
      updateParallelToolCall: vi.fn().mockImplementation((id, updates) => {
        return Promise.resolve({
          id,
          stepId: 1,
          toolId: 'tool-1',
          toolName: 'test_tool',
          parameters: {},
          status: 'completed',
          progressPercentage: 100,
          retryCount: 0,
          maxRetries: 3,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...updates,
        });
      }),
      createForkAgentTask: vi.fn().mockResolvedValue({
        id: 'fork-1',
        parentSessionId: 'session-1',
        goal: 'Sub goal',
        depth: 1,
        maxSteps: 20,
        timeoutSeconds: 300,
        status: 'pending',
        stepsExecuted: 0,
        tokensUsed: 0,
        toolsCalled: 0,
        retryCount: 0,
        maxRetries: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    } as unknown as StorageAdapter;

    // Mock tool registry
    mockToolRegistry = {
      getTool: vi.fn().mockReturnValue({
        metadata: {
          name: 'test_tool',
          description: 'Test tool',
          version: '1.0.0',
          category: 'other',
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
        handler: vi.fn().mockResolvedValue({
          success: true,
          result: { data: 'test result' },
          summary: 'Tool executed successfully',
        } as ToolResult),
      } as Tool),
      listTools: vi.fn().mockReturnValue([]),
    };

    // Mock event emitter
    mockEventEmitter = {
      emit: vi.fn(),
    } as unknown as EventEmitter;

    // Create mock session
    mockSession = {
      id: 'session-1',
      goal: 'Test goal',
      status: 'active',
      agentType: 'AutoAgent',
      autoRun: true,
      depth: 0,
      isSubAgent: false,
      lastCompressedStepId: 0,
      isCompressing: false,
      isRunning: true,
      isDeleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Create step executor
    stepExecutor = new StepExecutor({
      storageAdapter: mockStorageAdapter,
      toolRegistry: mockToolRegistry,
      eventEmitter: mockEventEmitter,
      // biome-ignore lint/style/useNamingConvention: API key constant name
      apiKeys: { TEST_KEY: 'test-value' },
    });
  });

  describe('CallTool execution', () => {
    it('should execute a CallTool action successfully', async () => {
      const action: CallToolAction = {
        action: 'CallTool',
        reasoning: 'Need to test the tool',
        selectedTool: 'test_tool',
        parameters: { test: 'value' },
      };

      const result = await stepExecutor.execute(
        mockSession,
        action,
        'test prompt',
        'test response',
      );

      expect(result.success).toBe(true);
      expect(result.shouldContinue).toBe(true);
      expect(mockStorageAdapter.createStep).toHaveBeenCalled();
      expect(mockStorageAdapter.updateStep).toHaveBeenCalled();
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('step:started', expect.any(Object));
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('step:completed', expect.any(Object));
    });

    it('should handle tool not found error', async () => {
      (mockToolRegistry.getTool as ReturnType<typeof vi.fn>).mockReturnValue(null);

      const action: CallToolAction = {
        action: 'CallTool',
        reasoning: 'Test',
        selectedTool: 'unknown_tool',
        parameters: {},
      };

      const result = await stepExecutor.execute(mockSession, action);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Tool not found');
      expect(result.shouldContinue).toBe(false);
    });

    it('should handle async tool execution', async () => {
      const asyncToolHandler = vi.fn().mockResolvedValue({
        success: true,
        taskId: 'async-task-123',
        summary: 'Async task submitted',
      });

      (mockToolRegistry.getTool as ReturnType<typeof vi.fn>).mockReturnValue({
        metadata: { name: 'async_tool', async: true },
        schema: { type: 'object', properties: {} },
        handler: asyncToolHandler,
      });

      const action: CallToolAction = {
        action: 'CallTool',
        reasoning: 'Test async',
        selectedTool: 'async_tool',
        parameters: {},
      };

      const result = await stepExecutor.execute(mockSession, action);

      expect(result.success).toBe(true);
      expect(result.taskIds).toEqual(['async-task-123']);
      expect(result.shouldContinue).toBe(true);
    });
  });

  describe('CallToolsParallel execution', () => {
    it('should execute parallel tools with "all" strategy', async () => {
      const action: CallToolsParallelAction = {
        action: 'CallToolsParallel',
        reasoning: 'Execute tools in parallel',
        parallelTools: [
          { toolId: 'tool-1', toolName: 'test_tool', parameters: {} },
          { toolId: 'tool-2', toolName: 'test_tool', parameters: {} },
        ],
        waitStrategy: 'all',
      };

      const result = await stepExecutor.execute(mockSession, action);

      expect(result.success).toBe(true);
      expect(result.shouldContinue).toBe(true);
      expect(mockStorageAdapter.createParallelToolCall).toHaveBeenCalledTimes(2);
    });

    it('should handle "any" wait strategy', async () => {
      const action: CallToolsParallelAction = {
        action: 'CallToolsParallel',
        reasoning: 'Execute tools in parallel',
        parallelTools: [
          { toolId: 'tool-1', toolName: 'test_tool', parameters: {} },
          { toolId: 'tool-2', toolName: 'test_tool', parameters: {} },
        ],
        waitStrategy: 'any',
      };

      const result = await stepExecutor.execute(mockSession, action);

      expect(result.success).toBe(true);
      expect(result.shouldContinue).toBe(true);
    });

    it('should handle "majority" wait strategy', async () => {
      const action: CallToolsParallelAction = {
        action: 'CallToolsParallel',
        reasoning: 'Execute tools in parallel',
        parallelTools: [
          { toolId: 'tool-1', toolName: 'test_tool', parameters: {} },
          { toolId: 'tool-2', toolName: 'test_tool', parameters: {} },
          { toolId: 'tool-3', toolName: 'test_tool', parameters: {} },
        ],
        waitStrategy: 'majority',
      };

      const result = await stepExecutor.execute(mockSession, action);

      expect(result.success).toBe(true);
      expect(result.shouldContinue).toBe(true);
    });
  });

  describe('ForkAutoAgent execution', () => {
    it('should create a sub-agent session', async () => {
      const action: ForkAutoAgentAction = {
        action: 'ForkAutoAgent',
        reasoning: 'Need to delegate sub-task',
        subGoal: 'Complete sub-task',
        contextSummary: 'Parent context',
        maxSteps: 20,
        timeout: 300,
      };

      const result = await stepExecutor.execute(mockSession, action);

      expect(result.success).toBe(true);
      expect(result.shouldContinue).toBe(true);
      expect(mockStorageAdapter.createSession).toHaveBeenCalled();
      expect(mockStorageAdapter.createForkAgentTask).toHaveBeenCalled();
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('agent:forked', expect.any(Object));
    });

    it('should enforce depth limits', async () => {
      (mockStorageAdapter.getSession as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockSession,
        depth: 10,
      });

      const action: ForkAutoAgentAction = {
        action: 'ForkAutoAgent',
        reasoning: 'Test depth limit',
        subGoal: 'Sub goal',
        contextSummary: 'Context',
        maxDepth: 10,
      };

      const result = await stepExecutor.execute(mockSession, action);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Maximum agent fork depth exceeded');
    });
  });

  describe('AskUser execution', () => {
    it('should emit question and wait for user', async () => {
      const action: AskUserAction = {
        action: 'AskUser',
        reasoning: 'Need user input',
        question: 'What should I do next?',
        options: ['Option A', 'Option B'],
      };

      const result = await stepExecutor.execute(mockSession, action);

      expect(result.success).toBe(true);
      expect(result.shouldContinue).toBe(false);
      expect(result.waitForUser).toBe(true);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('user:questionAsked', expect.any(Object));
    });
  });

  describe('Plan execution', () => {
    it('should emit plan ready event', async () => {
      const action: PlanAction = {
        action: 'Plan',
        reasoning: 'Creating execution plan',
        plan: {
          steps: [
            { action: 'CallTool', description: 'Step 1' },
            { action: 'CallTool', description: 'Step 2' },
          ],
        },
      };

      const result = await stepExecutor.execute(mockSession, action);

      expect(result.success).toBe(true);
      expect(result.shouldContinue).toBe(true);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('plan:ready', expect.any(Object));
    });
  });

  describe('Finish execution', () => {
    it('should complete the session', async () => {
      const action: FinishAction = {
        action: 'Finish',
        reasoning: 'Task completed',
        finalResult: { result: 'success' },
        summary: 'All tasks completed successfully',
      };

      const result = await stepExecutor.execute(mockSession, action);

      expect(result.success).toBe(true);
      expect(result.shouldContinue).toBe(false);
      expect(mockStorageAdapter.updateSession).toHaveBeenCalledWith('session-1', {
        status: 'completed',
        resultSummary: 'All tasks completed successfully',
      });
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('session:completed', expect.any(Object));
    });
  });

  describe('Discardable steps', () => {
    it('should mark discardable steps', async () => {
      const action: CallToolAction = {
        action: 'CallTool',
        reasoning: 'Test',
        selectedTool: 'test_tool',
        parameters: {},
        discardableSteps: [1, 2, 3],
      };

      await stepExecutor.execute(mockSession, action);

      expect(mockStorageAdapter.markStepsAsDiscarded).toHaveBeenCalledWith('session-1', [1, 2, 3]);
    });
  });

  describe('Error handling', () => {
    it('should handle tool execution errors gracefully', async () => {
      const errorHandler = vi.fn().mockRejectedValue(new Error('Tool execution failed'));

      (mockToolRegistry.getTool as ReturnType<typeof vi.fn>).mockReturnValue({
        metadata: { name: 'error_tool' },
        schema: { type: 'object', properties: {} },
        handler: errorHandler,
      });

      const action: CallToolAction = {
        action: 'CallTool',
        reasoning: 'Test error',
        selectedTool: 'error_tool',
        parameters: {},
      };

      const result = await stepExecutor.execute(mockSession, action);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Tool execution failed');
      expect(result.shouldContinue).toBe(false);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('step:failed', expect.any(Object));
    });
  });
});
