import type { Tool } from '@wukong/agent';

export const weatherTool: Tool = {
  metadata: {
    name: 'get_weather',
    description: 'Get current weather information for a location',
    version: '1.0.0',
    category: 'network',
    riskLevel: 'low',
    parameters: {
      location: {
        type: 'string',
        description: 'City name or location',
      },
      unit: {
        type: 'string',
        enum: ['celsius', 'fahrenheit'],
        description: 'Temperature unit (default: celsius)',
        default: 'celsius',
      },
    },
  },
  schema: {
    type: 'object',
    properties: {
      location: { type: 'string' },
      unit: { type: 'string', enum: ['celsius', 'fahrenheit'] },
    },
    required: ['location'],
  },
  // biome-ignore lint/suspicious/useAwait: Handler must be async to match Tool interface
  handler: async ({ location, unit = 'celsius' }) => {
    // Mock implementation
    const temp = Math.floor(Math.random() * 30) + 10; // Random temp 10-40
    const conditions = ['Sunny', 'Cloudy', 'Rainy', 'Partly Cloudy'][Math.floor(Math.random() * 4)];

    return {
      location,
      temperature: temp,
      unit,
      condition: conditions,
      timestamp: new Date().toISOString(),
    };
  },
};
