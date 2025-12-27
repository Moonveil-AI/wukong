/**
 * Backend server for Wukong UI Example
 */

import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LocalAdapter, MigrationRunner } from '@wukong/adapter-local';
import { WukongAgent } from '@wukong/agent';
import { ClaudeAdapter } from '@wukong/llm-anthropic';
import { GeminiAdapter } from '@wukong/llm-google';
import { OpenAIAdapter } from '@wukong/llm-openai';
import { WukongServer } from '@wukong/server';
import { calculatorTool } from '@wukong/tools-examples';
import { config } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '../../.env') });

async function main() {
  // Initialize database
  const dbPath = process.env.DATABASE_PATH || './data/wukong-ui.db';
  mkdirSync(dirname(dbPath), { recursive: true });
  await new MigrationRunner(dbPath).migrate();
  const adapter = new LocalAdapter({ dbPath });

  // Initialize LLM adapters
  const llmAdapters = [
    new ClaudeAdapter({ model: 'claude-sonnet-4-20250514' }),
    new GeminiAdapter(),
    new OpenAIAdapter(),
  ].filter((model) => {
    try {
      return !!model;
    } catch {
      return false;
    }
  });

  if (llmAdapters.length === 0) {
    console.error('❌ No LLM adapters available! Please add API keys to .env');
    process.exit(1);
  }

  // Create and start server
  const port = Number.parseInt(process.env.PORT || '3001', 10);
  const server = new WukongServer({
    port,
    host: process.env.HOST || 'localhost',
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
    cors: { origin: true, credentials: true },
    websocket: { enabled: true, path: '/ws' },
    sse: { enabled: true, path: '/events' },
  });

  await server.start();
  console.log(`✅ Server running on http://localhost:${port}`);

  // Graceful shutdown
  const shutdown = async () => {
    await server.stop();
    await adapter.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch(console.error);
