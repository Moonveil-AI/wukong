/**
 * Tool Registry
 *
 * Discovers, registers, and manages available tools for agent execution.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Tool, ToolsConfig } from '../types';

/**
 * Tool Executor format tool listing (name + params only)
 */
export interface ToolExecutorDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

/**
 * Tool Registry Configuration
 */
export interface ToolRegistryConfig {
  /** Path to tools directory */
  path: string;

  /** Auto-discover tools on initialization */
  autoDiscover?: boolean;

  /** Custom tool loader */
  loader?: (filePath: string) => Promise<Tool>;
}

/**
 * Tool Registry
 *
 * Manages tool discovery, registration, and retrieval.
 */
export class ToolRegistry {
  private tools = new Map<string, Tool>();
  private config: Required<ToolRegistryConfig>;

  constructor(config: ToolsConfig | ToolRegistryConfig) {
    const loader =
      'loader' in config && config.loader ? config.loader : this.defaultLoader.bind(this);

    this.config = {
      path: config.path,
      autoDiscover: config.autoDiscover ?? true,
      loader,
    };
  }

  /**
   * Initialize the registry and discover tools
   */
  async initialize(): Promise<void> {
    if (this.config.autoDiscover) {
      await this.discover();
    }
  }

  /**
   * Auto-discover tools from the configured directory
   */
  async discover(): Promise<void> {
    const toolsPath = this.config.path;

    // Check if directory exists
    if (!fs.existsSync(toolsPath)) {
      console.warn(`[ToolRegistry] Tools directory not found: ${toolsPath}`);
      return;
    }

    const stat = fs.statSync(toolsPath);
    if (!stat.isDirectory()) {
      throw new Error(`[ToolRegistry] Tools path is not a directory: ${toolsPath}`);
    }

    // Scan directory for tool files
    const files = fs.readdirSync(toolsPath, { withFileTypes: true });

    for (const file of files) {
      // Skip non-files and non-TypeScript/JavaScript files
      if (!file.isFile()) continue;

      const ext = path.extname(file.name);
      if (!['.ts', '.js', '.mts', '.mjs', '.cts', '.cjs'].includes(ext)) {
        continue;
      }

      // Skip test files
      if (file.name.includes('.test.') || file.name.includes('.spec.')) {
        continue;
      }

      const filePath = path.join(toolsPath, file.name);

      try {
        const tool = await this.config.loader(filePath);
        await this.register(tool);
      } catch (error) {
        console.error(`[ToolRegistry] Failed to load tool from ${filePath}:`, error);
      }
    }

    console.log(`[ToolRegistry] Discovered ${this.tools.size} tool(s) from ${toolsPath}`);
  }

  /**
   * Default tool loader
   *
   * Expects tool files to export a default Tool object or a function that returns a Tool.
   */
  private async defaultLoader(filePath: string): Promise<Tool> {
    // Dynamic import
    const module = await import(filePath);

    // Support both default export and named export
    const exported = module.default || module.tool || module;

    // If it's a function, call it to get the tool
    const tool = typeof exported === 'function' ? await exported() : exported;

    // Validate tool structure
    this.validateTool(tool, filePath);

    return tool;
  }

  /**
   * Validate tool structure
   */
  private validateTool(tool: any, source: string): asserts tool is Tool {
    if (!tool) {
      throw new Error(`[ToolRegistry] Tool from ${source} is null or undefined`);
    }

    if (!tool.metadata) {
      throw new Error(`[ToolRegistry] Tool from ${source} is missing metadata`);
    }

    if (!tool.metadata.name) {
      throw new Error(`[ToolRegistry] Tool from ${source} is missing metadata.name`);
    }

    if (!tool.schema) {
      throw new Error(`[ToolRegistry] Tool from ${source} is missing schema`);
    }

    if (typeof tool.handler !== 'function') {
      throw new Error(`[ToolRegistry] Tool from ${source} is missing handler function`);
    }

    // Validate metadata fields
    const required = ['name', 'description', 'version', 'category', 'riskLevel'];
    for (const field of required) {
      if (!(field in tool.metadata)) {
        throw new Error(`[ToolRegistry] Tool ${tool.metadata.name} is missing metadata.${field}`);
      }
    }

    // Validate schema structure
    if (tool.schema.type !== 'object') {
      throw new Error(`[ToolRegistry] Tool ${tool.metadata.name} schema must have type: 'object'`);
    }

    if (!tool.schema.properties) {
      throw new Error(`[ToolRegistry] Tool ${tool.metadata.name} schema must have properties`);
    }
  }

  /**
   * Register a tool manually
   */
  register(tool: Tool): void {
    this.validateTool(tool, 'manual registration');

    const name = tool.metadata.name;

    if (this.tools.has(name)) {
      console.warn(`[ToolRegistry] Tool ${name} already registered, overwriting...`);
    }

    this.tools.set(name, tool);
  }

  /**
   * Unregister a tool
   */
  unregister(toolName: string): boolean {
    return this.tools.delete(toolName);
  }

  /**
   * Get a tool by name
   */
  getTool(toolName: string): Tool | undefined {
    return this.tools.get(toolName);
  }

  /**
   * Check if a tool exists
   */
  hasTool(toolName: string): boolean {
    return this.tools.has(toolName);
  }

  /**
   * Get all registered tool names
   */
  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Get all registered tools
   */
  getAllTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  /**
   * List tools in Tool Executor format (names + params only, no full implementation details)
   *
   * This is used in prompts to reduce token usage while still providing
   * the LLM with enough information to select appropriate tools.
   */
  listToolsForPrompt(): ToolExecutorDefinition[] {
    return this.getAllTools().map((tool) => ({
      name: tool.metadata.name,
      description: tool.metadata.description,
      parameters: {
        type: 'object',
        properties: tool.schema.properties,
        required: tool.schema.required,
      },
    }));
  }

  /**
   * Get tools by category
   */
  getToolsByCategory(category: 'media' | 'data' | 'text' | 'code' | 'other'): Tool[] {
    return this.getAllTools().filter((tool) => tool.metadata.category === category);
  }

  /**
   * Get tools that require confirmation
   */
  getToolsRequiringConfirmation(): Tool[] {
    return this.getAllTools().filter((tool) => tool.metadata.requiresConfirmation);
  }

  /**
   * Get async tools
   */
  getAsyncTools(): Tool[] {
    return this.getAllTools().filter((tool) => tool.metadata.async);
  }

  /**
   * Clear all registered tools
   */
  clear(): void {
    this.tools.clear();
  }

  /**
   * Get registry statistics
   */
  getStats() {
    const tools = this.getAllTools();
    return {
      total: tools.length,
      byCategory: {
        media: this.getToolsByCategory('media').length,
        data: this.getToolsByCategory('data').length,
        text: this.getToolsByCategory('text').length,
        code: this.getToolsByCategory('code').length,
        other: this.getToolsByCategory('other').length,
      },
      async: this.getAsyncTools().length,
      requiresConfirmation: this.getToolsRequiringConfirmation().length,
    };
  }
}
