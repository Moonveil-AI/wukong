# Wukong Server Example

A production-ready backend server example for the Wukong Agent Library.

## Features

- **Modular Structure**: Configuration, tools, and server logic are separated.
- **Multiple Interfaces**: REST API, WebSocket, and Server-Sent Events (SSE).
- **Production Ready**:
  - Rate Limiting enabled
  - Authentication support (API Key)
  - Structured logging
  - CORS configuration
- **Tool Integration**: Examples of custom tools (`calculator`, `weather`).

## Getting Started

1. **Install dependencies**
   ```bash
   pnpm install
   ```

2. **Configure Environment**
   ```bash
   cp .env.example .env
   # Edit .env and add your API keys
   ```

3. **Run Development Server**
   ```bash
   pnpm dev
   ```

4. **Build for Production**
   ```bash
   pnpm build
   pnpm start
   ```

## API Endpoints

- `POST /api/sessions`: Create a new session
- `POST /api/sessions/:id/execute`: Execute a command
- `GET /api/sessions/:id/history`: Get chat history
- `GET /ws`: WebSocket connection endpoint

## Project Structure

- `src/config.ts`: Environment and application configuration
- `src/tools/`: Custom tool definitions
- `src/index.ts`: Main server entry point

