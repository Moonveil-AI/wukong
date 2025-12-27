# /examples/server

Server-based example with HTTP API for remote agent execution.

<!-- SYNC: When files in this directory change, update this document. -->

## Purpose

Demonstrates how to run Wukong agents as a backend service with REST API endpoints, suitable for client-server architectures.

## File Structure

| Directory/File | Role | Purpose |
|----------------|------|---------|
| `src/index.ts` | Entry | HTTP server setup |
| `src/config.ts` | Config | Server configuration |
| `src/tools/` | Integration | Custom tool implementations |
| `package.json` | Config | Dependencies and scripts |
| `tsconfig.json` | Config | TypeScript configuration |
| `env.example` | Config | Environment variable template |
| `README.md` | Docs | API documentation |

## Key Features Demonstrated

- HTTP REST API for agent control
- WebSocket streaming for real-time events
- Custom tool registration
- Multi-session management
- Authentication middleware

## API Endpoints

- `POST /api/sessions` - Create session
- `POST /api/sessions/:id/execute` - Execute step
- `GET /api/sessions/:id/history` - Get history
- `WS /api/sessions/:id/stream` - Stream events

## Running

```bash
cp env.example .env
# Edit .env with configuration
pnpm install
pnpm build
pnpm start
```

