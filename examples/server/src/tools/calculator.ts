import type { Tool } from '@wukong/agent';

export const calculatorTool: Tool = {
  metadata: {
    name: 'calculator',
    description: 'Perform basic mathematical calculations',
    version: '1.0.0',
    category: 'data',
    riskLevel: 'low',
    timeout: 30,
    requiresConfirmation: false,
    async: false,
    estimatedTime: 1,
  },
  schema: {
    type: 'object',
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
  // biome-ignore lint/suspicious/useAwait: Handler must be async to match Tool interface
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
        if (b === 0) throw new Error('Cannot divide by zero');
        result = a / b;
        break;
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return {
      success: true,
      result,
      output: `${a} ${operation} ${b} = ${result}`,
    };
  },
};
