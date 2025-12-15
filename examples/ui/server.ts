/**
 * Backend server for Wukong UI Example
 *
 * This server provides:
 * - REST API for session management
 * - WebSocket for real-time bidirectional communication
 * - SSE for streaming updates
 * - Integration with WukongAgent
 */

import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from workspace root (two levels up from this file)
config({ path: join(__dirname, '../../.env') });
import { LocalAdapter, MigrationRunner } from '@wukong/adapter-local';
import { WukongAgent } from '@wukong/agent';
import type { LLMAdapter } from '@wukong/agent';
import { ClaudeAdapter } from '@wukong/llm-anthropic';
import { GeminiAdapter } from '@wukong/llm-google';
import { OpenAIAdapter } from '@wukong/llm-openai';
import { WukongServer } from '@wukong/server';

// Calculator tool implementation
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
  console.log('🚀 Starting Wukong UI Backend Server\n');

  // 1. Initialize database
  const dbPath = process.env['DATABASE_PATH'] || './data/wukong-ui.db';
  console.log(`📦 Database: ${dbPath}`);

  // Ensure the database directory exists
  const dbDir = dirname(dbPath);
  mkdirSync(dbDir, { recursive: true });

  // Run migrations
  const migrationRunner = new MigrationRunner(dbPath);
  const results = await migrationRunner.migrate();
  if (results.length > 0) {
    console.log(`✅ Applied ${results.length} migration(s)`);
  } else {
    console.log('✅ Database is up to date');
  }

  const adapter = new LocalAdapter({ dbPath });

  // 2. Initialize LLM adapters
  console.log('\n🧠 Setting up LLM adapters...');
  const llmAdapters: LLMAdapter[] = [];

  try {
    llmAdapters.push(
      new ClaudeAdapter({
        model: 'claude-sonnet-4-20250514',
      }),
    );
    console.log('  ✓ Claude Sonnet 4');
  } catch (_error) {
    console.log('  - Claude (no API key)');
  }

  try {
    llmAdapters.push(new GeminiAdapter());
    console.log('  ✓ Gemini 2.5 Pro');
  } catch (_error) {
    console.log('  - Gemini (no API key)');
  }

  try {
    llmAdapters.push(new OpenAIAdapter());
    console.log('  ✓ OpenAI GPT-5 Mini');
  } catch (_error) {
    console.log('  - OpenAI (no API key)');
  }

  if (llmAdapters.length === 0) {
    const rootEnvPath = join(__dirname, '../../.env');
    console.error('\n❌ No LLM adapters available!');
    console.error(`   Please create a .env file in the workspace root: ${rootEnvPath}`);
    console.error('   You can copy from env.example and add at least one API key:');
    console.error('   - ANTHROPIC_API_KEY=sk-ant-...');
    console.error('   - OPENAI_API_KEY=sk-...');
    console.error('   - GEMINI_API_KEY=...\n');
    process.exit(1);
  }

  // 3. Create Wukong Server
  console.log('\n🎭 Starting Wukong Server...');

  const port = Number.parseInt(process.env['PORT'] || '3001', 10);
  const host = process.env['HOST'] || 'localhost';

  const server = new WukongServer({
    port,
    host,
    agent: {
      factory: () =>
        new WukongAgent({
          adapter,
          llm: {
            models: llmAdapters,
            maxRetriesPerModel: 3,
          },
          tools: [calculatorTool],
          defaultMode: 'auto',
          enableToolExecutor: true,
        }),
    },
    cors: {
      origin: true, // Allow all origins in development
      credentials: true,
    },
    websocket: {
      enabled: true,
      path: '/ws',
    },
    sse: {
      enabled: true,
      path: '/events',
    },
    logging: {
      level: 'info',
      format: 'text',
    },
  });

  await server.start();

  const info = server.getInfo();
  console.log('\n✅ Server is running!');
  console.log(`\n📍 HTTP API:    http://${host}:${port}/api`);
  console.log(`📍 WebSocket:   ws://${host}:${port}${info.websocket ? '/ws' : ' (disabled)'}`);
  console.log(`📍 SSE:         http://${host}:${port}${info.sse ? '/events' : ' (disabled)'}`);
  console.log('\n🎨 Frontend:    http://localhost:5173 (run "pnpm dev" in another terminal)');
  console.log('\n💡 Press Ctrl+C to stop');

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n\n👋 Shutting down gracefully...');
    await server.stop();
    await adapter.close();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n\n👋 Shutting down gracefully...');
    await server.stop();
    await adapter.close();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
