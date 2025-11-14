/**
 * Basic Example: Using Wukong Agent
 *
 * This example demonstrates:
 * 1. Setting up a WukongAgent with local storage
 * 2. Creating a simple custom tool
 * 3. Executing a task with the agent
 * 4. Listening to events for visibility
 */

import 'dotenv/config';
import { LocalAdapter } from '@wukong/adapter-local';
import { WukongAgent } from '@wukong/agent';
import { ClaudeAdapter } from '@wukong/llm-anthropic';
import { OpenAIAdapter } from '@wukong/llm-openai';

// Define a simple custom tool
const calculatorTool = {
  name: 'calculator',
  description: 'Perform basic mathematical calculations',
  inputSchema: {
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
  execute(params: { operation: string; a: number; b: number }) {
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
          throw new Error('Cannot divide by zero');
        }
        result = a / b;
        break;
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return {
      success: true,
      result,
      message: `${a} ${operation} ${b} = ${result}`,
    };
  },
};

async function main() {
  console.log('🚀 Starting Wukong Agent Example\n');

  // 1. Initialize storage adapter (Local SQLite)
  const dbPath = process.env.DATABASE_PATH || './data/wukong.db';
  console.log(`📦 Initializing local storage at: ${dbPath}`);

  const adapter = new LocalAdapter({ databasePath: dbPath });
  await adapter.initialize();
  console.log('✅ Storage adapter initialized\n');

  // 2. Initialize LLM adapters (with fallback)
  console.log('🧠 Setting up LLM adapters...');
  const llmAdapters = [];

  if (process.env.OPENAI_API_KEY) {
    llmAdapters.push(
      new OpenAIAdapter({
        apiKey: process.env.OPENAI_API_KEY,
        model: 'gpt-4-turbo-preview',
      }),
    );
    console.log('  - OpenAI GPT-4 ✅');
  }

  if (process.env.ANTHROPIC_API_KEY) {
    llmAdapters.push(
      new ClaudeAdapter({
        apiKey: process.env.ANTHROPIC_API_KEY,
        model: 'claude-3-5-sonnet-20241022',
      }),
    );
    console.log('  - Anthropic Claude ✅');
  }

  if (llmAdapters.length === 0) {
    console.error(
      '❌ No LLM API key found! Please set OPENAI_API_KEY or ANTHROPIC_API_KEY in .env',
    );
    process.exit(1);
  }
  console.log();

  // 3. Create Wukong Agent with tools
  console.log('🎭 Creating Wukong Agent...');
  const agent = new WukongAgent({
    adapter,
    llm: {
      adapters: llmAdapters,
      maxRetries: 3,
    },
    tools: [calculatorTool as any],
    defaultMode: 'auto',
    enableMCP: true,
  });
  console.log('✅ Agent created with calculator tool\n');

  // 4. Set up event listeners for visibility
  agent.on('session:created', (event) => {
    console.log(`📝 Session created: ${event.sessionId}`);
  });

  agent.on('step:started', (event) => {
    console.log(`⚡ Step ${event.stepNumber} started: ${event.actionType}`);
  });

  agent.on('step:completed', (event) => {
    console.log(`✅ Step ${event.stepNumber} completed`);
    if (event.result) {
      console.log(`   Result: ${JSON.stringify(event.result).slice(0, 100)}...`);
    }
  });

  agent.on('tool:executed', (event) => {
    console.log(`🔧 Tool executed: ${event.toolName}`);
    console.log(`   Success: ${event.success}`);
  });

  agent.on('error', (event) => {
    console.error(`❌ Error: ${event.message}`);
  });

  // 5. Execute a task
  console.log('🎯 Executing task...\n');
  console.log('━'.repeat(60));

  try {
    const result = await agent.execute({
      goal: 'Calculate the result of 15 multiplied by 8, then add 42 to it',
      maxSteps: 10,
      mode: 'auto', // Auto mode - no user confirmations needed
    });

    console.log('━'.repeat(60));
    console.log('\n🎉 Task completed successfully!\n');
    console.log('Final Result:');
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('\n❌ Task failed:', error);
    process.exit(1);
  }

  // 6. Clean up
  await adapter.close();
  console.log('\n👋 Agent example completed!');
}

// Run the example
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
