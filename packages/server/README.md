# @wukong/server

Production-ready backend server for Wukong agent execution.

## Features

- 🚀 **HTTP REST API** for session and agent management
- 🔄 **WebSocket Support** for real-time bidirectional communication
- 📡 **Server-Sent Events (SSE)** for streaming responses
- 🔐 **Authentication & Authorization** (API key, JWT, or custom)
- ⚡ **Rate Limiting** to prevent abuse
- 📊 **Session Management** with automatic cleanup
- 🛡️ **Security Middleware** (CORS, Helmet, HTTPS enforcement)
- 📝 **Structured Logging** for production monitoring
- 🔌 **Easy Integration** with existing Express apps

## Installation

```bash
pnpm add @wukong/server @wukong/agent @wukong/adapter-local @wukong/llm-anthropic
```

## Quick Start

```typescript
import { WukongServer } from '@wukong/server'
import { WukongAgent } from '@wukong/agent'
import { LocalAdapter } from '@wukong/adapter-local'
import { ClaudeAdapter } from '@wukong/llm-anthropic'

const server = new WukongServer({
  port: 3000,
  agent: {
    factory: () => new WukongAgent({
      adapter: new LocalAdapter({ dbPath: './data/wukong.db' }),
      llm: { models: [new ClaudeAdapter()] }
    })
  }
})

await server.start()
console.log('Server running on http://localhost:3000')
```

## API Endpoints

### Session Management

- `POST /api/sessions` - Create new session
- `GET /api/sessions/:id` - Get session details
- `GET /api/sessions` - List sessions for a user
- `DELETE /api/sessions/:id` - Delete session

### Agent Execution

- `POST /api/sessions/:id/execute` - Execute task (non-streaming)
- `POST /api/sessions/:id/stop` - Stop execution

### System

- `GET /api/health` - Health check
- `GET /api/capabilities` - Get agent capabilities

## WebSocket Communication

Connect to WebSocket endpoint for real-time updates:

```typescript
const ws = new WebSocket('ws://localhost:3000/ws')

// Send execute command
ws.send(JSON.stringify({
  type: 'execute',
  goal: 'Calculate 2 + 2'
}))

// Listen for events
ws.onmessage = (event) => {
  const message = JSON.parse(event.data)
  
  switch (message.type) {
    case 'llm:streaming':
      console.log('LLM output:', message.text)
      break
    case 'tool:executing':
      console.log('Executing tool:', message.tool)
      break
    case 'agent:complete':
      console.log('Task complete:', message.result)
      break
    case 'agent:error':
      console.error('Error:', message.error)
      break
  }
}
```

## Configuration

```typescript
const server = new WukongServer({
  // Server settings
  port: 3000,
  host: '0.0.0.0',
  
  // Agent configuration
  agent: {
    factory: () => new WukongAgent({ /* ... */ })
  },
  
  // CORS
  cors: {
    origin: ['https://app.example.com'],
    credentials: true
  },
  
  // Authentication
  auth: {
    enabled: true,
    type: 'apikey',
    apiKeys: ['secret-key-1']
  },
  
  // Rate limiting
  rateLimit: {
    windowMs: 60 * 1000,
    maxRequests: 60
  },
  
  // Session management
  session: {
    timeout: 30 * 60 * 1000,
    maxSessionsPerUser: 5
  },
  
  // Logging
  logging: {
    level: 'info',
    format: 'json'
  },
  
  // WebSocket
  websocket: {
    enabled: true,
    path: '/ws'
  }
})
```

## License

MIT

