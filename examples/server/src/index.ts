import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { LocalAdapter, MigrationRunner } from '@wukong/adapter-local';
import { WukongAgent } from '@wukong/agent';
import type { LLMAdapter } from '@wukong/agent';
import { ClaudeAdapter } from '@wukong/llm-anthropic';
import { GeminiAdapter } from '@wukong/llm-google';
import { OpenAIAdapter } from '@wukong/llm-openai';
import { WukongServer } from '@wukong/server';
import { config } from './config';
import { calculatorTool } from './tools/calculator';
import { weatherTool } from './tools/weather';

async function main() {
  console.log('🚀 Starting Wukong Server Example\n');
  console.log(`Environment: ${config.server.env}`);
  console.log(`Log Level:   ${config.logging.level}`);

  // 1. Initialize Database
  console.log(`\n📦 Database: ${config.database.path}`);
  mkdirSync(dirname(config.database.path), { recursive: true });

  const migrationRunner = new MigrationRunner(config.database.path);
  await migrationRunner.migrate();

  const adapter = new LocalAdapter({ dbPath: config.database.path });

  // 2. Initialize LLM Models
  console.log('\n🧠 Setting up LLM adapters...');
  const models: LLMAdapter[] = [];

  if (config.llm.anthropicKey) {
    try {
      models.push(new ClaudeAdapter({ apiKey: config.llm.anthropicKey }));
      console.log('  ✓ Anthropic Claude');
    } catch (e) {
      console.warn('  ! Failed to init Claude:', e);
    }
  }

  if (config.llm.geminiKey) {
    try {
      models.push(new GeminiAdapter({ apiKey: config.llm.geminiKey }));
      console.log('  ✓ Google Gemini');
    } catch (e) {
      console.warn('  ! Failed to init Gemini:', e);
    }
  }

  if (config.llm.openaiKey) {
    try {
      models.push(new OpenAIAdapter({ apiKey: config.llm.openaiKey }));
      console.log('  ✓ OpenAI GPT');
    } catch (e) {
      console.warn('  ! Failed to init OpenAI:', e);
    }
  }

  if (models.length === 0) {
    console.warn('\n⚠️  No LLM API keys found. The server will start but agent execution may fail.');
  }

  // 3. Create & Start Server
  const server = new WukongServer({
    port: config.server.port,
    host: config.server.host,

    // Agent Configuration
    agent: {
      factory: () =>
        new WukongAgent({
          adapter,
          llm: { models, maxRetriesPerModel: 2 },
          tools: [calculatorTool, weatherTool],
          defaultMode: 'auto',
        }),
    },

    // Security Configuration
    auth:
      config.auth.enabled && config.auth.key
        ? {
            enabled: true,
            type: 'apikey',
            apiKeys: [config.auth.key],
          }
        : undefined,

    cors: {
      origin: true, // In production, set this to specific domains
      credentials: true,
    },

    // Feature Flags
    websocket: { enabled: true, path: '/ws' },
    sse: { enabled: true, path: '/events' },

    // Production-grade Rate Limiting
    rateLimit: {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 100, // 100 requests per minute
      maxConcurrentExecutions: 5,
    },

    logging: config.logging as any,
  });

  await server.start();

  console.log(`\n✅ Server listening on http://${config.server.host}:${config.server.port}`);
  if (config.auth.enabled) {
    console.log('🔒 Authentication enabled');
  }
}

main().catch(console.error);
