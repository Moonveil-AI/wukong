/**
 * ToolRegistry Tests
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Tool, ToolMetadata } from '../../types';
import { ToolRegistry } from '../ToolRegistry';

describe('ToolRegistry', () => {
  const testToolsPath = path.join(__dirname, 'test-tools');

  beforeEach(() => {
    // Create test tools directory
    if (!fs.existsSync(testToolsPath)) {
      fs.mkdirSync(testToolsPath, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up test tools directory
    if (fs.existsSync(testToolsPath)) {
      fs.rmSync(testToolsPath, { recursive: true, force: true });
    }
  });

  describe('constructor', () => {
    it('should create a registry with default config', () => {
      const registry = new ToolRegistry({ path: testToolsPath });
      expect(registry).toBeInstanceOf(ToolRegistry);
    });

    it('should accept autoDiscover option', () => {
      const registry = new ToolRegistry({
        path: testToolsPath,
        autoDiscover: false,
      });
      expect(registry).toBeInstanceOf(ToolRegistry);
    });
  });

  describe('register', () => {
    it('should register a valid tool', () => {
      const registry = new ToolRegistry({ path: testToolsPath, autoDiscover: false });

      const tool: Tool = createTestTool('test_tool', 'Test tool');

      registry.register(tool);

      expect(registry.hasTool('test_tool')).toBe(true);
      expect(registry.getTool('test_tool')).toBe(tool);
    });

    it('should throw error for invalid tool', () => {
      const registry = new ToolRegistry({ path: testToolsPath, autoDiscover: false });

      const invalidTool = {
        metadata: { name: 'invalid' },
        // Missing schema and handler
      };

      expect(() => registry.register(invalidTool as any)).toThrow();
    });

    it('should overwrite existing tool with warning', () => {
      const registry = new ToolRegistry({ path: testToolsPath, autoDiscover: false });
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
        // Mock implementation
      });

      const tool1 = createTestTool('test_tool', 'First tool');
      const tool2 = createTestTool('test_tool', 'Second tool');

      registry.register(tool1);
      registry.register(tool2);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('already registered'));
      expect(registry.getTool('test_tool')?.metadata.description).toBe('Second tool');

      consoleSpy.mockRestore();
    });

    it('should validate required metadata fields', () => {
      const registry = new ToolRegistry({ path: testToolsPath, autoDiscover: false });

      const invalidTool: Partial<Tool> = {
        metadata: {
          name: 'invalid',
          description: 'Test',
          // Missing required fields
        } as any,
        schema: { type: 'object', properties: {} },
        handler: async () => ({ success: true }),
      };

      expect(() => registry.register(invalidTool as Tool)).toThrow(/missing metadata/i);
    });

    it('should validate schema structure', () => {
      const registry = new ToolRegistry({ path: testToolsPath, autoDiscover: false });

      const toolWithInvalidSchema: Tool = {
        metadata: createTestMetadata('test_tool'),
        schema: { type: 'string' } as any, // Invalid type
        handler: async () => ({ success: true }),
      };

      expect(() => registry.register(toolWithInvalidSchema)).toThrow(
        /schema must have type: 'object'/i,
      );
    });
  });

  describe('unregister', () => {
    it('should unregister an existing tool', () => {
      const registry = new ToolRegistry({ path: testToolsPath, autoDiscover: false });
      const tool = createTestTool('test_tool', 'Test tool');

      registry.register(tool);
      expect(registry.hasTool('test_tool')).toBe(true);

      const result = registry.unregister('test_tool');
      expect(result).toBe(true);
      expect(registry.hasTool('test_tool')).toBe(false);
    });

    it('should return false for non-existent tool', () => {
      const registry = new ToolRegistry({ path: testToolsPath, autoDiscover: false });
      const result = registry.unregister('non_existent');
      expect(result).toBe(false);
    });
  });

  describe('getTool', () => {
    it('should return tool by name', () => {
      const registry = new ToolRegistry({ path: testToolsPath, autoDiscover: false });
      const tool = createTestTool('test_tool', 'Test tool');

      registry.register(tool);

      const retrieved = registry.getTool('test_tool');
      expect(retrieved).toBe(tool);
    });

    it('should return undefined for non-existent tool', () => {
      const registry = new ToolRegistry({ path: testToolsPath, autoDiscover: false });
      const tool = registry.getTool('non_existent');
      expect(tool).toBeUndefined();
    });
  });

  describe('getToolNames', () => {
    it('should return all tool names', () => {
      const registry = new ToolRegistry({ path: testToolsPath, autoDiscover: false });

      registry.register(createTestTool('tool1', 'Tool 1'));
      registry.register(createTestTool('tool2', 'Tool 2'));
      registry.register(createTestTool('tool3', 'Tool 3'));

      const names = registry.getToolNames();
      expect(names).toHaveLength(3);
      expect(names).toContain('tool1');
      expect(names).toContain('tool2');
      expect(names).toContain('tool3');
    });

    it('should return empty array when no tools registered', () => {
      const registry = new ToolRegistry({ path: testToolsPath, autoDiscover: false });
      const names = registry.getToolNames();
      expect(names).toHaveLength(0);
    });
  });

  describe('listToolsForPrompt', () => {
    it('should return tools in MCP format', () => {
      const registry = new ToolRegistry({ path: testToolsPath, autoDiscover: false });

      const tool = createTestTool('test_tool', 'Test tool', {
        param1: { type: 'string', description: 'Parameter 1' },
        param2: { type: 'number', description: 'Parameter 2' },
      });

      registry.register(tool);

      const mcpTools = registry.listToolsForPrompt();

      expect(mcpTools).toHaveLength(1);
      expect(mcpTools[0]).toEqual({
        name: 'test_tool',
        description: 'Test tool',
        parameters: {
          type: 'object',
          properties: {
            param1: { type: 'string', description: 'Parameter 1' },
            param2: { type: 'number', description: 'Parameter 2' },
          },
          required: undefined,
        },
      });
    });

    it('should not include handler in MCP format', () => {
      const registry = new ToolRegistry({ path: testToolsPath, autoDiscover: false });
      registry.register(createTestTool('test_tool', 'Test tool'));

      const mcpTools = registry.listToolsForPrompt();
      expect(mcpTools[0]).not.toHaveProperty('handler');
    });
  });

  describe('getToolsByCategory', () => {
    it('should return tools by category', () => {
      const registry = new ToolRegistry({ path: testToolsPath, autoDiscover: false });

      registry.register(createTestTool('data_tool', 'Data tool', {}, 'data'));
      registry.register(createTestTool('text_tool', 'Text tool', {}, 'text'));
      registry.register(createTestTool('data_tool2', 'Data tool 2', {}, 'data'));

      const dataTools = registry.getToolsByCategory('data');
      expect(dataTools).toHaveLength(2);
      expect(dataTools.map((t) => t.metadata.name)).toEqual(['data_tool', 'data_tool2']);

      const textTools = registry.getToolsByCategory('text');
      expect(textTools).toHaveLength(1);
      expect(textTools[0].metadata.name).toBe('text_tool');
    });
  });

  describe('getStats', () => {
    it('should return registry statistics', () => {
      const registry = new ToolRegistry({ path: testToolsPath, autoDiscover: false });

      registry.register(createTestTool('tool1', 'Tool 1', {}, 'data'));
      registry.register(
        createTestTool('tool2', 'Tool 2', {}, 'text', {
          requiresConfirmation: true,
        }),
      );
      registry.register(
        createTestTool('tool3', 'Tool 3', {}, 'data', {
          async: true,
        }),
      );

      const stats = registry.getStats();

      expect(stats.total).toBe(3);
      expect(stats.byCategory.data).toBe(2);
      expect(stats.byCategory.text).toBe(1);
      expect(stats.requiresConfirmation).toBe(1);
      expect(stats.async).toBe(1);
    });
  });

  describe('clear', () => {
    it('should clear all tools', () => {
      const registry = new ToolRegistry({ path: testToolsPath, autoDiscover: false });

      registry.register(createTestTool('tool1', 'Tool 1'));
      registry.register(createTestTool('tool2', 'Tool 2'));

      expect(registry.getToolNames()).toHaveLength(2);

      registry.clear();

      expect(registry.getToolNames()).toHaveLength(0);
    });
  });
});

// ==========================================
// Helper Functions
// ==========================================

function createTestMetadata(name: string, overrides?: Partial<ToolMetadata>): ToolMetadata {
  return {
    name,
    description: `Description for ${name}`,
    version: '1.0.0',
    category: 'other',
    riskLevel: 'low',
    timeout: 30,
    requiresConfirmation: false,
    async: false,
    estimatedTime: 5,
    ...overrides,
  };
}

function createTestTool(
  name: string,
  description: string,
  properties: Record<string, any> = {},
  category: 'media' | 'data' | 'text' | 'code' | 'other' = 'other',
  metadataOverrides?: Partial<ToolMetadata>,
): Tool {
  return {
    metadata: createTestMetadata(name, {
      description,
      category,
      ...metadataOverrides,
    }),
    schema: {
      type: 'object',
      properties,
    },
    handler: async () => ({
      success: true,
      result: `Result from ${name}`,
    }),
  };
}
