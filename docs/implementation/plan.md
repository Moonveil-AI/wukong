# Wukong Engine Implementation Plan

> A step-by-step plan to build the Wukong Agent Library from scratch

**Created:** November 12, 2025  
**Status:** Ready for Implementation

---

## Table of Contents

- [Phase 1: Foundation & Setup](#phase-1-foundation--setup) ✅
- [Phase 2: Core Agent System](#phase-2-core-agent-system) ✅
- [Phase 3: Tools & Knowledge Base](#phase-3-tools--knowledge-base) ✅
- [Phase 4: Advanced Features](#phase-4-advanced-features) ✅
- [Phase 5: Optimization & Polish](#phase-5-optimization--polish)
- [Phase 6: Backend Server Package](#phase-6-backend-server-package)
- [Phase 7: UI Components Package](#phase-7-ui-components-package)
- [Phase 8: Documentation & Examples](#phase-8-documentation--examples)

---

## Phase 1: Foundation & Setup ✅

**Status:** Completed

Established the foundational infrastructure including:
- ✅ Complete monorepo structure with 9 packages
- ✅ TypeScript configuration with strict type checking
- ✅ Build tooling (tsup) and testing framework (Vitest)
- ✅ Linting and formatting (Biome)
- ✅ Core type definitions and interfaces
- ✅ Complete database schema with migrations
- ✅ Support for both Vercel Postgres and local SQLite

**See:** [phase-1-foundation.md](./phase-1-foundation.md) for detailed implementation steps.

---

## Phase 2: Core Agent System ✅

**Status:** Completed

Implemented the core agent execution system including:
- ✅ Event system with typed events and error handling
- ✅ Storage adapters for both Vercel (Postgres/KV/Blob) and Local (SQLite/FS)
- ✅ LLM integrations for OpenAI, Anthropic Claude, and Google Gemini
- ✅ Multi-model fallback system with automatic retries
- ✅ Prompt builder with Tool Executor mode support
- ✅ Response parser with Zod validation
- ✅ Session management with checkpoints
- ✅ Step executor for all action types
- ✅ Stop controller for safe execution control
- ✅ InteractiveAgent and AutoAgent implementations
- ✅ Main WukongAgent class with complete API

**See:** [phase-2-core-agent.md](./phase-2-core-agent.md) for detailed implementation steps

---

## Phase 3: Tools & Knowledge Base ✅

**Status:** Completed

Implemented the complete tools system and knowledge base infrastructure including:
- ✅ Tool registry with auto-discovery and MCP format
- ✅ Tool executor with parameter validation and error handling
- ✅ Async tool executor for long-running operations
- ✅ Parallel tool executor with multiple wait strategies
- ✅ Document processor supporting PDF, DOCX, MD, HTML, TXT
- ✅ Document chunker with overlap and metadata preservation
- ✅ Embedding generator using OpenAI API
- ✅ Vector storage adapter with pgvector and similarity search
- ✅ Knowledge base manager for indexing and searching
- ✅ Knowledge extractor for automated learning from sessions

**See:** [phase-3-tools-knowledge-base.md](./phase-3-tools-knowledge-base.md) for detailed implementation steps

---

## Phase 4: Advanced Features ✅

**Status:** Completed

Implemented advanced capabilities for agent enhancement including:
- ✅ Todo manager with progress tracking and dependencies
- ✅ Agent fork for spawning sub-agents with context compression
- ✅ Step management (discard & compress) for token optimization
- ✅ Tool Executor mode reducing tool definition tokens by 95%
- ✅ Skills system with lazy loading for 96% token reduction

**See:** [phase-4-advanced-features.md](./phase-4-advanced-features.md) for detailed implementation steps

---

## Phase 5: Optimization & Polish

### Task 5.1: Token Counting and Monitoring ✅

**Status:** Completed

**Purpose:** Track token usage and cost for optimization.

**Referenced Documentation:**
- `docs/design/08-token-optimization.md` - Token usage monitoring

**Implementation:**
1. Create `packages/agent/src/monitoring/TokenMonitor.ts`:
   - Count tokens for prompts
   - Count tokens for responses
   - Calculate costs
   - Track savings from optimizations
   - Emit `tokens:used` events

**Tests:** ✅
- ✅ Token counting is accurate
- ✅ Cost calculation is correct
- ✅ Savings are tracked
- ✅ Events are emitted

**Verify Steps:**
```typescript
const monitor = new TokenMonitor()

agent.on('tokens:used', (usage) => {
  console.log('Tokens:', usage.totalTokens)
  console.log('Cost:', usage.estimatedCost)
  console.log('Savings:', usage.savings)
})

await agent.execute({ goal: 'test' })
```

---

### Task 5.2: Concurrency Control

**Purpose:** Prevent race conditions and ensure data consistency.

**Referenced Documentation:**
- `docs/design/14-implementation-patterns.md` - Concurrency control

**Implementation:**
1. Create distributed locks using cache adapter
2. Implement database row locking where needed
3. Add lock utilities

**Tests:**
- Locks prevent concurrent modifications
- Locks are released on errors
- Lock timeouts work
- Deadlocks are prevented

**Verify Steps:**
```typescript
const lock = new DistributedLock(cacheAdapter)

await lock.withLock(`session:${sessionId}`, async () => {
  // Critical section - only one process at a time
  const session = await getSession(sessionId)
  session.status = 'running'
  await saveSession(session)
})
```

---

### Task 5.3: Batch Processing

**Purpose:** Batch multiple operations for better performance.

**Referenced Documentation:**
- `docs/design/14-implementation-patterns.md` - Batch operations

**Implementation:**
1. Create `packages/agent/src/utils/BatchProcessor.ts`:
   - Queue operations
   - Flush on batch size or timeout
   - Handle errors

2. Apply to embedding generation

**Tests:**
- Multiple calls are batched
- Flush on size works
- Flush on timeout works
- Errors don't affect other items

**Verify Steps:**
```typescript
const batcher = new BatchProcessor(
  async (items) => await generateEmbeddings(items),
  { maxBatchSize: 100, maxWaitMs: 100 }
)

// These three calls are batched into one API call
const e1 = await batcher.add('text 1')
const e2 = await batcher.add('text 2')
const e3 = await batcher.add('text 3')
```

---

### Task 5.4: Input Sanitization ✅

**Status:** Completed

**Purpose:** Prevent injection attacks and validate all inputs.

**Referenced Documentation:**
- `docs/design/14-implementation-patterns.md` - Security best practices

**Implementation:**
1. Create sanitization utilities ✅
2. Apply to all user inputs ✅
3. Apply to tool parameters ✅
4. Apply to database queries ✅

**Tests:** ✅
- ✅ Malicious inputs are sanitized
- ✅ Valid inputs pass through
- ✅ SQL injection is prevented
- ✅ XSS is prevented

**Verify Steps:**
```typescript
const sanitized = sanitizeToolParameters(
  { prompt: '<script>alert("xss")</script>' },
  schema
)

expect(sanitized.prompt).not.toContain('<script>')
```

---

## Phase 6: Backend Server Package

### Task 6.1: Server Package Setup ✅

**Status:** Completed

**Purpose:** Create the @wukong/server package to provide a production-ready backend server for agent execution.

**Referenced Documentation:**
- `docs/design/02-architecture.md` - System architecture
- `examples/ui/README.md` - Backend integration example

**Implementation:**
1. Initialize `packages/server`: ✅
   - Add Express/Fastify for HTTP server ✅
   - Add WebSocket support (ws library) ✅
   - Add Server-Sent Events support ✅
   - TypeScript configuration ✅
   - Build tooling ✅

2. Package structure: ✅
   ```
   packages/server/
   ├── src/
   │   ├── index.ts              # Main exports
   │   ├── WukongServer.ts       # Core server class
   │   ├── SessionManager.ts     # Session lifecycle management
   │   ├── types.ts              # TypeScript types
   │   ├── routes/
   │   │   └── index.ts          # HTTP REST API endpoints
   │   ├── websocket/
   │   │   └── WebSocketManager.ts # WebSocket handlers
   │   ├── middleware/
   │   │   └── errorHandler.ts   # Error handling middleware
   │   ├── utils/
   │   │   └── logger.ts         # Logging utility
   │   └── __tests__/            # Test files
   ├── package.json
   ├── tsconfig.json
   ├── tsup.config.ts
   ├── vitest.config.ts
   └── README.md
   ```

**Tests:** ✅
- ✅ Package builds correctly
- ✅ Server starts and stops
- ✅ Basic HTTP endpoints work
- ✅ 46 unit tests (WukongServer, SessionManager, errorHandler, logger)
- ✅ All tests passing

**Verify Steps:**
```typescript
import { WukongServer } from '@wukong/server'

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
```

---

### Task 6.2: WebSocket Communication ✅

**Status:** Completed

**Purpose:** Implement real-time bidirectional communication for agent execution.

**Implementation:**
1. Create `packages/server/src/websocket/WebSocketManager.ts`: ✅
   - Connection management ✅
   - Message routing ✅
   - Event streaming ✅
   - Error handling ✅
   - Heartbeat/ping-pong ✅

2. Event streaming: ✅
   - `llm:streaming` → Send text chunks to client ✅
   - `tool:executing` → Send tool start events ✅
   - `tool:completed` → Send tool results ✅
   - `agent:progress` → Send progress updates ✅
   - `agent:complete` → Send final result ✅
   - `agent:error` → Send error information ✅

3. Client message handling: ✅
   - `execute` - Start agent execution ✅
   - `stop` - Stop running agent ✅
   - `pause` - Pause execution ✅
   - `resume` - Resume execution ✅
   - `feedback` - Submit user feedback ✅

**Tests:** ✅
- ✅ WebSocket connections work
- ✅ Messages are routed correctly
- ✅ Events stream in real-time
- ✅ Connection cleanup works
- ✅ Handles multiple concurrent clients
- ✅ 22 unit tests covering all functionality

**Verify Steps:**
```typescript
// Server side
server.on('connection', (ws, sessionId) => {
  console.log(`Client connected: ${sessionId}`)
})

// Client side (from UI)
const ws = new WebSocket('ws://localhost:3000')
ws.send(JSON.stringify({ 
  type: 'execute', 
  goal: 'Calculate 2 + 2' 
}))

ws.onmessage = (event) => {
  const message = JSON.parse(event.data)
  console.log(message.type, message.data)
}
```

---

### Task 6.3: Server-Sent Events (SSE) ✅

**Status:** Completed

**Purpose:** Implement SSE as an alternative to WebSocket for streaming responses.

**Implementation:**
1. Create `packages/server/src/routes/sse.ts`: ✅
   - SSE endpoint setup ✅
   - Event stream management ✅
   - Connection tracking ✅
   - Automatic reconnection support ✅

2. Event types: ✅
   - Same events as WebSocket ✅
   - Text-based streaming ✅
   - Works with standard HTTP ✅

3. Advantages over WebSocket: ✅
   - Simpler for one-way streaming ✅
   - Better proxy/firewall compatibility ✅
   - Automatic reconnection ✅
   - Standard HTTP ✅

**Tests:** ✅
- ✅ SSE connections work
- ✅ Events stream correctly
- ✅ Reconnection works (client disconnect handling)
- ✅ Multiple concurrent streams
- ✅ Keep-alive mechanism
- ✅ Broadcast functionality
- ✅ Agent event forwarding
- ✅ 48 unit tests covering all functionality

**Verify Steps:**
```typescript
// Server provides SSE endpoint automatically at /events/:sessionId
const server = new WukongServer({ 
  sse: { enabled: true, path: '/events' } 
})
await server.start()

// Client connects
const eventSource = new EventSource('/events/session123')
eventSource.addEventListener('agent:progress', (e) => {
  const data = JSON.parse(e.data)
  console.log('Progress:', data)
})

// Execute task with SSE streaming
fetch('/events/session123/execute', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ goal: 'Calculate 2 + 2' })
})
```

---

### Task 6.4: REST API Endpoints ✅

**Status:** Completed

**Purpose:** Provide REST API for non-streaming operations and management.

**Implementation:**
1. Create `packages/server/src/routes/`: ✅
   - `POST /api/sessions` - Create new session ✅
   - `GET /api/sessions/:id` - Get session details ✅
   - `GET /api/sessions` - List sessions ✅
   - `DELETE /api/sessions/:id` - Delete session ✅
   - `POST /api/sessions/:id/execute` - Start execution (async, returns immediately) ✅
   - `POST /api/sessions/:id/execute-stream` - Execute with streaming (chunked transfer) ✅
   - `POST /api/sessions/:id/stop` - Stop execution ✅
   - `GET /api/sessions/:id/history` - Get chat history ✅
   - `POST /api/feedback` - Submit feedback ✅
   - `GET /api/capabilities` - Get agent capabilities ✅
   - `GET /api/health` - Health check ✅

2. Response format: ✅
   ```typescript
   {
     success: boolean
     data?: any
     error?: {
       code: string
       message: string
       details?: any
     }
   }
   ```

3. Execution modes: ✅
   - **Async execution**: `POST /execute` starts execution and returns immediately ✅
     - Client uses SSE/WebSocket for streaming updates
     - Client polls `GET /sessions/:id` for status
   - **Streaming execution**: `POST /execute-stream` returns chunked response ✅
     - Uses Transfer-Encoding: chunked
     - Each line is a JSON event (newline-delimited JSON)
     - Compatible with standard HTTP clients

**Tests:** ✅
- ✅ All endpoints work correctly
- ✅ Error handling is robust
- ✅ Request validation works
- ✅ Response format is consistent
- ✅ Streaming execution sends events properly
- ✅ 75+ unit tests covering all functionality

**Verify Steps:**
```bash
# Create session
curl -X POST http://localhost:3000/api/sessions \
  -H "Content-Type: application/json" \
  -d '{"userId": "user123"}'

# Option 1: Async execution (use with SSE/WebSocket)
curl -X POST http://localhost:3000/api/sessions/session123/execute \
  -H "Content-Type: application/json" \
  -d '{"goal": "Calculate 2 + 2"}'
# → Returns immediately with status

# Option 2: Streaming execution (chunked response)
curl -X POST http://localhost:3000/api/sessions/session123/execute-stream \
  -H "Content-Type: application/json" \
  -d '{"goal": "Calculate 2 + 2"}'
# → Streams events as newline-delimited JSON

# Get history
curl http://localhost:3000/api/sessions/session123/history
```

**Integration with UI:** ✅

The backend server (Task 6.1-6.4) has been successfully integrated with `examples/ui`:

**Implementation Details:**
1. **Backend Server** (`examples/ui/server.ts`):
   - Uses `@wukong/server` as a library (not reimplementation)
   - Configured with `LocalAdapter` and multiple LLM providers
   - Includes calculator tool for demonstration
   - Runs on port 3001 by default

2. **API Client** (`examples/ui/src/api/client.ts`):
   - Full TypeScript client for REST API, WebSocket, and SSE
   - Provides methods: `createSession()`, `execute()`, `getCapabilities()`, etc.
   - Event-based architecture for real-time updates
   - Singleton pattern for easy usage

3. **Frontend Integration** (`examples/ui/src/App.tsx`):
   - Connects to backend on component mount
   - Establishes SSE connection for streaming events
   - Real-time message streaming and tool execution display
   - Error handling and status indicators

4. **Configuration**:
   - `package.json`: Added `@wukong/server` dependency and run scripts
   - `vite.config.ts`: Proxy configuration for API/WebSocket/SSE
   - `env.template`: Environment variables template
   - `SETUP.md`: Complete setup and troubleshooting guide

**Usage:**
```bash
# From examples/ui directory
cp env.template .env
# Edit .env and add LLM API key(s)

# Run both frontend and backend
pnpm dev:all

# Or run separately:
pnpm dev:server  # Backend on :3001
pnpm dev         # Frontend on :5173
```

**Features Demonstrated:**
- ✅ Session management
- ✅ Real-time streaming via SSE
- ✅ Tool execution visualization
- ✅ Multiple LLM provider support
- ✅ Error handling and reconnection
- ✅ Beautiful UI with theme support

See `examples/ui/README.md` and `examples/ui/SETUP.md` for complete documentation.

---

### Task 6.5: Session Management ✅

**Status:** Completed

**Purpose:** Manage agent sessions with proper lifecycle and cleanup.

**Implementation:**
1. Create `packages/server/src/SessionManager.ts`: ✅
   - Create and track sessions ✅
   - Associate sessions with users ✅
   - Session timeout and cleanup ✅
   - Session persistence with CacheAdapter ✅
   - Concurrent session limits ✅

2. Features: ✅
   - Session ID generation ✅
   - User → Sessions mapping ✅
   - Active session tracking ✅
   - Automatic cleanup of stale sessions ✅
   - Session restore on reconnection ✅
   - Session statistics (getStats method) ✅

3. Configuration: ✅
   ```typescript
   {
     sessionTimeout: 30 * 60 * 1000, // 30 minutes
     maxSessionsPerUser: 5,
     cleanupInterval: 5 * 60 * 1000, // 5 minutes
     persistSessions: true
   }
   ```

**Tests:** ✅
- ✅ Sessions are created correctly
- ✅ Timeout works
- ✅ Cleanup removes stale sessions
- ✅ Session restore works (returns 0 without cache adapter)
- ✅ Concurrent limits are enforced
- ✅ Session statistics tracking
- ✅ Async operations handled correctly
- ✅ All methods updated to support persistence

**Verify Steps:**
```typescript
const sessionManager = new SessionManager(agentConfig, sessionConfig, cacheAdapter)

// Create session
const session = await sessionManager.create('user123')

// Get active sessions
const sessions = await sessionManager.getActiveSessions('user123')

// Get statistics
const stats = sessionManager.getStats()

// Restore sessions on server start
const restoredCount = await sessionManager.restoreSessions()

// Cleanup automatically runs in background
```

**Integration:** ✅
- ✅ WukongServer passes cache adapter to SessionManager
- ✅ Server calls restoreSessions() on startup
- ✅ All routes updated for async updateStatus
- ✅ WebSocket manager updated for async operations
- ✅ SSE manager updated for async operations

---

### Task 6.6: Authentication & Authorization

**Purpose:** Add authentication and authorization for production use.

**Implementation:**
1. Create `packages/server/src/middleware/auth.ts`:
   - API key authentication
   - JWT token authentication
   - User identification
   - Rate limiting per user

2. Configuration:
   ```typescript
   {
     auth: {
       enabled: true,
       type: 'apikey' | 'jwt' | 'custom',
       apiKeys?: string[],
       jwtSecret?: string,
       customValidator?: (req) => Promise<User>
     }
   }
   ```

3. Middleware:
   - Validate authentication
   - Extract user info
   - Attach to request
   - Handle auth errors

**Tests:**
- Valid credentials work
- Invalid credentials fail
- User info is attached
- Rate limiting works

**Verify Steps:**
```typescript
const server = new WukongServer({
  auth: {
    enabled: true,
    type: 'apikey',
    apiKeys: ['secret-key-1', 'secret-key-2']
  }
})

// Client must send API key
fetch('/api/sessions', {
  headers: {
    'Authorization': 'Bearer secret-key-1'
  }
})
```

---

### Task 6.7: Rate Limiting & Throttling ✅

**Status:** Completed

**Purpose:** Prevent abuse and ensure fair resource usage.

**Implementation:**
1. Create `packages/server/src/middleware/rateLimit.ts`: ✅
   - Request rate limiting using sliding window algorithm ✅
   - Token usage limiting ✅
   - Concurrent execution limiting ✅
   - IP-based limits ✅
   - User-based limits ✅
   - Custom key generator support ✅
   - Skip function for bypassing rate limits ✅
   - Custom error handler support ✅

2. Configuration: ✅
   ```typescript
   {
     rateLimit: {
       windowMs: 60 * 1000, // 1 minute
       maxRequests: 60, // 60 requests per minute
       maxTokensPerMinute: 100000,
       maxConcurrentExecutions: 3
     }
   }
   ```

3. Storage: ✅
   - Use cache adapter for counters ✅
   - Sliding window algorithm ✅
   - Distributed rate limiting ✅
   - Graceful degradation when cache unavailable ✅

4. Integration: ✅
   - Integrated into WukongServer ✅
   - Applied to all routes ✅
   - Concurrent limiting on execution endpoints ✅
   - Exported for external use ✅

**Tests:** ✅
- ✅ Rate limits are enforced
- ✅ Limits reset correctly (sliding window)
- ✅ Distributed limiting works
- ✅ Error messages are clear
- ✅ IP-based limiting works
- ✅ User-based limiting works
- ✅ Concurrent execution limiting works
- ✅ Token usage limiting works
- ✅ Custom key generator works
- ✅ Skip function works
- ✅ Custom error handler works
- ✅ Graceful error handling
- ✅ Works without cache adapter
- ✅ 240+ unit tests covering all functionality

**Verify Steps:**
```typescript
const server = new WukongServer({
  rateLimit: {
    maxRequests: 10,
    windowMs: 60000,
    maxTokensPerMinute: 10000,
    maxConcurrentExecutions: 3
  }
})

await server.start()

// After 10 requests in 1 minute, returns 429 Too Many Requests
// After 3 concurrent executions, returns 429 Concurrent Limit Exceeded
```

---

### Task 6.8: Error Handling & Logging ✅

**Status:** Completed

**Purpose:** Comprehensive error handling and logging for production.

**Implementation:**
1. Create `packages/server/src/middleware/errorHandler.ts`: ✅
   - Catch all errors ✅
   - Format error responses with correlation IDs ✅
   - Log errors with full context ✅
   - Error categorization (server_error, client_error, rate_limit) ✅
   - asyncHandler wrapper for async route handlers ✅
   - ApiError class and error factory functions ✅

2. Create `packages/server/src/utils/logger.ts`: ✅
   - Structured logging (JSON and text formats) ✅
   - Log levels (debug, info, warn, error, silent) ✅
   - Request logging middleware with performance tracking ✅
   - Request ID generation for tracing ✅
   - Performance logger class for operation timing ✅
   - Sensitive data sanitization (headers, passwords, tokens) ✅
   - Integration-ready (can extend with Winston, Pino) ✅

3. Error types: ✅
   - Validation errors (400) ✅
   - Authentication errors (401) ✅
   - Authorization errors (403) ✅
   - Not found errors (404) ✅
   - Rate limit errors (429) ✅
   - Internal errors (500) ✅

4. Features: ✅
   - Correlation IDs for error tracing ✅
   - Request IDs for request tracing ✅
   - Request duration tracking ✅
   - Sensitive data redaction ✅
   - Error categorization for monitoring ✅
   - Performance measurement utilities ✅

**Tests:** ✅
- ✅ Errors are caught correctly
- ✅ Error format is correct
- ✅ Logs are generated with proper format
- ✅ Sensitive data is redacted
- ✅ Request logging tracks duration
- ✅ Correlation IDs are generated
- ✅ asyncHandler catches async errors
- ✅ Performance logger measures operations
- ✅ 70+ unit tests covering all functionality

**Verify Steps:**
```typescript
import { 
  WukongServer, 
  createLogger, 
  PerformanceLogger,
  requestLoggingMiddleware,
  asyncHandler
} from '@wukong/server'

const server = new WukongServer({
  logging: {
    level: 'info',
    format: 'json',
    destination: './logs/server.log'
  }
})

// Request logging with performance tracking (automatically applied)
await server.start()

// Use performance logger in your code
const perfLogger = new PerformanceLogger(logger, 'database-query', { table: 'users' })
try {
  const result = await db.query('SELECT * FROM users')
  perfLogger.end({ rowCount: result.length })
} catch (error) {
  perfLogger.error(error)
}

// Use asyncHandler in routes
app.get('/api/data', asyncHandler(async (req, res) => {
  const data = await fetchData()
  res.json({ success: true, data })
}))
```

**Integration:** ✅
- ✅ Integrated into WukongServer
- ✅ Applied to all routes
- ✅ Request IDs attached to all requests
- ✅ Correlation IDs included in error responses
- ✅ All sensitive data sanitized in logs
- ✅ All exports available from @wukong/server

---

### Task 6.9: CORS & Security Headers ✅

**Purpose:** Secure the server for production deployment.

**Implementation:** ✅
1. ✅ Enhanced CORS support:
   - Configurable origins (string, array, or boolean)
   - Credentials support
   - Configurable methods, allowed headers, exposed headers
   - Max age for preflight requests
   - Automatic preflight handling

2. ✅ Comprehensive security headers:
   - Helmet.js integration with custom configuration
   - Content Security Policy (configurable or disable)
   - HTTPS enforcement middleware
   - HSTS with configurable options (max age, subdomains, preload)
   - X-Frame-Options (DENY by default)
   - X-Content-Type-Options (nosniff)
   - X-DNS-Prefetch-Control
   - Referrer-Policy
   - Custom security headers support

3. ✅ Enhanced configuration interface:
   ```typescript
   {
     cors: {
       origin: ['https://app.example.com'],
       credentials: true,
       methods: ['GET', 'POST', 'PUT', 'DELETE'],
       allowedHeaders: ['Content-Type', 'Authorization'],
       maxAge: 86400
     },
     security: {
       enforceHttps: true,
       hsts: true,
       hstsMaxAge: 31536000,
       hstsIncludeSubDomains: true,
       hstsPreload: false,
       csp: {
         defaultSrc: ["'self'"],
         scriptSrc: ["'self'", "'unsafe-inline'"]
       },
       customHeaders: {
         'X-API-Version': '1.0'
       }
     }
   }
   ```

**Files Created:**
- ✅ `packages/server/src/middleware/security.ts` - Security middleware (createSecurityMiddleware, enforceHttps, customSecurityHeaders)
- ✅ `packages/server/src/__tests__/security.test.ts` - Security middleware unit tests

**Files Modified:**
- ✅ `packages/server/src/types.ts` - Enhanced CORS and security configuration types
- ✅ `packages/server/src/WukongServer.ts` - Integrated security middleware
- ✅ `packages/server/src/index.ts` - Exported security middleware functions
- ✅ `packages/server/src/__tests__/WukongServer.test.ts` - Added integration tests

**Tests:** ✅
- ✅ Unit tests for all security middleware functions
- ✅ CORS headers are set correctly
- ✅ Security headers (CSP, HSTS, X-Frame-Options, etc.) are applied
- ✅ HTTPS enforcement blocks HTTP requests when enabled
- ✅ HTTPS enforcement allows requests with X-Forwarded-Proto header
- ✅ Custom security headers are applied
- ✅ CSP can be disabled or customized
- ✅ HSTS can be configured with custom settings
- ✅ Integration tests with WukongServer
- ✅ Preflight CORS requests handled correctly

**Integration:** ✅
- ✅ Security middleware applied to all routes
- ✅ HTTPS enforcement configurable and functional
- ✅ CORS configuration fully customizable
- ✅ Logging for security configuration on startup
- ✅ All security features exported from @wukong/server

**Verify Steps:**
```typescript
const server = new WukongServer({
  cors: {
    origin: 'https://app.example.com',
    credentials: true,
    methods: ['GET', 'POST'],
    maxAge: 86400
  },
  security: {
    enforceHttps: true,
    hsts: true,
    hstsMaxAge: 31536000,
    csp: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"]
    },
    customHeaders: {
      'X-API-Version': '1.0'
    }
  }
})
```

---

### Task 6.11: Complete Server Example

**Purpose:** Provide a fully configured example server.

**Implementation:**
1. Create `examples/server/`:
   ```
   examples/server/
   ├── index.ts              # Main server file
   ├── config.ts             # Configuration
   ├── tools/                # Custom tools
   ├── .env.example          # Environment variables
   └── README.md             # Documentation
   ```

2. Features:
   - Complete setup with all options
   - Custom tools examples
   - Authentication configured
   - Rate limiting enabled
   - Logging configured
   - Ready for production

**Verify Steps:**
```bash
cd examples/server
cp .env.example .env
# Edit .env with your API keys
pnpm install
pnpm dev

# In another terminal
cd examples/ui
pnpm dev

# UI connects to server and works end-to-end
```

---

## Phase 7: UI Components Package

### Task 7.1: UI Package Setup ✅

**Status:** Completed

**Purpose:** Set up the @wukong/ui package with React and styling infrastructure.

**Referenced Documentation:**
- `docs/design/appendix-ui-components.md` - UI component design
- `docs/design/appendix-trustworthiness.md` - Trustworthiness checklist

**Implementation:**
1. Initialize `packages/ui` with React support: ✅
   - Add React, TypeScript, and necessary dependencies ✅
   - Set up build tooling for React components ✅
   - Configure CSS-in-JS or CSS modules ✅
   - Add Storybook for component development (Deferred to Task 7.14)

2. Create theme system: ✅
   - Define theme interface and default themes ✅
   - Implement ThemeProvider ✅
   - Add CSS variables support ✅
   - Create theme utilities ✅

**Tests:** ✅
- ✅ Package builds correctly
- ✅ Theme system works
- ✅ Components can access theme

**Verify Steps:**
```typescript
import { ThemeProvider } from '@wukong/ui'

<ThemeProvider theme="light">
  <App />
</ThemeProvider>
```

---

### Task 7.2: Core UI Components - Startup Phase ✅

**Status:** Completed

**Purpose:** Implement UI components for principles 1-5 (Startup Phase).

**Referenced Documentation:**
- `docs/design/appendix-ui-components.md` - Component specifications
- `docs/design/appendix-trustworthiness.md` - Principles 1-5

**Implementation:**
1. **CapabilitiesPanel** (Principle 1): ✅
   - Display what agent can/cannot do
   - Collapsible sections
   - Support for custom styling

2. **SkillsTree** (Principle 2): ✅
   - Tree or grid view of available skills
   - Filtering and search
   - Skill categories

3. **ExamplePrompts** (Principle 3): ✅
   - List of example commands
   - Click to use
   - Categorized by use case

4. **UpdateBanner** (Principle 4): ✅
   - Show new features/updates
   - Dismissible
   - Version comparison

5. **SourceIndicator** (Principle 5): ✅
   - Mark information sources
   - Link to original sources
   - Source type badges

**Tests:**
- All components render correctly ✅
- Interactive features work ✅
- Theme integration works ✅
- Accessibility standards met ✅

**Verify Steps:**
```tsx
import { CapabilitiesPanel, SkillsTree, ExamplePrompts } from '@wukong/ui'

<div>
  <CapabilitiesPanel agent={agent} />
  <SkillsTree skills={skills} />
  <ExamplePrompts examples={examples} onSelect={handleSelect} />
</div>
```

---

### Task 7.3: Core UI Components - Before Execution ✅

**Status:** Completed

**Purpose:** Implement UI components for principles 6-11 (Before Execution).

**Referenced Documentation:**
- `docs/design/appendix-ui-components.md` - Component specifications
- `docs/design/appendix-trustworthiness.md` - Principles 6-11

**Implementation:**
1. **PlanPreview** (Principle 6): ✅
   - Display generated plan
   - Support sidebar/modal layouts
   - Step dependencies visualization
   - Time/cost estimates

2. **ExecutionPlan** (Principles 7-8): ✅
   - Show detailed execution steps
   - Accept/Edit/Cancel buttons
   - Risk warnings with color coding
   - Time/cost estimates
   - Expandable step details

3. **TodoList** (Principles 9-10): ✅
   - Expandable checklist
   - Progress indicators
   - Group by status
   - Dependencies visualization
   - Subtasks support

4. **ThinkingBox** (Principle 11): ✅
   - Real-time streaming display
   - Markdown-like rendering
   - Auto-scroll with manual override
   - Collapsible
   - Timestamp display

**Tests:** ✅
- ✅ All components render correctly
- ✅ Real-time updates work
- ✅ User interactions work
- ✅ Streaming performance is good
- ✅ Theme integration works
- ✅ Accessibility standards met

**Verify Steps:**
```tsx
import { PlanPreview, ExecutionPlan, TodoList, ThinkingBox } from '@wukong/ui'

<div>
  <PlanPreview plan={plan} onAccept={accept} onEdit={edit} />
  <ExecutionPlan steps={steps} showRisks={true} onAccept={accept} />
  <TodoList todos={todos} groupBy="status" onUpdate={updateTodo} />
  <ThinkingBox thinking={thinking} streaming={true} />
</div>
```

**Integration:** ✅
- ✅ Components exported from @wukong/ui
- ✅ Integrated into examples/ui demo application
- ✅ Live demo with interactive examples
- ✅ All components themed and styled consistently

---

### Task 7.4: Core UI Components - During Execution

**Purpose:** Implement UI components for principles 12-17 (During Execution).

**Referenced Documentation:**
- `docs/design/appendix-ui-components.md` - Component specifications
- `docs/design/appendix-trustworthiness.md` - Principles 12-17

**Implementation:**
1. **StatusIndicator** (Principle 12):
   - Real-time status display
   - Status icons and colors
   - Animation for active states

2. **ProgressBar** (Principle 13):
   - Progress percentage
   - Step counter
   - Estimated time remaining
   - Smooth animations

3. **DecisionLog** (Principle 14):
   - Timeline of decisions
   - Expandable entries
   - Search and filter

4. **ThinkingProcess** (Principle 15):
   - Streaming reasoning display
   - Syntax highlighting
   - Collapsible sections

5. **CostIndicator** (Principle 16):
   - Token usage display
   - Cost estimation
   - Savings from optimizations

6. **WhyButton** (Principle 17):
   - Explain reasoning
   - Tooltip or modal
   - Context-aware

**Tests:**
- Real-time updates work smoothly
- Animations perform well
- Cost calculations are accurate
- All interactive features work

**Verify Steps:**
```tsx
import {
  StatusIndicator,
  ProgressBar,
  DecisionLog,
  CostIndicator
} from '@wukong/ui'

<div>
  <StatusIndicator status={status} />
  <ProgressBar progress={progress} estimatedTime={eta} />
  <DecisionLog decisions={decisions} />
  <CostIndicator tokens={tokens} cost={cost} />
</div>
```

---

### Task 7.5: Core UI Components - Error Handling

**Purpose:** Implement UI components for principles 18-24 (After Errors).

**Referenced Documentation:**
- `docs/design/appendix-ui-components.md` - Component specifications
- `docs/design/appendix-trustworthiness.md` - Principles 18-24

**Implementation:**
1. **UndoButton** (Principle 18):
   - Undo last action
   - Show what will be undone
   - Keyboard shortcuts

2. **VersionHistory** (Principle 19):
   - Timeline of changes
   - Diff preview
   - Restore to any version

3. **SandboxPreview** (Principle 20):
   - Preview changes before applying
   - Side-by-side comparison
   - Highlight differences

4. **DiffView** (Principle 21):
   - Line-by-line comparison
   - Syntax highlighting
   - Expand/collapse sections

5. **StopButton** (Principle 22):
   - Always visible
   - Confirmation options
   - Graceful shutdown

6. **ConfirmDialog** (Principle 23):
   - High-risk operation warnings
   - Risk explanation
   - Require explicit confirmation

7. **EscalateButton** (Principle 24):
   - Escalate to human
   - Show error context
   - Contact options

**Tests:**
- All buttons work correctly
- Confirmations prevent accidents
- Undo/redo works properly
- Diff rendering is accurate

**Verify Steps:**
```tsx
import {
  UndoButton,
  VersionHistory,
  DiffView,
  StopButton,
  ConfirmDialog
} from '@wukong/ui'

<div>
  <StopButton onStop={handleStop} />
  <UndoButton onUndo={handleUndo} />
  <VersionHistory versions={versions} onRestore={restore} />
  <DiffView before={before} after={after} />
  <ConfirmDialog
    open={showConfirm}
    risks={risks}
    onConfirm={confirm}
    onCancel={cancel}
  />
</div>
```

---

### Task 7.6: Core UI Components - Feedback & Metrics

**Purpose:** Implement UI components for principles 25-30 (New Loop).

**Referenced Documentation:**
- `docs/design/appendix-ui-components.md` - Component specifications
- `docs/design/appendix-trustworthiness.md` - Principles 25-30

**Implementation:**
1. **MemorySettings** (Principle 25):
   - Control what to remember
   - Privacy settings
   - Retention period

2. **RetryButton** (Principle 26):
   - One-click restart
   - Show what will be retried
   - Different retry options

3. **FeedbackButtons** (Principle 27):
   - Thumbs up/down
   - Stars rating
   - Emoji reactions

4. **FeedbackForm** (Principle 28):
   - Detailed feedback
   - Category selection
   - Free-form text
   - Screenshot attachment

5. **MetricsDashboard** (Principle 29):
   - Task completion rate
   - Average steps
   - Token usage
   - Response times
   - Charts and graphs

6. **TrustScore** (Principle 30):
   - Overall trust score
   - Score breakdown
   - Historical trends
   - Factors affecting score

**Tests:**
- All feedback mechanisms work
- Metrics are calculated correctly
- Dashboard renders properly
- Data persistence works

**Verify Steps:**
```tsx
import {
  FeedbackButtons,
  FeedbackForm,
  MetricsDashboard,
  TrustScore
} from '@wukong/ui'

<div>
  <FeedbackButtons onFeedback={handleFeedback} />
  <FeedbackForm onSubmit={submitFeedback} />
  <MetricsDashboard metrics={metrics} />
  <TrustScore score={score} breakdown={breakdown} />
</div>
```

---

### Task 7.7: Complete Chat Interface

**Purpose:** Implement the all-in-one AgentChat component.

**Referenced Documentation:**
- `docs/design/appendix-ui-components.md` - AgentChat component

**Implementation:**
1. **AgentChat** component:
   - Compose all individual components
   - Responsive layout
   - Mobile/tablet/desktop views
   - Built-in state management
   - Event handling

2. Layout options:
   - Stack layout (mobile)
   - Sidebar layout (tablet)
   - Split layout (desktop)

3. Features:
   - All 30 trustworthiness principles
   - Theme support
   - Internationalization
   - Accessibility

**Tests:**
- Complete flow from start to finish
- All features accessible
- Responsive on all screen sizes
- Performance is good

**Verify Steps:**
```tsx
import { AgentChat } from '@wukong/ui'

<AgentChat
  config={agentConfig}
  theme="light"
  showCapabilities={true}
  showProgress={true}
  enableFeedback={true}
  onPlanReady={handlePlanReady}
  onProgress={handleProgress}
  onComplete={handleComplete}
/>
```

---

### Task 7.8: React Hooks

**Purpose:** Implement custom React hooks for agent integration.

**Referenced Documentation:**
- `docs/design/appendix-ui-components.md` - Hooks section

**Implementation:**
1. **useAgent**:
   - Agent state management
   - Execute, stop, pause, resume
   - Real-time status updates

2. **useProgress**:
   - Track execution progress
   - Current step and total steps
   - Estimated time remaining

3. **useTodos**:
   - Todo list state
   - Add, update, complete todos
   - Dependencies tracking

4. **useThinking**:
   - Streaming thinking process
   - Buffer management
   - Auto-scroll control

5. **useFeedback**:
   - Collect user feedback
   - Submit to backend
   - Local caching

6. **useMetrics**:
   - Track usage metrics
   - Calculate statistics
   - Historical data

7. **useHistory**:
   - Session history
   - Version management
   - Undo/redo stack

**Tests:**
- All hooks work correctly
- State updates properly
- Memory leaks are prevented
- Performance is good

**Verify Steps:**
```tsx
import { useAgent, useProgress, useTodos } from '@wukong/ui'

function MyComponent() {
  const { agent, execute, stop, isRunning } = useAgent(config)
  const { progress, currentStep, totalSteps } = useProgress(agent)
  const { todos, updateTodo } = useTodos(agent)
  
  return (
    <div>
      <button onClick={() => execute({ goal: '...' })}>Start</button>
      <button onClick={stop}>Stop</button>
      <div>Progress: {progress}%</div>
      <div>Step {currentStep} of {totalSteps}</div>
    </div>
  )
}
```

---

### Task 7.9: Providers and Context

**Purpose:** Implement React context providers for global state.

**Referenced Documentation:**
- `docs/design/appendix-ui-components.md` - Providers section

**Implementation:**
1. **ThemeProvider**:
   - Theme context
   - Theme switching
   - CSS variables injection

2. **MetricsProvider**:
   - Metrics collection
   - Data persistence
   - Analytics integration

3. **HistoryProvider**:
   - Session history
   - Auto-cleanup
   - Storage management

4. **I18nProvider**:
   - Internationalization
   - Language switching
   - Custom translations

**Tests:**
- Providers work correctly
- Context is accessible
- Data persists properly
- No memory leaks

**Verify Steps:**
```tsx
import {
  ThemeProvider,
  MetricsProvider,
  HistoryProvider,
  I18nProvider
} from '@wukong/ui'

<ThemeProvider theme="light">
  <I18nProvider locale="zh-CN">
    <MetricsProvider storageKey="metrics">
      <HistoryProvider maxSessions={10}>
        <App />
      </HistoryProvider>
    </MetricsProvider>
  </I18nProvider>
</ThemeProvider>
```

---

### Task 7.10: Styling and Theming

**Purpose:** Implement comprehensive theming system.

**Referenced Documentation:**
- `docs/design/appendix-ui-components.md` - Theme customization

**Implementation:**
1. Theme structure:
   - Colors (primary, secondary, success, warning, error)
   - Spacing (xs, sm, md, lg, xl)
   - Typography (font family, sizes, weights)
   - Border radius
   - Shadows
   - Component-specific overrides

2. Preset themes:
   - Light theme
   - Dark theme
   - Auto (system preference)

3. CSS variables:
   - Generate from theme
   - Runtime updates
   - Fallback values

**Tests:**
- Themes apply correctly
- Custom themes work
- CSS variables update
- No style conflicts

**Verify Steps:**
```tsx
<ThemeProvider theme={{
  colors: {
    primary: '#0070f3',
    background: '#ffffff'
  },
  spacing: { md: 16 },
  borderRadius: { md: 8 }
}}>
  <AgentChat config={config} />
</ThemeProvider>
```

---

### Task 7.11: Accessibility

**Purpose:** Ensure all components meet WCAG 2.1 AA standards.

**Referenced Documentation:**
- `docs/design/appendix-ui-components.md` - Accessibility section

**Implementation:**
1. Keyboard navigation:
   - Tab order
   - Focus management
   - Keyboard shortcuts

2. Screen reader support:
   - ARIA labels
   - ARIA descriptions
   - Live regions for updates

3. Visual accessibility:
   - Sufficient color contrast
   - Focus indicators
   - High contrast mode

4. Accessibility options:
   - Enable/disable features
   - Announce progress
   - Custom aria labels

**Tests:**
- Keyboard navigation works
- Screen reader announces correctly
- Color contrast meets standards
- Focus management is correct

**Verify Steps:**
```tsx
<AgentChat
  accessibility={{
    enableKeyboardNavigation: true,
    announceProgress: true,
    highContrast: false
  }}
/>
```

---

### Task 7.12: Internationalization

**Purpose:** Support multiple languages.

**Referenced Documentation:**
- `docs/design/appendix-ui-components.md` - I18n section

**Implementation:**
1. Translation system:
   - Default translations (en-US, zh-CN)
   - Translation loading
   - Fallback language

2. Supported languages:
   - English (en-US)
   - Simplified Chinese (zh-CN)
   - Japanese (ja-JP)
   - Korean (ko-KR)

3. Custom translations:
   - Override defaults
   - Add new languages
   - Pluralization support

**Tests:**
- All languages load correctly
- Translations display properly
- Fallbacks work
- Custom translations work

**Verify Steps:**
```tsx
<I18nProvider locale="zh-CN">
  <AgentChat config={config} />
</I18nProvider>
```

---

### Task 7.13: Responsive Design

**Purpose:** Ensure all components work on all screen sizes.

**Referenced Documentation:**
- `docs/design/appendix-ui-components.md` - Responsive design

**Implementation:**
1. Breakpoints:
   - Mobile: < 640px
   - Tablet: 640px - 1024px
   - Desktop: > 1024px

2. Layout modes:
   - Stack (mobile): vertical layout
   - Sidebar (tablet): side panel
   - Split (desktop): two columns

3. Responsive components:
   - Adapt to screen size
   - Touch-friendly on mobile
   - Hover effects on desktop

**Tests:**
- All layouts work correctly
- Components adapt to screen size
- Touch interactions work
- No horizontal scroll

**Verify Steps:**
```tsx
<AgentChat
  layout={{
    mobile: 'stack',
    tablet: 'sidebar',
    desktop: 'split'
  }}
  breakpoints={{
    mobile: 640,
    tablet: 1024,
    desktop: 1280
  }}
/>
```

---

### Task 7.14: Component Documentation with Storybook

**Purpose:** Document all components with interactive examples.

**Implementation:**
1. Set up Storybook:
   - Install and configure
   - Add stories for all components
   - Configure addons (a11y, docs)

2. Write stories:
   - Basic usage
   - All props/variants
   - Interactive examples
   - Accessibility checks

3. Documentation:
   - Component descriptions
   - Props table
   - Usage examples
   - Best practices

**Tests:**
- All stories render correctly
- Props are documented
- Examples work
- Accessibility passes

**Verify Steps:**
```bash
cd packages/ui
pnpm storybook
# Visit http://localhost:6006
```

---

## Phase 8: Documentation & Examples

### Task 8.1: API Documentation

**Purpose:** Generate comprehensive API documentation for all public interfaces.

**Implementation:**
1. Add JSDoc comments to all public APIs
2. Generate documentation with TypeDoc
3. Create API reference website

**Verify Steps:**
- All public methods have JSDoc comments
- Documentation generates without errors
- Examples are included
- Type signatures are correct

---

### Task 8.2: Usage Examples

**Purpose:** Provide working examples for common use cases.

**Referenced Documentation:**
- `docs/design/11-examples.md` - Usage examples

**Implementation:**
1. Create example applications in `examples/`:
   - `examples/basic` - Simple agent usage (already exists, enhance it)
   - `examples/interactive` - InteractiveAgent with UI
   - `examples/auto` - AutoAgent with knowledge base
   - `examples/ui-components` - UI components showcase
   - `examples/custom-adapter` - Custom storage adapter
   - `examples/custom-tools` - Custom tool creation
   - `examples/server` - Complete server setup (created in Phase 7)
   - `examples/ui` - UI connecting to server (already exists, enhance with real connection)

**Verify Steps:**
```bash
cd examples/interactive
pnpm install
pnpm dev
# Should run successfully with UI
```

---

### Task 8.3: Migration Guide

**Purpose:** Help users migrate from other agent frameworks.

**Implementation:**
1. Create migration guides:
   - From LangChain
   - From raw OpenAI API
   - From other agent frameworks

---

### Task 8.4: Tutorial Series

**Purpose:** Guide users through building real applications.

**Implementation:**
1. Create tutorials:
   - Building a document Q&A agent
   - Building a data analysis agent
   - Building a multi-agent system
   - Building custom tools
   - Deploying to production
   - Integrating UI components

---

## Testing Strategy

### Unit Tests

For each component:
- Test all public methods
- Test error cases
- Test edge cases
- Mock external dependencies
- Aim for >80% coverage

### Integration Tests

Test component interactions:
- Agent + Storage + LLM
- Agent + Tools + Knowledge Base
- Complete execution flows
- Error recovery scenarios

### End-to-End Tests

Test complete user scenarios:
- Create session → Execute task → Get result
- Interactive mode with user confirmations
- Auto mode with knowledge base search
- Agent fork with sub-tasks
- Stop and resume

### Performance Tests

- Token counting accuracy
- Cache hit rate
- Database query performance
- Vector search latency
- Concurrent request handling

---

## Deployment Checklist

### Before Production

- [ ] All tests pass
- [ ] Documentation is complete
- [ ] Examples work
- [ ] Security audit completed
- [ ] Performance benchmarks met
- [ ] Error handling is robust
- [ ] Monitoring is configured
- [ ] Rate limiting is enabled

### Production Deployment

1. Deploy to staging environment
2. Run smoke tests
3. Monitor for errors
4. Deploy to production
5. Monitor metrics:
   - Request rate
   - Error rate
   - Token usage
   - Response times
   - Cache hit rate

---

## Success Metrics

### Functionality
- All core features work as designed
- Test coverage >80%
- No critical bugs

### Performance
- Average response time < 2s
- Token optimization >90% vs traditional
- Cache hit rate >60%

### Developer Experience
- Easy to install (< 5 min)
- Easy to configure (< 10 lines)
- Good documentation
- Working examples

---


---

## Priority Levels

### P0 (Must Have - Minimum Viable Product)
- Phase 1: All tasks ✅
- Phase 2: All tasks ✅
- Phase 3: Tasks 3.1-3.3, 3.9 ✅
- Core agent functionality without advanced features

### P1 (Should Have - Full Feature Set)
- Phase 3: Tasks 3.4-3.8, 3.10 ✅
- Phase 4: All tasks ✅
- Phase 6: Tasks 6.1-6.5 (Basic server functionality)
- Phase 7: Tasks 7.1-7.7 (Core UI components)
- Complete feature set with server and UI components

### P2 (Nice to Have - Polish & Enhancement)
- Phase 5: All tasks (Optimization)
- Phase 6: Tasks 6.6-6.11 (Advanced server features)
- Phase 7: Tasks 7.8-7.14 (Advanced UI features)
- Phase 8: All tasks (Documentation & Examples)
- Optimization, advanced server/UI features, and documentation

---

## Next Steps

1. **Review this plan** with the team
2. **Set up development environment** (Task 1.1)
3. **Start with Phase 1** foundation tasks
4. **Implement incrementally** and test thoroughly
5. **Iterate based on feedback**

---

## Questions to Resolve

Before starting implementation, clarify:

1. **Target Node.js version?** (Recommend: Node 18+)
2. **Browser support needed?** (Or Node.js only?)
3. **License?** (MIT recommended for library)
4. **Package registry?** (npm public or private?)
5. **Monorepo tool?** (pnpm workspaces recommended)
6. **CI/CD platform?** (GitHub Actions, GitLab CI, etc.)
7. **Hosting for docs?** (Vercel, Netlify, GitHub Pages?)

---

## Related Documentation

- [Core Design Principles](../design/01-core-concepts.md)
- [Architecture](../design/02-architecture.md)
- [Interfaces](../design/03-interfaces.md)
- [Knowledge Base](../design/04-knowledge-base.md)
- [Tools System](../design/05-tools-system.md)
- [Advanced Features](../design/06-advanced-features.md)
- [Todo List](../design/07-todo-list.md)
- [Token Optimization](../design/08-token-optimization.md)
- [Trustworthiness](../design/09-trustworthiness.md)
- [Implementation Details](../design/10-implementation.md)
- [Prompt Engineering](../design/12-prompt-engineering.md)
- [Database Design](../design/13-database-design.md)
- [Implementation Patterns](../design/14-implementation-patterns.md)
- [Trustworthiness Checklist](../design/appendix-trustworthiness.md)
- [UI Components](../design/appendix-ui-components.md)
- [Recommended Libraries](./recommended-libraries.md)

---

**Ready to start building!** 🚀

