# @wukong/client

Official JavaScript/TypeScript client for connecting to Wukong server.

## Features

- 🌐 **HTTP REST API** - Session management and task execution
- 🔄 **WebSocket** - Real-time bidirectional communication  
- 📡 **Server-Sent Events (SSE)** - Streaming responses
- 📘 **TypeScript** - Full type safety
- 🪶 **Lightweight** - Zero dependencies (browser natives only)
- 🎯 **Framework Agnostic** - Works with React, Vue, Angular, vanilla JS, Node.js

## Installation

```bash
npm install @wukong/client
# or
pnpm add @wukong/client
```

## Quick Start

```typescript
import { WukongClient } from '@wukong/client';

// Create client
const client = new WukongClient('http://localhost:3001');

// Check health
await client.healthCheck();

// Create session
const session = await client.createSession('my-user-id');

// Connect to SSE for streaming events
client.connectSSE(session.id);

// Listen to events
client.on((event) => {
  switch (event.type) {
    case 'llm:streaming':
      console.log('LLM output:', event.text);
      break;
    case 'tool:executing':
      console.log('Executing tool:', event.toolName);
      break;
    case 'agent:complete':
      console.log('Task complete!', event.result);
      break;
  }
});

// Execute task
await client.execute(session.id, {
  goal: 'Calculate 15 * 8 + 42',
  maxSteps: 10,
  mode: 'auto'
});

// Clean up
client.disconnect();
```

## API Reference

### Constructor

```typescript
new WukongClient(baseUrl?: string)
```

- `baseUrl`: Server URL (default: `http://localhost:3001`)

### Session Management

```typescript
// Create new session
await client.createSession(userId?: string): Promise<SessionInfo>

// Get session details  
await client.getSession(sessionId: string): Promise<SessionInfo>

// List user sessions
await client.listSessions(userId: string): Promise<SessionInfo[]>

// Delete session
await client.deleteSession(sessionId: string): Promise<void>
```

### Task Execution

```typescript
// Execute task (async, returns immediately)
await client.execute(sessionId: string, options: ExecuteRequest): Promise<ExecuteResponse>

// Stop execution
await client.stopExecution(sessionId: string): Promise<void>

// Get history
await client.getHistory(sessionId: string): Promise<HistoryResponse>
```

### Real-time Communication

```typescript
// Connect via SSE (recommended for streaming)
client.connectSSE(sessionId: string): void
client.disconnectSSE(): void

// Connect via WebSocket (bidirectional)
await client.connectWebSocket(sessionId: string): Promise<void>
client.disconnectWebSocket(): void

// Event handling
client.on(handler: EventHandler): void
client.off(handler: EventHandler): void

// Cleanup all connections
client.disconnect(): void
```

### System

```typescript
// Health check
await client.healthCheck(): Promise<{ status: string; timestamp: string }>

// Get capabilities
await client.getCapabilities(): Promise<Capability[]>
```

## Event Types

```typescript
type AgentEvent =
  | { type: 'session:created'; session: SessionInfo }
  | { type: 'llm:started'; stepId: number; model: string }
  | { type: 'llm:streaming'; text: string; index: number; isFinal: boolean }
  | { type: 'llm:complete'; stepId: number; response: any }
  | { type: 'step:started'; step: any }
  | { type: 'step:completed'; step: any }
  | { type: 'tool:executing'; sessionId: string; toolName: string; parameters: any }
  | { type: 'tool:completed'; sessionId: string; toolName: string; result: any }
  | { type: 'agent:progress'; sessionId: string; progress: any }
  | { type: 'agent:complete'; sessionId: string; result: any }
  | { type: 'agent:error'; sessionId: string; error: string };
```

## Usage with React

For React applications, use with `@wukong/ui`:

```typescript
import { WukongClient } from '@wukong/client';
import { useWukongClient } from '@wukong/ui';

function App() {
  const { messages, sendMessage, isExecuting } = useWukongClient({
    apiUrl: 'http://localhost:3001',
    restoreSession: true
  });
  
  // ...
}
```

## License

MIT

