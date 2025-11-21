# Phase 6: Backend Server Package ✅

> **Status:** Completed
> 
> This phase implemented the `@wukong/server` package, providing a production-ready backend with REST API, WebSocket, SSE, authentication, rate limiting, and comprehensive security features.

---

## Task 6.1: Server Package Setup ✅

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

## Task 6.2: WebSocket Communication ✅

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

## Task 6.3: Server-Sent Events (SSE) ✅

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

## Task 6.4: REST API Endpoints ✅

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

## Task 6.5: Session Management ✅

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

## Task 6.6: Authentication & Authorization ✅

**Status:** Completed

**Purpose:** Add authentication and authorization for production use.

**Implementation:**
1. Create `packages/server/src/middleware/auth.ts`: ✅
   - API key authentication ✅
   - JWT token authentication ✅
   - User identification ✅
   - Rate limiting per user ✅

2. Configuration: ✅
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

3. Middleware: ✅
   - Validate authentication ✅
   - Extract user info ✅
   - Attach to request ✅
   - Handle auth errors ✅

**Tests:** ✅
- ✅ Valid credentials work
- ✅ Invalid credentials fail
- ✅ User info is attached
- ✅ Rate limiting works (via integration)
- ✅ JWT support added
- ✅ 10 unit tests covering all auth scenarios

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

## Task 6.7: Rate Limiting & Throttling ✅

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

## Task 6.8: Error Handling & Logging ✅

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

## Task 6.9: CORS & Security Headers ✅

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

## Task 6.10: Complete Server Example ✅

**Status:** Completed

**Purpose:** Provide a fully configured example server.

**Implementation:**
1. Create `examples/server/`: ✅
   ```
   examples/server/
   ├── index.ts              # Main server file
   ├── config.ts             # Configuration
   ├── tools/                # Custom tools
   ├── .env.example          # Environment variables
   └── README.md             # Documentation
   ```

2. Features: ✅
   - Complete setup with all options ✅
   - Custom tools examples (calculator, weather) ✅
   - Authentication configured ✅
   - Rate limiting enabled ✅
   - Logging configured ✅
   - Ready for production ✅

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

## Summary

Phase 6 successfully implemented the complete backend server infrastructure:
- ✅ Core server package with Express/Fastify
- ✅ Real-time communication (WebSocket & SSE)
- ✅ REST API endpoints for session management
- ✅ Authentication & Authorization
- ✅ Rate limiting & Throttling
- ✅ Error handling & Logging
- ✅ Security enhancements (CORS, Helmet, HSTS)
- ✅ Complete server examples

**Next:** Phase 7 - UI Components Package

