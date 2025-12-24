/**
 * Basic Example: Using Wukong Agent
 *
 * This example demonstrates:
 * 1. Setting up a WukongAgent with local storage
 * 2. Automatic LLM adapter initialization from environment variables
 * 3. Creating a simple custom tool
 * 4. Executing a task with the agent
 * 5. Listening to events for visibility
 */

import 'dotenv/config';
import { LocalAdapter, MigrationRunner } from '@wukong/adapter-local';
import { WukongAgent } from '@wukong/agent';
import { ClaudeAdapter } from '@wukong/llm-anthropic';
import { GeminiAdapter } from '@wukong/llm-google';
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
  handler: (params: any) => {
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

async function main() {
  const startTime = Date.now();
  console.log('🚀 Starting Wukong Agent Example\n');

  // 1. Initialize storage adapter (Local SQLite)
  // biome-ignore lint/complexity/useLiteralKeys: TypeScript requires bracket notation for index signatures
  const dbPath = process.env['DATABASE_PATH'] || './data/wukong.db';
  console.log(`📦 Initializing local storage at: ${dbPath}`);

  // Run database migrations
  const migrationStart = Date.now();
  console.log('🔄 Running database migrations...');
  const migrationRunner = new MigrationRunner(dbPath);
  const migrationResults = await migrationRunner.migrate();
  const migrationTime = Date.now() - migrationStart;

  if (migrationResults.length > 0) {
    console.log(`✅ Applied ${migrationResults.length} migration(s) in ${migrationTime}ms\n`);
  } else {
    console.log(`✅ Database is up to date (${migrationTime}ms)\n`);
  }

  const adapter = new LocalAdapter({ dbPath });
  console.log('✅ Storage adapter initialized\n');

  // 2. Initialize LLM adapters (with automatic fallback and intelligent model selection)
  // API keys are automatically read from environment variables
  //
  // LLM adapters can be configured in two ways:
  // A) Simple format (backward compatible): [new ClaudeAdapter(), new GeminiAdapter()]
  // B) With instructions for intelligent selection:
  //    [
  //      { instruction: "Good at writing code", adapter: new ClaudeAdapter() },
  //      { instruction: "Good at math calculations", adapter: new GeminiAdapter() }
  //    ]
  //
  // When instructions are provided, the first available model will analyze the user's
  // query and select the most appropriate model based on the instructions.
  console.log('🧠 Setting up LLM adapters with intelligent model selection...');
  // Using 'any' for the array since the built types may not be up-to-date during development
  // In production, you can use: LLMAdapterInput[] from '@wukong/agent'
  const llmAdapters: any[] = [];

  // Try to initialize Claude Sonnet 4 (good at code and complex reasoning)
  try {
    llmAdapters.push({
      instruction: 'Best for writing code, complex reasoning, and detailed analysis',
      adapter: new ClaudeAdapter({
        model: 'claude-sonnet-4-20250514',
      }),
    });
    console.log('  - Anthropic Claude Sonnet 4 (code & reasoning) ✅');
  } catch (_error) {
    console.log('  - Anthropic Claude (skipped - no API key)');
  }

  // Try to initialize Gemini 2.5 Pro (good at math and calculations)
  try {
    llmAdapters.push({
      instruction: 'Best for mathematical calculations, data analysis, and scientific tasks',
      adapter: new GeminiAdapter(),
    });
    console.log('  - Google Gemini 2.5 Pro (math & science) ✅');
  } catch (_error) {
    console.log('  - Google Gemini (skipped - no API key)');
  }

  // Try to initialize OpenAI (general purpose fallback)
  try {
    llmAdapters.push({
      instruction: 'General purpose assistant for tell jokes and funny stories.',
      adapter: new OpenAIAdapter(),
    });
    console.log('  - OpenAI GPT-5 Mini (general purpose) ✅');
  } catch (_error) {
    console.log('  - OpenAI (skipped - no API key)');
  }

  if (llmAdapters.length === 0) {
    console.error(
      '❌ No LLM adapters available! Please set ANTHROPIC_API_KEY, GEMINI_API_KEY, or OPENAI_API_KEY in .env',
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
    enableToolExecutor: true,
  });
  console.log('✅ Agent created with calculator tool\n');

  // 4. Set up event listeners for visibility with timing
  const stepTimings = new Map<number, number>();

  agent.on('session:created', (event) => {
    console.log(`📝 Session created: ${event.session.id}`);
  });

  agent.on('llm:started', (event) => {
    stepTimings.set(event.stepId, Date.now());
    console.log(`\n🤖 LLM call started for step ${event.stepId}`);
    process.stdout.write('   ');
  });

  // Real-time streaming output from LLM
  agent.on('llm:streaming', (event: any) => {
    // Display each chunk as it arrives
    if (event.chunk?.text) {
      process.stdout.write(event.chunk.text);
    }
  });

  agent.on('llm:complete', (event) => {
    const startTime = stepTimings.get(event.stepId);
    const duration = startTime ? Date.now() - startTime : 0;
    console.log('\n');
    console.log(`✅ LLM call completed for step ${event.stepId} (${duration}ms)`);
    console.log(`   Model: ${event.response?.model || 'unknown'}`);
    console.log(
      `   Tokens: ${event.response?.tokensUsed?.total || 0} (prompt: ${event.response?.tokensUsed?.prompt || 0}, completion: ${event.response?.tokensUsed?.completion || 0})`,
    );
  });

  agent.on('step:started', (event) => {
    console.log(`\n⚡ Step ${event.step.stepNumber} started`);
    console.log(`   Action: ${event.step.action}`);
    if (event.step.reasoning) {
      console.log(`   Reasoning: ${event.step.reasoning}`);
    }
  });

  agent.on('step:completed', (event) => {
    console.log(`✅ Step ${event.step.stepNumber} completed`);
    if (event.step.stepResult) {
      console.log(`   Result: ${JSON.stringify(event.step.stepResult, null, 2)}`);
    }
  });

  const toolTimings = new Map<string, number>();

  agent.on('tool:executing', (event) => {
    const key = `${event.sessionId}-${event.toolName}`;
    toolTimings.set(key, Date.now());
    console.log(`\n🔧 Executing tool: ${event.toolName}`);
    console.log('   Parameters:', JSON.stringify(event.parameters, null, 2));
  });

  agent.on('tool:completed', (event) => {
    const key = `${event.sessionId}-${event.toolName}`;
    const startTime = toolTimings.get(key);
    const duration = startTime ? Date.now() - startTime : 0;
    console.log(`✅ Tool completed: ${event.toolName} (${duration}ms)`);
    console.log(`   Success: ${event.result.success}`);
    if (event.result.result) {
      console.log('   Result:', JSON.stringify(event.result.result, null, 2));
    }
    if (event.result.error) {
      console.error(`   Error: ${event.result.error}`);
    }
  });

  agent.on('task:failed', (event) => {
    console.error(`\n❌ Task failed: ${event.error}`);
    if (event.partialResult) {
      console.error('   Partial result:', event.partialResult);
    }
  });

  agent.on('error', (event) => {
    console.error(`\n❌ Error event: ${event.error?.message || 'Unknown error'}`);
    console.error('   Full event:', JSON.stringify(event, null, 2));
  });

  // 5. Execute a task
  console.log('🎯 Executing task...\n');
  console.log('━'.repeat(60));

  const executionStart = Date.now();
  try {
    const result = await agent.execute({
      goal: 'Calculate the result of 15 multiplied by 8, then add 42 to it',
      maxSteps: 10,
      mode: 'auto', // Auto mode - no user confirmations needed
    });

    const executionTime = Date.now() - executionStart;
    console.log(`\n${'━'.repeat(60)}`);
    console.log(`\n🎉 Task execution finished in ${executionTime}ms!\n`);

    // Display detailed step information
    if (result.sessionId) {
      console.log('📊 Execution Summary:');
      console.log(`   Session ID: ${result.sessionId}`);
      console.log(`   Status: ${result.status}`);
      console.log(`   Steps executed: ${result.stepCount}`);
      console.log(`   Total time: ${executionTime}ms`);
      console.log(
        `   Average time per step: ${result.stepCount > 0 ? Math.round(executionTime / result.stepCount) : 0}ms`,
      );

      // Read detailed steps from database
      console.log('\n📝 Detailed Steps:');
      const steps = await adapter.listSteps(result.sessionId);

      for (const step of steps) {
        console.log(`\n   Step ${step.stepNumber}:`);
        console.log(`   ├─ Action: ${step.action}`);
        if (step.selectedTool) {
          console.log(`   ├─ Tool: ${step.selectedTool}`);
        }
        if (step.parameters) {
          const params =
            typeof step.parameters === 'string' ? JSON.parse(step.parameters) : step.parameters;
          console.log(`   ├─ Parameters: ${JSON.stringify(params)}`);
        }
        if (step.stepResult) {
          const result =
            typeof step.stepResult === 'string' ? step.stepResult : JSON.stringify(step.stepResult);
          console.log(`   ├─ Result: ${result}`);
        }
        if (step.reasoning) {
          console.log(`   └─ Reasoning: ${step.reasoning.slice(0, 80)}...`);
        }
      }
    }

    console.log('\n✨ Final Output:');
    console.log(JSON.stringify(result.output, null, 2));

    // Check if there was an error in the result
    if (result.error) {
      console.error('\n❌ Task failed with error:', result.error);
    }
  } catch (error) {
    const executionTime = Date.now() - executionStart;
    console.error(`\n❌ Task failed after ${executionTime}ms:`, error);
    if (error instanceof Error) {
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }

  // 6. Clean up
  await adapter.close();

  const totalTime = Date.now() - startTime;
  console.log(`\n⏱️  Total execution time: ${totalTime}ms`);
  console.log('👋 Agent example completed!');
}

// Run the example
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});