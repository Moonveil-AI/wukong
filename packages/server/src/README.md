# /packages/server/src

HTTP/WebSocket server for remote agent execution and streaming.

<!-- SYNC: When files in this directory change, update this document. -->

## Architecture

This package provides an HTTP server with REST API and WebSocket support for running Wukong agents remotely. It enables client-server architectures and multi-user deployments.

## File Structure

| Directory/File | Role | Purpose |
|----------------|------|---------|
| `index.ts` | Export | Exports public server API |
| `server.ts` | Entry | HTTP server setup and middleware |
| `routes/` | Core | REST API endpoint handlers |
| `websocket/` | Core | WebSocket connection handlers |
| `middleware/` | Support | Auth, CORS, rate limiting |
| `types.ts` | Support | Server-specific type definitions |

## API Routes

| Route | Purpose |
|-------|---------|
| `POST /api/sessions` | Create new agent session |
| `GET /api/sessions/:id` | Get session details |
| `POST /api/sessions/:id/execute` | Execute agent step |
| `POST /api/sessions/:id/stop` | Stop agent execution |
| `GET /api/sessions/:id/history` | Get session history |
| `WS /api/sessions/:id/stream` | WebSocket streaming connection |

## Key Features

- **REST API**: Stateless HTTP endpoints for agent control
- **WebSocket Streaming**: Real-time event streaming
- **Authentication**: API key and JWT support
- **Rate Limiting**: Protect against abuse
- **Multi-tenancy**: Isolated sessions per user

