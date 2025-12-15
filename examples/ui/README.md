# Wukong UI Example

A full-stack example demonstrating Wukong agent with a beautiful React UI connected to a real backend server.

## Features

✨ **Full Stack Integration**
- React frontend with beautiful UI components from `@wukong/ui`
- Backend server using `@wukong/server` library
- Real-time communication via WebSocket and Server-Sent Events (SSE)
- RESTful API for session management

🎨 **Rich UI Components**
- Theme support (light/dark/auto)
- Real-time streaming responses
- Tool execution visualization
- Capabilities panel
- Example prompts
- Todo list for task tracking

🚀 **Production Ready**
- TypeScript throughout
- Error handling
- Session management
- Multiple LLM provider support (Claude, Gemini, OpenAI)

## Quick Start

### 1. Install Dependencies

```bash
# From the workspace root
pnpm install
```

### 2. Set Up Environment Variables

This example uses the `.env` file from the **workspace root** (not in examples/ui).

If you don't have a `.env` file in the root yet:

```bash
# Go to workspace root
cd ../..

# Copy example
cp env.example .env

# Edit and add at least one LLM API key
```

Required environment variables in root `.env`:

```env
# Required: At least one LLM API key
ANTHROPIC_API_KEY=sk-ant-...
# or
GEMINI_API_KEY=...
# or
OPENAI_API_KEY=sk-...
```

The backend will automatically use the root `.env` file - no need to copy it!

### 3. Run the Application

**Option A: Run both frontend and backend together (recommended)**

```bash
pnpm dev:all
```

This will start:
- Backend server on `http://localhost:3001`
- Frontend dev server on `http://localhost:3000`

**Option B: Run separately**

Terminal 1 (Backend):
```bash
pnpm dev:server
```

Terminal 2 (Frontend):
```bash
pnpm dev
```

### 4. Open in Browser

Navigate to `http://localhost:3000` and start chatting with the agent!

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Frontend (React)                   │
│  ┌───────────────────────────────────────────────┐  │
│  │  App.tsx                                       │  │
│  │  ├─ UI Components (@wukong/ui)                │  │
│  │  └─ API Client (src/api/client.ts)           │  │
│  └───────────────────────────────────────────────┘  │
└──────────────────┬──────────────────────────────────┘
                   │
                   │ REST API + WebSocket + SSE
                   │
┌──────────────────▼──────────────────────────────────┐
│              Backend (Node.js)                       │
│  ┌───────────────────────────────────────────────┐  │
│  │  server.ts                                     │  │
│  │  ├─ WukongServer (@wukong/server)             │  │
│  │  ├─ WukongAgent (@wukong/agent)               │  │
│  │  ├─ LocalAdapter (@wukong/adapter-local)      │  │
│  │  └─ LLM Adapters (Claude/Gemini/OpenAI)       │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

## API Client

The frontend uses `src/api/client.ts` which provides:

### REST API Methods
- `createSession()` - Create a new agent session
- `execute()` - Execute a task (async, returns immediately)
- `getSession()` - Get session details
- `getHistory()` - Get chat history
- `stopExecution()` - Stop current execution
- `getCapabilities()` - Get agent capabilities
- `healthCheck()` - Check server health

### Real-time Communication
- **WebSocket**: Bidirectional communication for control commands
- **SSE (Server-Sent Events)**: Streaming updates from the server

### Event Types
The client emits various events:
- `llm:started` - LLM generation started
- `llm:streaming` - Streaming text chunk
- `llm:complete` - LLM generation completed
- `step:started` - Agent step started
- `step:completed` - Agent step completed
- `tool:executing` - Tool execution started
- `tool:completed` - Tool execution completed
- `agent:complete` - Task completed
- `agent:error` - Error occurred

## Project Structure

```
examples/ui/
├── server.ts              # Backend server using @wukong/server
├── src/
│   ├── api/
│   │   └── client.ts     # API client for frontend
│   ├── App.tsx           # Main React component
│   ├── App.css           # Styles
│   ├── main.tsx          # React entry point
│   └── index.css         # Global styles
├── package.json
├── vite.config.ts        # Vite configuration with proxy
├── env.template          # Environment variables template
└── README.md            # This file
```

## Customization

### Adding Custom Tools

Edit `server.ts` to add your custom tools:

```typescript
const myTool = {
  metadata: {
    name: 'my_tool',
    description: 'Description of what the tool does',
    version: '1.0.0',
    category: 'data' as const,
    riskLevel: 'low' as const,
  },
  schema: {
    type: 'object' as const,
    properties: {
      param1: { type: 'string', description: 'Parameter description' },
    },
    required: ['param1'],
  },
  handler: (params: any) => {
    // Tool implementation
    return { success: true, result: 'Result' };
  },
};

// Add to agent configuration
const server = new WukongServer({
  agent: {
    factory: () => new WukongAgent({
      tools: [calculatorTool, myTool], // Add your tool here
      // ...
    })
  }
});
```

### Changing LLM Models

Edit `server.ts` to configure different models:

```typescript
llmAdapters.push(
  new ClaudeAdapter({
    model: 'claude-3-5-sonnet-20241022', // Change model
    temperature: 0.7,                      // Adjust temperature
    maxTokens: 4096,                       // Set max tokens
  }),
);
```

### Customizing UI Theme

The UI uses `@wukong/ui` theme system. Customize in `App.tsx`:

```typescript
<ThemeProvider 
  defaultMode="dark"  // light | dark | auto
  customTheme={{
    // Override theme colors
    colors: {
      primary: '#your-color',
      // ...
    }
  }}
>
  <AgentUI />
</ThemeProvider>
```

## Backend API Endpoints

The server exposes these endpoints:

- `POST /api/sessions` - Create session
- `GET /api/sessions/:id` - Get session
- `GET /api/sessions` - List sessions
- `DELETE /api/sessions/:id` - Delete session
- `POST /api/sessions/:id/execute` - Execute task
- `POST /api/sessions/:id/stop` - Stop execution
- `GET /api/sessions/:id/history` - Get history
- `GET /api/capabilities` - Get capabilities
- `GET /api/health` - Health check
- `GET /events/:sessionId` - SSE endpoint
- `WS /ws` - WebSocket endpoint

## Troubleshooting

### Backend won't start

1. Check that you have at least one LLM API key in `.env`
2. Ensure the database directory exists: `mkdir -p data`
3. Check that port 3001 is available

### Frontend can't connect to backend

1. Make sure the backend is running on port 3001
2. Check `VITE_API_URL` in `.env` (should be `http://localhost:3001`)
3. Verify proxy settings in `vite.config.ts`

### Database errors

Delete the database and restart:
```bash
rm -rf data/wukong-ui.db*
pnpm dev:server
```

### LLM errors

1. Verify your API keys are correct
2. Check your API quota/credits
3. Look at the backend console for detailed error messages

## Development

### Running Tests

```bash
# Test the backend server
cd ../../packages/server
pnpm test

# Test the agent
cd ../agent
pnpm test
```

### Building for Production

```bash
# Build frontend
pnpm build

# Preview production build
pnpm preview
```

### Type Checking

```bash
# Check types
pnpm tsc --noEmit
```

## Learn More

- [Wukong Agent Documentation](../../docs/)
- [@wukong/server Package](../../packages/server/)
- [@wukong/ui Components](../../packages/ui/)
- [@wukong/agent Core](../../packages/agent/)

## License

MIT
