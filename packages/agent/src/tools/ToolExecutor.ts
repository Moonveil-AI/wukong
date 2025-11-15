/**
 * Tool Executor
 *
 * Executes tools with parameter validation, error handling, and result summary generation.
 */

import Ajv, { type ValidateFunction, type ErrorObject } from 'ajv';
import addFormats from 'ajv-formats';
import type { Tool, ToolContext, ToolResult } from '../types';
import type { ToolRegistry } from './ToolRegistry';

/**
 * Tool Executor Configuration
 */
export interface ToolExecutorConfig {
  /** Tool registry instance */
  registry: ToolRegistry;

  /** Enable Tool Executor mode (generate result summaries) */
  enableToolExecutor?: boolean;

  /** Maximum result length for Tool Executor summary */
  maxSummaryLength?: number;

  /** Custom error handler */
  onError?: (error: Error, tool: Tool, params: any) => void;
}

/**
 * Tool execution request
 */
export interface ToolExecutionRequest {
  /** Tool name */
  tool: string;

  /** Tool parameters */
  params: Record<string, any>;

  /** Execution context */
  context: ToolContext;
}

/**
 * Tool Executor
 *
 * Handles tool execution with validation, error handling, and summary generation.
 */
export class ToolExecutor {
  private registry: ToolRegistry;
  private config: Required<Omit<ToolExecutorConfig, 'onError'>> & {
    onError?: (error: Error, tool: Tool, params: any) => void;
  };
  private ajv: Ajv;
  private validatorCache = new Map<string, ValidateFunction>();

  constructor(config: ToolExecutorConfig) {
    this.registry = config.registry;
    this.config = {
      registry: config.registry,
      enableToolExecutor: config.enableToolExecutor ?? false,
      maxSummaryLength: config.maxSummaryLength ?? 500,
      onError: config.onError,
    };

    // Initialize AJV for schema validation
    this.ajv = new Ajv({
      allErrors: true,
      useDefaults: true,
      coerceTypes: true,
      removeAdditional: true,
    });
    addFormats(this.ajv);
  }

  /**
   * Execute a tool with validation and error handling
   */
  async execute(request: ToolExecutionRequest): Promise<ToolResult> {
    const { tool: toolName, params, context } = request;

    try {
      // Get tool from registry
      const tool = this.registry.getTool(toolName);
      if (!tool) {
        return {
          success: false,
          error: `Tool not found: ${toolName}`,
          canRetry: false,
          suggestion: `Available tools: ${this.registry.getToolNames().join(', ')}`,
        };
      }

      // Validate parameters
      const validation = this.validateParameters(tool, params);
      if (!validation.valid) {
        return {
          success: false,
          error: `Invalid parameters: ${validation.errors.join(', ')}`,
          canRetry: true,
          suggestion: `Check parameter types and required fields. Schema: ${JSON.stringify(tool.schema)}`,
        };
      }

      // Execute tool handler
      const startTime = Date.now();
      let result: ToolResult;

      try {
        result = await this.executeWithTimeout(tool, validation.params, context);
      } catch (error) {
        // Handle tool execution error
        result = await this.handleExecutionError(error, tool, params, context);
      }

      const durationMs = Date.now() - startTime;

      // Generate result summary if Tool Executor mode is enabled
      if (this.config.enableToolExecutor && result.success) {
        result.summary = this.generateResultSummary(result.result, tool);
      }

      // Add execution metadata
      return {
        ...result,
        executionTime: durationMs,
      } as ToolResult;
    } catch (error) {
      // Catch-all for unexpected errors
      return {
        success: false,
        error: `Unexpected error executing tool: ${error instanceof Error ? error.message : String(error)}`,
        canRetry: false,
      };
    }
  }

