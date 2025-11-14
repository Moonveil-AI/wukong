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
import { LocalAdapter, MigrationRunner } from '@wukong/adapter-local';
import { WukongAgent } from '@wukong/agent';
import { ClaudeAdapter } from '@wukong/llm-anthropic';
import { OpenAIAdapter } from '@wukong/llm-openai';

// Define a simple custom tool following the Tool interface
const calculatorTool = {
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
      operand1: {
        type: 'number',
        description: 'First operand (number)',
      },
      operand2: {
        type: 'number',
        description: 'Second operand (number)',
      },
    },
    required: ['operation', 'operand1', 'operand2'],
  },
  handler: async (params: any) => {
    const { operation, operand1, operand2 } = params;
    const a = operand1;
    const b = operand2;

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

async function main() {
  console.log('🚀 Starting Wukong Agent Example\n');

  // 1. Initialize storage adapter (Local SQLite)
  const dbPath = process.env.DATABASE_PATH || './data/wukong.db';
  console.log(`📦 Initializing local storage at: ${dbPath}`);

  // Run database migrations
  console.log('🔄 Running database migrations...');
  const migrationRunner = new MigrationRunner(dbPath);
  const migrationResults = await migrationRunner.migrate();
  if (migrationResults.length > 0) {
    console.log(`✅ Applied ${migrationResults.length} migration(s)\n`);
  } else {
    console.log('✅ Database is up to date\n');
  }

  const adapter = new LocalAdapter({ dbPath });
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
      models: llmAdapters,
      maxRetriesPerModel: 3,
    },
    tools: [calculatorTool],
    defaultMode: 'auto',
    enableMCP: true,
  });
  console.log('✅ Agent created with calculator tool\n');

  // 4. Set up event listeners for visibility
  agent.on('session:created', (event) => {
    console.log(`📝 Session created: ${event.sessionId}`);
  });

  agent.on('llm:started', (event) => {
    console.log(`🤖 LLM call started for step ${event.stepId}`);
  });

  agent.on('llm:complete', (event) => {
    console.log(`🤖 LLM call completed for step ${event.stepId}`);
    console.log(`   Response preview: ${event.response?.text?.slice(0, 150)}...`);
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

  agent.on('task:failed', (event) => {
    console.error(`❌ Task failed: ${event.error}`);
  });

  agent.on('error', (event) => {
    console.error(`❌ Error event: ${event.message}`);
    console.error(`   Full event:`, event);
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
    console.log('\n🎉 Task execution finished!\n');
    console.log('Final Result:');
    console.log(JSON.stringify(result, null, 2));
    
    // Check if there was an error in the result
    if (result.error) {
      console.error('\n❌ Task failed with error:', result.error);
    }
  } catch (error) {
    console.error('\n❌ Task failed with exception:', error);
    if (error instanceof Error) {
      console.error('Stack trace:', error.stack);
    }
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
