# Execution Adapters

Execution Adapters let you run sub-agents in different ways depending on your environment.

## 📋 Overview

Wukong supports two execution modes:

| Adapter | Best For | Key Feature |
|---------|----------|-------------|
| **PromiseAdapter** | Local development, long-running servers | Promise-based async execution |
| **InngestAdapter** | Serverless (Vercel, AWS Lambda) | Distributed task queue via Inngest |

## 🎯 PromiseAdapter (Local Development)

### Basic Usage

```typescript
import { WukongAgent } from '@wukong/agent';
import { LocalAdapter } from '@wukong/adapter-local';
import { ClaudeAdapter } from '@wukong/llm-anthropic';
import { PromiseAdapter } from '@wukong/agent';

// Create a Promise Adapter
const executionAdapter = new PromiseAdapter(eventEmitter);

const agent = new WukongAgent({
  adapter: new LocalAdapter({ dbPath: './data/wukong.db' }),
  llm: new ClaudeAdapter({ apiKey: process.env.ANTHROPIC_API_KEY }),
  // Pass in the execution adapter
  executionAdapter,
});

// Fork a sub-agent
const result = await agent.execute({
  goal: 'Generate 3 different video scripts in parallel',
  mode: 'auto',
});
```

### How It Works

```
┌──────────────────────────────────────┐
│         Parent Agent                 │
│                                      │
│  1. forkAutoAgent()                 │
│     └─> Creates task record         │
│     └─> PromiseAdapter.execute()    │
│     └─> Runs async in background    │
│                                      │
│  2. Continues with other work...    │
│                                      │
│  3. waitForSubAgent()               │
│     └─> Polls database for status   │
│                                      │
└──────────────────────────────────────┘
            │
            │ Database
            ↓
┌──────────────────────────────────────┐
│         Sub-Agent                    │
│                                      │
│   Runs async in same process        │
│   Syncs state via database          │
│                                      │
└──────────────────────────────────────┘
```

### ⚠️ Limitations

- **Not for Serverless**: Requires a long-running process
- **Single process**: JavaScript is single-threaded, not truly parallel
- **Memory usage**: All sub-agents run in the same process

## 🚀 InngestAdapter (Production)

### Prerequisites

1. Install the Inngest SDK:
```bash
pnpm add inngest
```

2. Sign up for Inngest: https://www.inngest.com/

3. Get your API key

### Setup

#### 1. Create an Inngest Client

```typescript
// lib/inngest/client.ts
import { Inngest } from 'inngest';

export const inngest = new Inngest({
  id: 'wukong-agent',
  eventKey: process.env.INNGEST_EVENT_KEY,
});
```

#### 2. Create Inngest Functions

```typescript
// lib/inngest/functions/fork-agent.ts
import { inngest } from '../client';
import { AutoAgent } from '@wukong/agent';
import { storageAdapter, llmCaller } from '../../config';

export const forkAgentFunction = inngest.createFunction(
  {
    id: 'fork-agent',
    retries: 3,
    timeout: '10m',
  },
  { event: 'agent/fork.execute' },
  async ({ event, step }) => {
    const {
      taskId,
      goal,
      maxSteps,
      timeoutSeconds,
      userId,
      organizationId,
    } = event.data;

    // Step 1: Mark task as running
    await step.run('update-status', async () => {
      await storageAdapter.updateForkAgentTask(taskId, {
        status: 'running',
        startedAt: new Date(),
      });
    });

    // Step 2: Run the sub-agent
    const result = await step.run('execute-agent', async () => {
      const agent = new AutoAgent({
        storageAdapter,
        llmCaller,
        // ... other config
        maxSteps,
        timeoutSeconds,
      });

      return await agent.execute({
        goal,
        context: { userId, organizationId },
      });
    });

    // Step 3: Save the result
    await step.run('save-result', async () => {
      await storageAdapter.updateForkAgentTask(taskId, {
        status: 'completed',
        resultSummary: JSON.stringify(result.result),
        stepsExecuted: result.stepsExecuted,
        tokensUsed: result.tokensUsed,
        completedAt: new Date(),
      });
    });

    return { success: true, taskId };
  }
);
```

#### 3. Register the Inngest API Route

For Next.js App Router:

```typescript
// app/api/inngest/route.ts
import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest/client';
import { forkAgentFunction } from '@/lib/inngest/functions/fork-agent';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    forkAgentFunction,
    // ... other functions
  ],
});
```

For Next.js Pages Router:

```typescript
// pages/api/inngest.ts
import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest/client';
import { forkAgentFunction } from '@/lib/inngest/functions/fork-agent';

export default serve({
  client: inngest,
  functions: [forkAgentFunction],
});
```

#### 4. Use InngestAdapter in Your Agent