  /**
   * Execute multiple tools in sequence
   */
  async executeMany(requests: ToolExecutionRequest[]): Promise<ToolResult[]> {
    const results: ToolResult[] = [];

    for (const request of requests) {
      const result = await this.execute(request);
      results.push(result);

      // Stop if a tool fails and it's not retryable
      if (!(result.success || result.canRetry)) {
        break;
      }
    }

    return results;
  }

  /**
   * Validate tool parameters against schema
   */
  private validateParameters(
    tool: Tool,
    params: Record<string, any>,
  ): { valid: true; params: Record<string, any> } | { valid: false; errors: string[] } {
    try {
      // Get or create validator for this tool
      let validator = this.validatorCache.get(tool.metadata.name);
      if (!validator) {
        validator = this.ajv.compile(tool.schema);
        this.validatorCache.set(tool.metadata.name, validator);
      }

      // Validate parameters
      const valid = validator(params);

      if (!valid && validator.errors) {
        const errors = validator.errors.map((err: ErrorObject) => {
          const path = err.instancePath || err.schemaPath;
          return `${path}: ${err.message}`;
        });
        return { valid: false, errors };
      }

      return { valid: true, params };
    } catch (error) {
      return {
        valid: false,
        errors: [
          `Schema validation failed: ${error instanceof Error ? error.message : String(error)}`,
        ],
      };
    }
  }

  /**
   * Execute tool with timeout
   */
  private executeWithTimeout(
    tool: Tool,
    params: Record<string, any>,
    context: ToolContext,
  ): Promise<ToolResult> {
    const timeout = tool.metadata.timeout * 1000; // Convert to milliseconds

    return Promise.race([
      tool.handler(params, context),
      this.createTimeoutPromise(timeout, tool.metadata.name),
    ]);
  }

