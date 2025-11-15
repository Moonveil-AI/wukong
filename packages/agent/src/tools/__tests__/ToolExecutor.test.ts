/**
 * ToolExecutor Tests
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Tool, ToolContext, ToolResult } from '../../types';
import { ToolExecutor } from '../ToolExecutor';
import { ToolRegistry } from '../ToolRegistry';

describe('ToolExecutor', () => {
  let registry: ToolRegistry;
  let executor: ToolExecutor;
  let testContext: ToolContext;

  beforeEach(() => {
    registry = new ToolRegistry({ path: './tools', autoDiscover: false });
    executor = new ToolExecutor({ registry, enableToolExecutor: true });
    testContext = {
      sessionId: 'test-session',
      stepId: 1,
      userId: 'test-user',
      apiKeys: {},
    };
  });

  // Helper to create test tools
  const createTestTool = (
    name: string,
    handler: (params: any, context: ToolContext) => Promise<ToolResult>,
    options: {
      async?: boolean;
      requiresConfirmation?: boolean;
      timeout?: number;
      schema?: any;
    } = {},
  ): Tool => ({
    metadata: {
      name,
      description: `Test tool: ${name}`,
      version: '1.0.0',
      category: 'data',
      riskLevel: 'low',
      timeout: options.timeout ?? 30,
      requiresConfirmation: options.requiresConfirmation ?? false,
      async: options.async ?? false,
      estimatedTime: 1,
    },
    schema: options.schema ?? {
      type: 'object',
      properties: {
        input: { type: 'string' },
      },
      required: ['input'],
    },
    handler,
  });

  describe('execute', () => {
    it('should execute a tool successfully', async () => {
      const tool = createTestTool('test_tool', async (params) => ({
        success: true,
        result: `Processed: ${params.input}`,
      }));

      registry.register(tool);

      const result = await executor.execute({
        tool: 'test_tool',
        params: { input: 'hello' },
        context: testContext,
      });

      expect(result.success).toBe(true);
      expect(result.result).toBe('Processed: hello');
      expect(result.summary).toBeDefined();
    });

    it('should return error for non-existent tool', async () => {
      const result = await executor.execute({
        tool: 'nonexistent_tool',
        params: {},
        context: testContext,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Tool not found');
      expect(result.canRetry).toBe(false);
    });

    it('should validate parameters against schema', async () => {
      const tool = createTestTool('validate_tool', async (params) => ({
        success: true,
        result: params,
      }));

      registry.register(tool);

      // Missing required parameter
      const result = await executor.execute({
        tool: 'validate_tool',
        params: {},
        context: testContext,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid parameters');
      expect(result.canRetry).toBe(true);
    });

    it('should coerce parameter types', async () => {
      const tool = createTestTool(
        'coerce_tool',
        async (params) => ({
          success: true,
          result: params,
        }),
        {
          schema: {
            type: 'object',
            properties: {
              count: { type: 'number' },
              enabled: { type: 'boolean' },
            },
            required: ['count'],
          },
        },
      );

      registry.register(tool);

      const result = await executor.execute({
        tool: 'coerce_tool',
        params: { count: '42', enabled: 'true' },
        context: testContext,
      });

      expect(result.success).toBe(true);
      expect(result.result.count).toBe(42);
      expect(result.result.enabled).toBe(true);
    });

    it('should handle tool execution errors', async () => {
      const tool = createTestTool('error_tool', () => {
        throw new Error('Tool execution failed');
      });

      registry.register(tool);

      const result = await executor.execute({
        tool: 'error_tool',
        params: { input: 'test' },
        context: testContext,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Tool execution failed');
    });

    it('should timeout long-running tools', async () => {
      const tool = createTestTool(
        'slow_tool',
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          return { success: true, result: 'done' };
        },
        { timeout: 1 }, // 1 second timeout
      );

      registry.register(tool);

      const result = await executor.execute({
        tool: 'slow_tool',
        params: { input: 'test' },
        context: testContext,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('timed out');
      expect(result.canRetry).toBe(true);
    });

    it('should call custom error handler on error', async () => {
      const errorHandler = vi.fn();
      const customExecutor = new ToolExecutor({
        registry,
        onError: errorHandler,
      });

      const tool = createTestTool('error_tool', () => {
        throw new Error('Test error');
      });

      registry.register(tool);

      await customExecutor.execute({
        tool: 'error_tool',
        params: { input: 'test' },
        context: testContext,
      });

      expect(errorHandler).toHaveBeenCalled();
    });

    it('should call tool error handler if provided', async () => {
      const toolErrorHandler = vi.fn().mockReturnValue({
        success: false,
        error: 'Custom error handling',
        canRetry: true,
      });

      const tool = createTestTool('tool_with_error_handler', () => {
        throw new Error('Test error');
      });
      tool.onError = toolErrorHandler;

      registry.register(tool);

      const result = await executor.execute({
        tool: 'tool_with_error_handler',
        params: { input: 'test' },
        context: testContext,
      });

      expect(toolErrorHandler).toHaveBeenCalled();
      expect(result.error).toBe('Custom error handling');
    });
  });

  describe('executeMany', () => {
    it('should execute multiple tools in sequence', async () => {
      const tool1 = createTestTool('tool1', async (params) => ({
        success: true,
        result: `Tool1: ${params.input}`,
      }));

      const tool2 = createTestTool('tool2', async (params) => ({
        success: true,
        result: `Tool2: ${params.input}`,
      }));

      registry.register(tool1);
      registry.register(tool2);

      const results = await executor.executeMany([
        { tool: 'tool1', params: { input: 'first' }, context: testContext },
        { tool: 'tool2', params: { input: 'second' }, context: testContext },
      ]);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
    });

    it('should stop on non-retryable error', async () => {
      const tool1 = createTestTool('tool1', async () => ({
        success: false,
        error: 'Fatal error',
        canRetry: false,
      }));

      const tool2 = createTestTool('tool2', async (params) => ({
        success: true,
        result: `Tool2: ${params.input}`,
      }));

      registry.register(tool1);
      registry.register(tool2);

      const results = await executor.executeMany([
        { tool: 'tool1', params: { input: 'first' }, context: testContext },
        { tool: 'tool2', params: { input: 'second' }, context: testContext },
      ]);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
    });

    it('should continue on retryable error', async () => {
      const tool1 = createTestTool('tool1', async () => ({
        success: false,
        error: 'Retryable error',
        canRetry: true,
      }));

      const tool2 = createTestTool('tool2', async (params) => ({
        success: true,
        result: `Tool2: ${params.input}`,
      }));

      registry.register(tool1);
      registry.register(tool2);

      const results = await executor.executeMany([
        { tool: 'tool1', params: { input: 'first' }, context: testContext },
        { tool: 'tool2', params: { input: 'second' }, context: testContext },
      ]);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(false);
      expect(results[1].success).toBe(true);
    });
  });

  describe('MCP mode', () => {
    it('should generate summary for string results', async () => {
      const tool = createTestTool('string_tool', async () => ({
        success: true,
        result: 'This is a test result',
      }));

      registry.register(tool);

      const result = await executor.execute({
        tool: 'string_tool',
        params: { input: 'test' },
        context: testContext,
      });

      expect(result.success).toBe(true);
      expect(result.summary).toBe('This is a test result');
    });

    it('should generate summary for array results', async () => {
      const tool = createTestTool('array_tool', async () => ({
        success: true,
        result: [1, 2, 3, 4, 5],
      }));

      registry.register(tool);

      const result = await executor.execute({
        tool: 'array_tool',
        params: { input: 'test' },
        context: testContext,
      });

      expect(result.success).toBe(true);
      expect(result.summary).toContain('5 item(s)');
      expect(result.summary).toContain('1, 2, 3');
    });

    it('should generate summary for object results', async () => {
      const tool = createTestTool('object_tool', async () => ({
        success: true,
        result: { name: 'test', value: 42, enabled: true },
      }));

      registry.register(tool);

      const result = await executor.execute({
        tool: 'object_tool',
        params: { input: 'test' },
        context: testContext,
      });

      expect(result.success).toBe(true);
      expect(result.summary).toContain('object_tool returned');
      expect(result.summary).toContain('name');
      expect(result.summary).toContain('value');
    });

    it('should truncate long summaries', async () => {
      const longString = 'a'.repeat(1000);
      const tool = createTestTool('long_tool', async () => ({
        success: true,
        result: longString,
      }));

      registry.register(tool);

      const result = await executor.execute({
        tool: 'long_tool',
        params: { input: 'test' },
        context: testContext,
      });

      expect(result.success).toBe(true);
      expect(result.summary?.length).toBeLessThanOrEqual(500);
      expect(result.summary).toContain('...');
    });

    it('should not generate summary when Tool Executor mode is disabled', async () => {
      const nonExecutorExecutor = new ToolExecutor({ registry, enableToolExecutor: false });

      const tool = createTestTool('test_tool', async () => ({
        success: true,
        result: 'test result',
      }));

      registry.register(tool);

      const result = await nonExecutorExecutor.execute({
        tool: 'test_tool',
        params: { input: 'test' },
        context: testContext,
      });

      expect(result.success).toBe(true);
      expect(result.summary).toBeUndefined();
    });
  });

  describe('error handling', () => {
    it('should sanitize error messages with API keys', async () => {
      const tool = createTestTool('leak_tool', () => {
        throw new Error('Failed with api_key=sk-1234567890abcdef1234567890abcdef');
      });

      registry.register(tool);

      const result = await executor.execute({
        tool: 'leak_tool',
        params: { input: 'test' },
        context: testContext,
      });

      expect(result.success).toBe(false);
      expect(result.error).not.toContain('sk-1234567890abcdef1234567890abcdef');
      expect(result.error).toContain('[REDACTED]');
    });

    it('should sanitize error messages with bearer tokens', async () => {
      const tool = createTestTool('token_leak_tool', () => {
        throw new Error('Failed with Bearer abc123xyz456');
      });

      registry.register(tool);

      const result = await executor.execute({
        tool: 'token_leak_tool',
        params: { input: 'test' },
        context: testContext,
      });

      expect(result.success).toBe(false);
      expect(result.error).not.toContain('abc123xyz456');
      expect(result.error).toContain('[REDACTED]');
    });

    it('should identify retryable network errors', async () => {
      const tool = createTestTool('network_error_tool', () => {
        throw new Error('Network timeout occurred');
      });

      registry.register(tool);

      const result = await executor.execute({
        tool: 'network_error_tool',
        params: { input: 'test' },
        context: testContext,
      });

      expect(result.success).toBe(false);
      expect(result.canRetry).toBe(true);
    });

    it('should identify non-retryable errors', async () => {
      const tool = createTestTool('permanent_error_tool', () => {
        throw new Error('Invalid configuration');
      });

      registry.register(tool);

      const result = await executor.execute({
        tool: 'permanent_error_tool',
        params: { input: 'test' },
        context: testContext,
      });

      expect(result.success).toBe(false);
      expect(result.canRetry).toBe(false);
    });
  });

  describe('async tools', () => {
    it('should return task ID for async tools', async () => {
      const tool = createTestTool(
        'async_tool',
        async () => ({
          success: true,
          taskId: 'task-12345',
          result: 'Task submitted',
        }),
        { async: true },
      );

      registry.register(tool);

      const result = await executor.execute({
        tool: 'async_tool',
        params: { input: 'test' },
        context: testContext,
      });

      expect(result.success).toBe(true);
      expect(result.taskId).toBe('task-12345');
    });
  });

  describe('cache management', () => {
    it('should cache validators', async () => {
      const tool = createTestTool('cache_tool', async (params) => ({
        success: true,
        result: params,
      }));

      registry.register(tool);

      // Execute multiple times
      await executor.execute({
        tool: 'cache_tool',
        params: { input: 'first' },
        context: testContext,
      });

      await executor.execute({
        tool: 'cache_tool',
        params: { input: 'second' },
        context: testContext,
      });

      const stats = executor.getStats();
      expect(stats.cachedValidators).toBe(1);
    });

    it('should clear cache', () => {
      executor.clearCache();
      const stats = executor.getStats();
      expect(stats.cachedValidators).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should return execution statistics', () => {
      const stats = executor.getStats();

      expect(stats).toHaveProperty('cachedValidators');
      expect(stats).toHaveProperty('toolExecutorEnabled');
      expect(stats).toHaveProperty('maxSummaryLength');
      expect(stats.toolExecutorEnabled).toBe(true);
      expect(stats.maxSummaryLength).toBe(500);
    });
  });
});
