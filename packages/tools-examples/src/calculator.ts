/**
 * Calculator tool - performs basic mathematical operations
 */

import type { Tool } from '@wukong/agent';

export const calculatorTool: Tool = {
  metadata: {
    name: 'calculator',
    description: 'Perform basic mathematical calculations (add, subtract, multiply, divide)',
    version: '1.0.0',
    category: 'data' as const,
    riskLevel: 'low' as const,
    timeout: 30,
    requiresConfirmation: false,
    async: false,
    estimatedTime: 1,
  },
  schema: {
    type: 'object' as const,
    properties: {
      operation: {
        type: 'string',
        enum: ['add', 'subtract', 'multiply', 'divide'],
        description: 'The mathematical operation to perform',
      },
      a: {
        type: 'number',
        description: 'First number',
      },
      b: {
        type: 'number',
        description: 'Second number',
      },
    },
    required: ['operation', 'a', 'b'],
  },
  // biome-ignore lint/suspicious/useAwait: Handler must be async to match ToolHandler signature
  handler: async (params: any) => {
    const { operation, a, b } = params;

    let result: number;
    switch (operation) {
      case 'add':
        result = a + b;
        break;
      case 'subtract':
        result = a - b;
        break;
      case 'multiply':
        result = a * b;
        break;
      case 'divide':
        if (b === 0) {
          return {
            success: false,
            error: 'Cannot divide by zero',
          };
        }
        result = a / b;
        break;
      default:
        return {
          success: false,
          error: `Unknown operation: ${operation}`,
        };
    }

    return {
      success: true,
      result,
      output: `${a} ${operation} ${b} = ${result}`,
    };
  },
};