  /**
   * Create a timeout promise
   */
  private createTimeoutPromise(timeoutMs: number, toolName: string): Promise<ToolResult> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          success: false,
          error: `Tool execution timed out after ${timeoutMs}ms`,
          canRetry: true,
          suggestion: `Consider increasing the timeout for ${toolName} or breaking the task into smaller steps`,
        });
      }, timeoutMs);
    });
  }

  /**
   * Handle execution errors
   */
  private async handleExecutionError(
    error: unknown,
    tool: Tool,
    params: Record<string, any>,
    context: ToolContext,
  ): Promise<ToolResult> {
    // Call custom error handler if provided
    if (this.config.onError && error instanceof Error) {
      try {
        this.config.onError(error, tool, params);
      } catch (handlerError) {
        console.error('[ToolExecutor] Error in custom error handler:', handlerError);
      }
    }

    // Call tool's error handler if provided
    if (tool.onError && error instanceof Error) {
      try {
        return await tool.onError(error, params, context);
      } catch (handlerError) {
        console.error('[ToolExecutor] Error in tool error handler:', handlerError);
      }
    }

    // Default error handling
    const errorMessage = error instanceof Error ? error.message : String(error);
    const sanitizedError = this.sanitizeError(errorMessage);

    // Determine if error is retryable
    const canRetry = this.isRetryableError(error);

    return {
      success: false,
      error: sanitizedError,
      canRetry,
      suggestion: canRetry
        ? 'This error may be temporary. Consider retrying the operation.'
        : 'This error appears to be permanent. Please check your parameters and try a different approach.',
    };
  }

  /**
   * Sanitize error messages to remove sensitive information
   */
  private sanitizeError(errorMessage: string): string {
    // Remove potential API keys, tokens, and sensitive paths
    let sanitized = errorMessage
      .replace(/\b([a-zA-Z0-9]{32,})\b/g, '[REDACTED]') // Long alphanumeric strings (likely keys)
      .replace(/Bearer\s+[^\s]+/gi, 'Bearer [REDACTED]') // Bearer tokens
      .replace(/api[_-]?key[:\s=]+[^\s]+/gi, 'api_key=[REDACTED]') // API keys
      .replace(/token[:\s=]+[^\s]+/gi, 'token=[REDACTED]') // Tokens
      .replace(/password[:\s=]+[^\s]+/gi, 'password=[REDACTED]') // Passwords
      .replace(/\/home\/[^\s]+/g, '/home/[USER]') // Home directories
      .replace(/\/Users\/[^\s]+/g, '/Users/[USER]'); // macOS user directories

    // Truncate if too long
    if (sanitized.length > 500) {
      sanitized = `${sanitized.substring(0, 497)}...`;
    }

    return sanitized;
  }

  /**
   * Determine if an error is retryable
   */
  private isRetryableError(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    const retryablePatterns = [
      /network/i,
      /timeout/i,
      /ECONNREFUSED/i,
      /ETIMEDOUT/i,
      /ENOTFOUND/i,
      /rate limit/i,
      /too many requests/i,
      /503/,
      /502/,
      /504/,
      /temporary/i,
    ];

    return retryablePatterns.some((pattern) => pattern.test(error.message));
  }

  /**
   * Generate a concise result summary for MCP mode
   */
  private generateResultSummary(result: any, tool: Tool): string {
    try {
      // Handle null/undefined
      if (result === null || result === undefined) {
        return `${tool.metadata.name} completed with no result`;
      }

      // Handle string results
      if (typeof result === 'string') {
        return this.truncateString(result, this.config.maxSummaryLength);
      }

      // Handle number/boolean results
      if (typeof result === 'number' || typeof result === 'boolean') {
        return `${tool.metadata.name} returned: ${result}`;
      }

      // Handle array results
      if (Array.isArray(result)) {
        const count = result.length;
        if (count === 0) {
          return `${tool.metadata.name} returned an empty array`;
        }
        const sample = result.slice(0, 3).map(this.summarizeValue.bind(this));
        return `${tool.metadata.name} returned ${count} item(s): [${sample.join(', ')}${count > 3 ? ', ...' : ''}]`;
      }

      // Handle object results
      if (typeof result === 'object') {
        const keys = Object.keys(result);
        if (keys.length === 0) {
          return `${tool.metadata.name} returned an empty object`;
        }

        // Create a compact representation
        const compactObj: Record<string, any> = {};
        for (const key of keys.slice(0, 5)) {
          compactObj[key] = this.summarizeValue(result[key]);
        }

        let summary = JSON.stringify(compactObj);
        if (keys.length > 5) {
          summary = summary.replace(/}$/, `, ... (${keys.length - 5} more keys)}`);
        }

        return this.truncateString(
          `${tool.metadata.name} returned: ${summary}`,
          this.config.maxSummaryLength,
        );
      }

      // Fallback
      return `${tool.metadata.name} completed`;
    } catch {
      return `${tool.metadata.name} completed (summary generation failed)`;
    }
  }

  /**
   * Summarize a single value for inclusion in summary
   */
  private summarizeValue(value: any): string {
    if (value === null || value === undefined) {
      return String(value);
    }

    if (typeof value === 'string') {
      return value.length > 50 ? `"${value.substring(0, 47)}..."` : `"${value}"`;
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }

    if (Array.isArray(value)) {
      return `Array(${value.length})`;
    }

    if (typeof value === 'object') {
      return `Object(${Object.keys(value).length} keys)`;
    }

    return String(value);
  }

  /**
   * Truncate a string to a maximum length
   */
  private truncateString(str: string, maxLength: number): string {
    if (str.length <= maxLength) {
      return str;
    }
    return `${str.substring(0, maxLength - 3)}...`;
  }

  /**
   * Clear validator cache (useful for testing)
   */
  clearCache(): void {
    this.validatorCache.clear();
  }

  /**
   * Get execution statistics
   */
  getStats() {
    return {
      cachedValidators: this.validatorCache.size,
      toolExecutorEnabled: this.config.enableToolExecutor,
      maxSummaryLength: this.config.maxSummaryLength,
    };
  }
}
