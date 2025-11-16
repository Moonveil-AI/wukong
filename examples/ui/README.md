# Wukong Agent UI Example

A real agent UI demonstration using React and the Wukong agent framework. This example provides a complete chat interface for interacting with a Wukong agent.

## Features

- **Real-time Chat Interface**: Interactive chat UI with message history
- **Agent Capabilities Display**: Shows what the agent can and cannot do
- **Example Prompts**: Pre-built prompts to help users get started
- **Tool Execution Visualization**: Real-time display of tool executions
- **Streaming Responses**: Agent responses stream in real-time
- **Theme Support**: Light, dark, and auto theme modes
- **Responsive Design**: Works on desktop and mobile devices

## Architecture

This example demonstrates a production-ready agent UI pattern:

### Frontend (Browser)
- React UI with chat interface
- Real-time message streaming
- Tool execution visualization
- Theme management with `@wukong/ui`

### Backend (Server)
Wukong provides a production-ready backend server package (`@wukong/server`) that:
1. Runs the Wukong agent with full capabilities
2. Provides WebSocket and Server-Sent Events for real-time communication
3. Manages conversation sessions and history
4. Includes authentication and rate limiting
5. Offers deployment configurations for major platforms

See `examples/server` for a complete backend implementation.

### Current Implementation
This demo includes:
- **UI Components**: Full chat interface with sidebar
- **Simulated Responses**: Demonstrates the interaction patterns without a real backend
- **Tool Display**: Shows how tool executions would be visualized

**Note:** This example currently uses simulated responses for demonstration purposes. To connect to a real Wukong backend server, see the [Connecting to a Real Backend](#connecting-to-a-real-agent-backend) section below.

## Quick Start

```bash
# Install dependencies (from workspace root)
pnpm install

# Start the development server
cd examples/ui
pnpm dev
```

Then open http://localhost:5173 in your browser.

## Usage

1. **View Capabilities**: Check the sidebar to see what the agent can do
2. **Try Examples**: Click any example prompt to populate the input
3. **Chat**: Type your message and press Send
4. **Watch Tools**: See tool executions in real-time
5. **Theme**: Switch between light, dark, or auto themes

## Example Prompts

Try these prompts to see the agent in action:

- "Calculate the result of 15 multiplied by 8, then add 42 to it"
- "What is the square root of 144, then multiply it by 5, and finally subtract 10?"
- "What can you help me with? What are your capabilities?"

## Components Used

This example uses several components from `@wukong/ui`:

- **ThemeProvider**: Manages theme state and color schemes
- **CapabilitiesPanel**: Displays agent capabilities
- **ExamplePrompts**: Shows clickable example prompts
- **useTheme**: Hook for accessing theme state

## Connecting to a Real Agent Backend

To connect this UI to a real Wukong agent backend:

### 1. Create a Backend Server

```typescript
// server.ts
import { WukongAgent } from '@wukong/agent';
import { LocalAdapter } from '@wukong/adapter-local';
import { ClaudeAdapter } from '@wukong/llm-anthropic';
import express from 'express';
import { WebSocketServer } from 'ws';

const app = express();
const server = app.listen(3000);
const wss = new WebSocketServer({ server });

const adapter = new LocalAdapter({ dbPath: './data/wukong.db' });
const agent = new WukongAgent({
  adapter,
  llm: { models: [new ClaudeAdapter()] },
  tools: [/* your tools */],
});

wss.on('connection', (ws) => {
  // Handle agent execution with streaming
  ws.on('message', async (data) => {
    const { goal } = JSON.parse(data.toString());
    
    // Set up streaming
    agent.on('llm:streaming', (event) => {
      ws.send(JSON.stringify({ type: 'stream', data: event.chunk }));
    });
    
    agent.on('tool:executing', (event) => {
      ws.send(JSON.stringify({ type: 'tool_start', data: event }));
    });
    
    agent.on('tool:completed', (event) => {
      ws.send(JSON.stringify({ type: 'tool_complete', data: event }));
    });
    
    // Execute the task
    const result = await agent.execute({ goal });
    ws.send(JSON.stringify({ type: 'complete', data: result }));
  });
});
```

### 2. Update the Frontend

```typescript
// Connect to WebSocket in useEffect
const ws = new WebSocket('ws://localhost:3000');

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  
  switch (message.type) {
    case 'stream':
      // Update streaming message
      break;
    case 'tool_start':
      // Add tool execution
      break;
    case 'tool_complete':
      // Update tool status
      break;
    case 'complete':
      // Finalize response
      break;
  }
};

// Send messages
const handleSubmit = () => {
  ws.send(JSON.stringify({ goal: inputValue }));
};
```

## Development

### Project Structure

```
examples/ui/
├── src/
│   ├── App.tsx          # Main agent UI component
│   ├── App.css          # Agent UI styles
│   ├── main.tsx         # React entry point
│   └── index.css        # Global styles
├── index.html           # HTML template
├── package.json         # Dependencies
└── vite.config.ts       # Vite configuration
```

### Available Scripts

- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm preview` - Preview production build

## Technologies

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **@wukong/ui** - Wukong UI components
- **@wukong/agent** - Wukong agent framework (types)

## Next Steps

To make this a fully functional agent UI:

1. **Backend Integration**: Set up a Node.js server running the Wukong agent
2. **WebSocket Connection**: Implement real-time bidirectional communication
3. **Session Management**: Persist and restore conversation sessions
4. **Authentication**: Add user authentication and authorization
5. **File Upload**: Allow users to upload documents for the agent to process
6. **History**: Show previous conversations and sessions
7. **Settings**: Allow users to configure agent behavior
8. **Export**: Let users export conversation transcripts

## Learn More

- [Wukong Documentation](../../docs/)
- [Agent Architecture](../../docs/design/02-architecture.md)
- [UI Components](../../packages/ui/)
- [Basic Example](../basic/) - Backend agent implementation

## License

MIT