```typescript
import { WukongAgent, InngestAdapter } from '@wukong/agent';
import { inngest } from './lib/inngest/client';

// Create an Inngest Adapter
const executionAdapter = new InngestAdapter(
  {
    inngest,
    appUrl: process.env.APP_URL, // e.g., https://your-app.vercel.app
  },
  eventEmitter
);

const agent = new WukongAgent({
  adapter: vercelAdapter,
  llm: claudeAdapter,
  executionAdapter, // Use the Inngest Adapter
});

// Fork a sub-agent (will now run via Inngest)
const result = await agent.execute({
  goal: 'Generate marketing content',
  mode: 'auto',
});
```

### How It Works

```
┌──────────────────────────────────────┐
│   Parent Agent (Vercel Function)    │
│                                      │
│  1. forkAutoAgent()                 │
│     └─> InngestAdapter.execute()   │
│     └─> Sends Inngest event         │
│     └─> Returns immediately         │
│                                      │
│  2. Function completes & exits      │
│                                      │
└──────────────────────────────────────┘
            │
            │ Inngest Event Queue
            ↓
┌──────────────────────────────────────┐
│     Inngest Worker                   │
│                                      │
│  1. Receives event                  │
│  2. Spins up new Function instance  │
│  3. Runs sub-agent                  │
│  4. Saves result to database        │
│                                      │
└──────────────────────────────────────┘
            │
            │ Database
            ↓
┌──────────────────────────────────────┐
│   Parent Agent Polls for Result     │
│                                      │
│  waitForSubAgent()                  │
│  └─> Polls database for status      │
│  └─> Retrieves result               │
│                                      │
└──────────────────────────────────────┘
```

### ✅ Benefits

- **Serverless-friendly**: No long-running process needed
- **True parallelism**: Each sub-agent runs in its own Function instance
- **Reliability**: Built-in retries and timeout handling
- **Observability**: Monitor everything in the Inngest Dashboard

## 🔄 Switching Between Adapters

### Environment Variables

```bash
# .env.local

# Local development
EXECUTION_ADAPTER=promise

# Production
EXECUTION_ADAPTER=inngest
INNGEST_EVENT_KEY=your-inngest-key
APP_URL=https://your-app.vercel.app
```

### Dynamic Selection

```typescript
import { WukongAgent, PromiseAdapter, InngestAdapter } from '@wukong/agent';

// Choose adapter based on environment
const executionAdapter = 
  process.env.EXECUTION_ADAPTER === 'inngest'
    ? new InngestAdapter({ inngest }, eventEmitter)
    : new PromiseAdapter(eventEmitter);

const agent = new WukongAgent({
  adapter,
  llm,
  executionAdapter,
});
```

## 📊 Performance Comparison

| Metric | PromiseAdapter | InngestAdapter |
|--------|----------------|----------------|
| **Startup latency** | ~0ms | ~100-500ms |
| **Concurrency** | Limited by process memory | Unlimited |
| **Cost** | Server costs | Inngest fee + Function costs |
| **Reliability** | Fails if process crashes | Auto-retry |
| **Monitoring** | DIY | Inngest Dashboard |

## 🧪 Testing

### Local Testing (PromiseAdapter)

```typescript
import { describe, it, expect } from 'vitest';
import { PromiseAdapter } from '@wukong/agent';

describe('PromiseAdapter', () => {
  it('should execute sub-agent', async () => {
    const adapter = new PromiseAdapter();
    
    await adapter.executeSubAgent({
      task,
      storageAdapter,
      llmCaller,
      tools: [],
      apiKeys: {},
    });

    const result = await adapter.waitForCompletion(task.id, 60000);
    expect(result.status).toBe('completed');
  });
});
```

### Testing with Inngest

Inngest provides a dev mode for local testing:

```bash
pnpm dlx inngest-cli@latest dev
```

This starts a local Inngest server where you can test your functions.

## ❓ FAQ

### Do I have to use an adapter?

No. If you don't provide an `executionAdapter`, the agent will use a built-in Promise implementation for backward compatibility.

### Can I create a custom adapter?

Yes! Just implement the `ExecutionAdapter` interface:

```typescript
import { ExecutionAdapter } from '@wukong/agent';

class CustomAdapter implements ExecutionAdapter {
  async executeSubAgent(options) {
    // Your implementation here
  }
  
  async waitForCompletion(taskId, timeoutMs) {
    // Your implementation here
  }
  
  // ... other methods
}
```

### What does InngestAdapter cost?

Inngest's free tier includes:
- 50K events per month
- Enough for ~1,000 sub-agent tasks per day

Paid plans start around $1 per 1,000 events.

### Can I use InngestAdapter locally?

Absolutely! Just use the Inngest Dev Server:

```bash
pnpm dlx inngest-cli@latest dev
```

## 🔗 Related Docs

- [Agent Fork Design](../design/06-advanced-features.md)
- [Inngest Documentation](https://www.inngest.com/docs)
- [Vercel Deployment Guide](https://vercel.com/docs)

