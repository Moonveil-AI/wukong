     1|# Wukong Engine Implementation Plan
     2|
     3|> A step-by-step plan to build the Wukong Agent Library from scratch
     4|
     5|**Created:** November 12, 2025  
     6|**Status:** Ready for Implementation
     7|
     8|---
     9|
    10|## Table of Contents
    11|
    12|- [Phase 1: Foundation & Setup](#phase-1-foundation--setup) ✅
    13|- [Phase 2: Core Agent System](#phase-2-core-agent-system) ✅
    14|- [Phase 3: Tools & Knowledge Base](#phase-3-tools--knowledge-base) ✅
    15|- [Phase 4: Advanced Features](#phase-4-advanced-features) ✅
    16|- [Phase 5: Optimization & Polish](#phase-5-optimization--polish)
    17|- [Phase 6: Backend Server Package](#phase-6-backend-server-package) ✅
    18|- [Phase 7: UI Components Package](#phase-7-ui-components-package)
    19|- [Phase 8: Documentation & Examples](#phase-8-documentation--examples)
    20|
    21|---
    22|
    23|## Phase 1: Foundation & Setup ✅
    24|
    25|**Status:** Completed
    26|
    27|Established the foundational infrastructure including:
    28|- ✅ Complete monorepo structure with 9 packages
    29|- ✅ TypeScript configuration with strict type checking
    30|- ✅ Build tooling (tsup) and testing framework (Vitest)
    31|- ✅ Linting and formatting (Biome)
    32|- ✅ Core type definitions and interfaces
    33|- ✅ Complete database schema with migrations
    34|- ✅ Support for both Vercel Postgres and local SQLite
    35|
    36|**See:** [phase-1-foundation.md](./phase-1-foundation.md) for detailed implementation steps.
    37|
    38|---
    39|
    40|## Phase 2: Core Agent System ✅
    41|
    42|**Status:** Completed
    43|
    44|Implemented the core agent execution system including:
    45|- ✅ Event system with typed events and error handling
    46|- ✅ Storage adapters for both Vercel (Postgres/KV/Blob) and Local (SQLite/FS)
    47|- ✅ LLM integrations for OpenAI, Anthropic Claude, and Google Gemini
    48|- ✅ Multi-model fallback system with automatic retries
    49|- ✅ Prompt builder with Tool Executor mode support
    50|- ✅ Response parser with Zod validation
    51|- ✅ Session management with checkpoints
    52|- ✅ Step executor for all action types
    53|- ✅ Stop controller for safe execution control
    54|- ✅ InteractiveAgent and AutoAgent implementations
    55|- ✅ Main WukongAgent class with complete API
    56|
    57|**See:** [phase-2-core-agent.md](./phase-2-core-agent.md) for detailed implementation steps
    58|
    59|---
    60|
    61|## Phase 3: Tools & Knowledge Base ✅
    62|
    63|**Status:** Completed
    64|
    65|Implemented the complete tools system and knowledge base infrastructure including:
    66|- ✅ Tool registry with auto-discovery and MCP format
    67|- ✅ Tool executor with parameter validation and error handling
    68|- ✅ Async tool executor for long-running operations
    69|- ✅ Parallel tool executor with multiple wait strategies
    70|- ✅ Document processor supporting PDF, DOCX, MD, HTML, TXT
    71|- ✅ Document chunker with overlap and metadata preservation
    72|- ✅ Embedding generator using OpenAI API
    73|- ✅ Vector storage adapter with pgvector and similarity search
    74|- ✅ Knowledge base manager for indexing and searching
    75|- ✅ Knowledge extractor for automated learning from sessions
    76|
    77|**See:** [phase-3-tools-knowledge-base.md](./phase-3-tools-knowledge-base.md) for detailed implementation steps
    78|
    79|---
    80|
    81|## Phase 4: Advanced Features ✅
    82|
    83|**Status:** Completed
    84|
    85|Implemented advanced capabilities for agent enhancement including:
    86|- ✅ Todo manager with progress tracking and dependencies
    87|- ✅ Agent fork for spawning sub-agents with context compression
    88|- ✅ Step management (discard & compress) for token optimization
    89|- ✅ Tool Executor mode reducing tool definition tokens by 95%
    90|- ✅ Skills system with lazy loading for 96% token reduction
    91|
    92|**See:** [phase-4-advanced-features.md](./phase-4-advanced-features.md) for detailed implementation steps
    93|
    94|---
    95|
    96|## Phase 5: Optimization & Polish
    97|
    98|### Task 5.1: Token Counting and Monitoring ✅
    99|
   100|**Status:** Completed
   101|
   102|**Purpose:** Track token usage and cost for optimization.
   103|
   104|**Referenced Documentation:**
   105|- `docs/design/08-token-optimization.md` - Token usage monitoring
   106|
   107|**Implementation:**
   108|1. Create `packages/agent/src/monitoring/TokenMonitor.ts`:
   109|   - Count tokens for prompts
   110|   - Count tokens for responses
   111|   - Calculate costs
   112|   - Track savings from optimizations
   113|   - Emit `tokens:used` events
   114|
   115|**Tests:** ✅
   116|- ✅ Token counting is accurate
   117|- ✅ Cost calculation is correct
   118|- ✅ Savings are tracked
   119|- ✅ Events are emitted
   120|
   121|**Verify Steps:**
   122|```typescript
   123|const monitor = new TokenMonitor()
   124|
   125|agent.on('tokens:used', (usage) => {
   126|  console.log('Tokens:', usage.totalTokens)
   127|  console.log('Cost:', usage.estimatedCost)
   128|  console.log('Savings:', usage.savings)
   129|})
   130|
   131|await agent.execute({ goal: 'test' })
   132|```
   133|
   134|---
   135|
   136|### Task 5.2: Concurrency Control
   137|
   138|**Purpose:** Prevent race conditions and ensure data consistency.
   139|
   140|**Referenced Documentation:**
   141|- `docs/design/14-implementation-patterns.md` - Concurrency control
   142|
   143|**Implementation:**
   144|1. Create distributed locks using cache adapter
   145|2. Implement database row locking where needed
   146|3. Add lock utilities
   147|
   148|**Tests:**
   149|- Locks prevent concurrent modifications
   150|- Locks are released on errors
   151|- Lock timeouts work
   152|- Deadlocks are prevented
   153|
   154|**Verify Steps:**
   155|```typescript
   156|const lock = new DistributedLock(cacheAdapter)
   157|
   158|await lock.withLock(`session:${sessionId}`, async () => {
   159|  // Critical section - only one process at a time
   160|  const session = await getSession(sessionId)
   161|  session.status = 'running'
   162|  await saveSession(session)
   163|})
   164|```
   165|
   166|---
   167|
   168|### Task 5.3: Batch Processing
   169|
   170|**Purpose:** Batch multiple operations for better performance.
   171|
   172|**Referenced Documentation:**
   173|- `docs/design/14-implementation-patterns.md` - Batch operations
   174|
   175|**Implementation:**
   176|1. Create `packages/agent/src/utils/BatchProcessor.ts`:
   177|   - Queue operations
   178|   - Flush on batch size or timeout
   179|   - Handle errors
   180|
   181|2. Apply to embedding generation
   182|
   183|**Tests:**
   184|- Multiple calls are batched
   185|- Flush on size works
   186|- Flush on timeout works
   187|- Errors don't affect other items
   188|
   189|**Verify Steps:**
   190|```typescript
   191|const batcher = new BatchProcessor(
   192|  async (items) => await generateEmbeddings(items),
   193|  { maxBatchSize: 100, maxWaitMs: 100 }
   194|)
   195|
   196|// These three calls are batched into one API call
   197|const e1 = await batcher.add('text 1')
   198|const e2 = await batcher.add('text 2')
   199|const e3 = await batcher.add('text 3')
   200|```
   201|
   202|---
   203|
   204|### Task 5.4: Input Sanitization ✅
   205|
   206|**Status:** Completed
   207|
   208|**Purpose:** Prevent injection attacks and validate all inputs.
   209|
   210|**Referenced Documentation:**
   211|- `docs/design/14-implementation-patterns.md` - Security best practices
   212|
   213|**Implementation:**
   214|1. Create sanitization utilities ✅
   215|2. Apply to all user inputs ✅
   216|3. Apply to tool parameters ✅
   217|4. Apply to database queries ✅
   218|
   219|**Tests:** ✅
   220|- ✅ Malicious inputs are sanitized
   221|- ✅ Valid inputs pass through
   222|- ✅ SQL injection is prevented
   223|- ✅ XSS is prevented
   224|
   225|**Verify Steps:**
   226|```typescript
   227|const sanitized = sanitizeToolParameters(
   228|  { prompt: '<script>alert("xss")</script>' },
   229|  schema
   230|)
   231|
   232|expect(sanitized.prompt).not.toContain('<script>')
   233|```
   234|
   235|---
   236|
   237|## Phase 6: Backend Server Package ✅
   238|
   239|### Task 6.1: Server Package Setup ✅
   240|
   241|**Status:** Completed
   242|
   243|**Purpose:** Create the @wukong/server package to provide a production-ready backend server for agent execution.
   244|
   245|**Referenced Documentation:**
   246|- `docs/design/02-architecture.md` - System architecture
   247|- `examples/ui/README.md` - Backend integration example
   248|
   249|**Implementation:**
   250|1. Initialize `packages/server`: ✅
   251|   - Add Express/Fastify for HTTP server ✅
   252|   - Add WebSocket support (ws library) ✅
   253|   - Add Server-Sent Events support ✅
   254|   - TypeScript configuration ✅
   255|   - Build tooling ✅
   256|
   257|2. Package structure: ✅
   258|   ```
   259|   packages/server/
   260|   ├── src/
   261|   │   ├── index.ts              # Main exports
   262|   │   ├── WukongServer.ts       # Core server class
   263|   │   ├── SessionManager.ts     # Session lifecycle management
   264|   │   ├── types.ts              # TypeScript types
   265|   │   ├── routes/
   266|   │   │   └── index.ts          # HTTP REST API endpoints
   267|   │   ├── websocket/
   268|   │   │   └── WebSocketManager.ts # WebSocket handlers
   269|   │   ├── middleware/
   270|   │   │   └── errorHandler.ts   # Error handling middleware
   271|   │   ├── utils/
   272|   │   │   └── logger.ts         # Logging utility
   273|   │   └── __tests__/            # Test files
   274|   ├── package.json
   275|   ├── tsconfig.json
   276|   ├── tsup.config.ts
   277|   ├── vitest.config.ts
   278|   └── README.md
   279|   ```
   280|
   281|**Tests:** ✅
   282|- ✅ Package builds correctly
   283|- ✅ Server starts and stops
   284|- ✅ Basic HTTP endpoints work
   285|- ✅ 46 unit tests (WukongServer, SessionManager, errorHandler, logger)
   286|- ✅ All tests passing
   287|
   288|**Verify Steps:**
   289|```typescript
   290|import { WukongServer } from '@wukong/server'
   291|
   292|const server = new WukongServer({
   293|  port: 3000,
   294|  agent: {
   295|    factory: () => new WukongAgent({
   296|      adapter: new LocalAdapter({ dbPath: './data/wukong.db' }),
   297|      llm: { models: [new ClaudeAdapter()] }
   298|    })
   299|  }
   300|})
   301|
   302|await server.start()
   303|```
   304|
   305|---
   306|
   307|### Task 6.2: WebSocket Communication ✅
   308|
   309|**Status:** Completed
   310|
   311|**Purpose:** Implement real-time bidirectional communication for agent execution.
   312|
   313|**Implementation:**
   314|1. Create `packages/server/src/websocket/WebSocketManager.ts`: ✅
   315|   - Connection management ✅
   316|   - Message routing ✅
   317|   - Event streaming ✅
   318|   - Error handling ✅
   319|   - Heartbeat/ping-pong ✅
   320|
   321|2. Event streaming: ✅
   322|   - `llm:streaming` → Send text chunks to client ✅
   323|   - `tool:executing` → Send tool start events ✅
   324|   - `tool:completed` → Send tool results ✅
   325|   - `agent:progress` → Send progress updates ✅
   326|   - `agent:complete` → Send final result ✅
   327|   - `agent:error` → Send error information ✅
   328|
   329|3. Client message handling: ✅
   330|   - `execute` - Start agent execution ✅
   331|   - `stop` - Stop running agent ✅
   332|   - `pause` - Pause execution ✅
   333|   - `resume` - Resume execution ✅
   334|   - `feedback` - Submit user feedback ✅
   335|
   336|**Tests:** ✅
   337|- ✅ WebSocket connections work
   338|- ✅ Messages are routed correctly
   339|- ✅ Events stream in real-time
   340|- ✅ Connection cleanup works
   341|- ✅ Handles multiple concurrent clients
   342|- ✅ 22 unit tests covering all functionality
   343|
   344|**Verify Steps:**
   345|```typescript
   346|// Server side
   347|server.on('connection', (ws, sessionId) => {
   348|  console.log(`Client connected: ${sessionId}`)
   349|})
   350|
   351|// Client side (from UI)
   352|const ws = new WebSocket('ws://localhost:3000')
   353|ws.send(JSON.stringify({ 
   354|  type: 'execute', 
   355|  goal: 'Calculate 2 + 2' 
   356|}))
   357|
   358|ws.onmessage = (event) => {
   359|  const message = JSON.parse(event.data)
   360|  console.log(message.type, message.data)
   361|}
   362|```
   363|
   364|---
   365|
   366|### Task 6.3: Server-Sent Events (SSE) ✅
   367|
   368|**Status:** Completed
   369|
   370|**Purpose:** Implement SSE as an alternative to WebSocket for streaming responses.
   371|
   372|**Implementation:**
   373|1. Create `packages/server/src/routes/sse.ts`: ✅
   374|   - SSE endpoint setup ✅
   375|   - Event stream management ✅
   376|   - Connection tracking ✅
   377|   - Automatic reconnection support ✅
   378|
   379|2. Event types: ✅
   380|   - Same events as WebSocket ✅
   381|   - Text-based streaming ✅
   382|   - Works with standard HTTP ✅
   383|
   384|3. Advantages over WebSocket: ✅
   385|   - Simpler for one-way streaming ✅
   386|   - Better proxy/firewall compatibility ✅
   387|   - Automatic reconnection ✅
   388|   - Standard HTTP ✅
   389|
   390|**Tests:** ✅
   391|- ✅ SSE connections work
   392|- ✅ Events stream correctly
   393|- ✅ Reconnection works (client disconnect handling)
   394|- ✅ Multiple concurrent streams
   395|- ✅ Keep-alive mechanism
   396|- ✅ Broadcast functionality
   397|- ✅ Agent event forwarding
   398|- ✅ 48 unit tests covering all functionality
   399|
   400|**Verify Steps:**
   401|```typescript
   402|// Server provides SSE endpoint automatically at /events/:sessionId
   403|const server = new WukongServer({ 
   404|  sse: { enabled: true, path: '/events' } 
   405|})
   406|await server.start()
   407|
   408|// Client connects
   409|const eventSource = new EventSource('/events/session123')
   410|eventSource.addEventListener('agent:progress', (e) => {
   411|  const data = JSON.parse(e.data)
   412|  console.log('Progress:', data)
   413|})
   414|
   415|// Execute task with SSE streaming
   416|fetch('/events/session123/execute', {
   417|  method: 'POST',
   418|  headers: { 'Content-Type': 'application/json' },
   419|  body: JSON.stringify({ goal: 'Calculate 2 + 2' })
   420|})
   421|```
   422|
   423|---
   424|
   425|### Task 6.4: REST API Endpoints ✅
   426|
   427|**Status:** Completed
   428|
   429|**Purpose:** Provide REST API for non-streaming operations and management.
   430|
   431|**Implementation:**
   432|1. Create `packages/server/src/routes/`: ✅
   433|   - `POST /api/sessions` - Create new session ✅
   434|   - `GET /api/sessions/:id` - Get session details ✅
   435|   - `GET /api/sessions` - List sessions ✅
   436|   - `DELETE /api/sessions/:id` - Delete session ✅
   437|   - `POST /api/sessions/:id/execute` - Start execution (async, returns immediately) ✅
   438|   - `POST /api/sessions/:id/execute-stream` - Execute with streaming (chunked transfer) ✅
   439|   - `POST /api/sessions/:id/stop` - Stop execution ✅
   440|   - `GET /api/sessions/:id/history` - Get chat history ✅
   441|   - `POST /api/feedback` - Submit feedback ✅
   442|   - `GET /api/capabilities` - Get agent capabilities ✅
   443|   - `GET /api/health` - Health check ✅
   444|
   445|2. Response format: ✅
   446|   ```typescript
   447|   {
   448|     success: boolean
   449|     data?: any
   450|     error?: {
   451|       code: string
   452|       message: string
   453|       details?: any
   454|     }
   455|   }
   456|   ```
   457|
   458|3. Execution modes: ✅
   459|   - **Async execution**: `POST /execute` starts execution and returns immediately ✅
   460|     - Client uses SSE/WebSocket for streaming updates
   461|     - Client polls `GET /sessions/:id` for status
   462|   - **Streaming execution**: `POST /execute-stream` returns chunked response ✅
   463|     - Uses Transfer-Encoding: chunked
   464|     - Each line is a JSON event (newline-delimited JSON)
   465|     - Compatible with standard HTTP clients
   466|
   467|**Tests:** ✅
   468|- ✅ All endpoints work correctly
   469|- ✅ Error handling is robust
   470|- ✅ Request validation works
   471|- ✅ Response format is consistent
   472|- ✅ Streaming execution sends events properly
   473|- ✅ 75+ unit tests covering all functionality
   474|
   475|**Verify Steps:**
   476|```bash
   477|# Create session
   478|curl -X POST http://localhost:3000/api/sessions \
   479|  -H "Content-Type: application/json" \
   480|  -d '{"userId": "user123"}'
   481|
   482|# Option 1: Async execution (use with SSE/WebSocket)
   483|curl -X POST http://localhost:3000/api/sessions/session123/execute \
   484|  -H "Content-Type: application/json" \
   485|  -d '{"goal": "Calculate 2 + 2"}'
   486|# → Returns immediately with status
   487|
   488|# Option 2: Streaming execution (chunked response)
   489|curl -X POST http://localhost:3000/api/sessions/session123/execute-stream \
   490|  -H "Content-Type: application/json" \
   491|  -d '{"goal": "Calculate 2 + 2"}'
   492|# → Streams events as newline-delimited JSON
   493|
   494|# Get history
   495|curl http://localhost:3000/api/sessions/session123/history
   496|```
   497|
   498|**Integration with UI:** ✅
   499|
   500|The backend server (Task 6.1-6.4) has been successfully integrated with `examples/ui`:
   501|
   502|**Implementation Details:**
   503|1. **Backend Server** (`examples/ui/server.ts`):
   504|   - Uses `@wukong/server` as a library (not reimplementation)
   505|   - Configured with `LocalAdapter` and multiple LLM providers
   506|   - Includes calculator tool for demonstration
   507|   - Runs on port 3001 by default
   508|
   509|2. **API Client** (`examples/ui/src/api/client.ts`):
   510|   - Full TypeScript client for REST API, WebSocket, and SSE
   511|   - Provides methods: `createSession()`, `execute()`, `getCapabilities()`, etc.
   512|   - Event-based architecture for real-time updates
   513|   - Singleton pattern for easy usage
   514|
   515|3. **Frontend Integration** (`examples/ui/src/App.tsx`):
   516|   - Connects to backend on component mount
   517|   - Establishes SSE connection for streaming events
   518|   - Real-time message streaming and tool execution display
   519|   - Error handling and status indicators
   520|
   521|4. **Configuration**:
   522|   - `package.json`: Added `@wukong/server` dependency and run scripts
   523|   - `vite.config.ts`: Proxy configuration for API/WebSocket/SSE
   524|   - `env.template`: Environment variables template
   525|   - `SETUP.md`: Complete setup and troubleshooting guide
   526|
   527|**Usage:**
   528|```bash
   529|# From examples/ui directory
   530|cp env.template .env
   531|# Edit .env and add LLM API key(s)
   532|
   533|# Run both frontend and backend
   534|pnpm dev:all
   535|
   536|# Or run separately:
   537|pnpm dev:server  # Backend on :3001
   538|pnpm dev         # Frontend on :5173
   539|```
   540|
   541|**Features Demonstrated:**
   542|- ✅ Session management
   543|- ✅ Real-time streaming via SSE
   544|- ✅ Tool execution visualization
   545|- ✅ Multiple LLM provider support
   546|- ✅ Error handling and reconnection
   547|- ✅ Beautiful UI with theme support
   548|
   549|See `examples/ui/README.md` and `examples/ui/SETUP.md` for complete documentation.
   550|
   551|---
   552|
   553|### Task 6.5: Session Management ✅
   554|
   555|**Status:** Completed
   556|
   557|**Purpose:** Manage agent sessions with proper lifecycle and cleanup.
   558|
   559|**Implementation:**
   560|1. Create `packages/server/src/SessionManager.ts`: ✅
   561|   - Create and track sessions ✅
   562|   - Associate sessions with users ✅
   563|   - Session timeout and cleanup ✅
   564|   - Session persistence with CacheAdapter ✅
   565|   - Concurrent session limits ✅
   566|
   567|2. Features: ✅
   568|   - Session ID generation ✅
   569|   - User → Sessions mapping ✅
   570|   - Active session tracking ✅
   571|   - Automatic cleanup of stale sessions ✅
   572|   - Session restore on reconnection ✅
   573|   - Session statistics (getStats method) ✅
   574|
   575|3. Configuration: ✅
   576|   ```typescript
   577|   {
   578|     sessionTimeout: 30 * 60 * 1000, // 30 minutes
   579|     maxSessionsPerUser: 5,
   580|     cleanupInterval: 5 * 60 * 1000, // 5 minutes
   581|     persistSessions: true
   582|   }
   583|   ```
   584|
   585|**Tests:** ✅
   586|- ✅ Sessions are created correctly
   587|- ✅ Timeout works
   588|- ✅ Cleanup removes stale sessions
   589|- ✅ Session restore works (returns 0 without cache adapter)
   590|- ✅ Concurrent limits are enforced
   591|- ✅ Session statistics tracking
   592|- ✅ Async operations handled correctly
   593|- ✅ All methods updated to support persistence
   594|
   595|**Verify Steps:**
   596|```typescript
   597|const sessionManager = new SessionManager(agentConfig, sessionConfig, cacheAdapter)
   598|
   599|// Create session
   600|const session = await sessionManager.create('user123')
   601|
   602|// Get active sessions
   603|const sessions = await sessionManager.getActiveSessions('user123')
   604|
   605|// Get statistics
   606|const stats = sessionManager.getStats()
   607|
   608|// Restore sessions on server start
   609|const restoredCount = await sessionManager.restoreSessions()
   610|
   611|// Cleanup automatically runs in background
   612|```
   613|
   614|**Integration:** ✅
   615|- ✅ WukongServer passes cache adapter to SessionManager
   616|- ✅ Server calls restoreSessions() on startup
   617|- ✅ All routes updated for async updateStatus
   618|- ✅ WebSocket manager updated for async operations
   619|- ✅ SSE manager updated for async operations
   620|
   621|---
   622|
   623|### Task 6.6: Authentication & Authorization ✅
   624|
   625|**Status:** Completed
   626|
   627|**Purpose:** Add authentication and authorization for production use.
   628|
   629|**Implementation:**
   630|1. Create `packages/server/src/middleware/auth.ts`: ✅
   631|   - API key authentication ✅
   632|   - JWT token authentication ✅
   633|   - User identification ✅
   634|   - Rate limiting per user ✅
   635|
   636|2. Configuration: ✅
   637|   ```typescript
   638|   {
   639|     auth: {
   640|       enabled: true,
   641|       type: 'apikey' | 'jwt' | 'custom',
   642|       apiKeys?: string[],
   643|       jwtSecret?: string,
   644|       customValidator?: (req) => Promise<User>
   645|     }
   646|   }
   647|   ```
   648|
   649|3. Middleware: ✅
   650|   - Validate authentication ✅
   651|   - Extract user info ✅
   652|   - Attach to request ✅
   653|   - Handle auth errors ✅
   654|
   655|**Tests:** ✅
   656|- ✅ Valid credentials work
   657|- ✅ Invalid credentials fail
   658|- ✅ User info is attached
   659|- ✅ Rate limiting works (via integration)
   660|- ✅ JWT support added
   661|- ✅ 10 unit tests covering all auth scenarios
   662|
   663|**Verify Steps:**
   664|```typescript
   665|const server = new WukongServer({
   666|  auth: {
   667|    enabled: true,
   668|    type: 'apikey',
   669|    apiKeys: ['secret-key-1', 'secret-key-2']
   670|  }
   671|})
   672|
   673|// Client must send API key
   674|fetch('/api/sessions', {
   675|  headers: {
   676|    'Authorization': 'Bearer secret-key-1'
   677|  }
   678|})
   679|```
   680|
   681|---
   682|
   683|### Task 6.7: Rate Limiting & Throttling ✅
   684|
   685|**Status:** Completed
   686|
   687|**Purpose:** Prevent abuse and ensure fair resource usage.
   688|
   689|**Implementation:**
   690|1. Create `packages/server/src/middleware/rateLimit.ts`: ✅
   691|   - Request rate limiting using sliding window algorithm ✅
   692|   - Token usage limiting ✅
   693|   - Concurrent execution limiting ✅
   694|   - IP-based limits ✅
   695|   - User-based limits ✅
   696|   - Custom key generator support ✅
   697|   - Skip function for bypassing rate limits ✅
   698|   - Custom error handler support ✅
   699|
   700|2. Configuration: ✅
   701|   ```typescript
   702|   {
   703|     rateLimit: {
   704|       windowMs: 60 * 1000, // 1 minute
   705|       maxRequests: 60, // 60 requests per minute
   706|       maxTokensPerMinute: 100000,
   707|       maxConcurrentExecutions: 3
   708|     }
   709|   }
   710|   ```
   711|
   712|3. Storage: ✅
   713|   - Use cache adapter for counters ✅
   714|   - Sliding window algorithm ✅
   715|   - Distributed rate limiting ✅
   716|   - Graceful degradation when cache unavailable ✅
   717|
   718|4. Integration: ✅
   719|   - Integrated into WukongServer ✅
   720|   - Applied to all routes ✅
   721|   - Concurrent limiting on execution endpoints ✅
   722|   - Exported for external use ✅
   723|
   724|**Tests:** ✅
   725|- ✅ Rate limits are enforced
   726|- ✅ Limits reset correctly (sliding window)
   727|- ✅ Distributed limiting works
   728|- ✅ Error messages are clear
   729|- ✅ IP-based limiting works
   730|- ✅ User-based limiting works
   731|- ✅ Concurrent execution limiting works
   732|- ✅ Token usage limiting works
   733|- ✅ Custom key generator works
   734|- ✅ Skip function works
   735|- ✅ Custom error handler works
   736|- ✅ Graceful error handling
   737|- ✅ Works without cache adapter
   738|- ✅ 240+ unit tests covering all functionality
   739|
   740|**Verify Steps:**
   741|```typescript
   742|const server = new WukongServer({
   743|  rateLimit: {
   744|    maxRequests: 10,
   745|    windowMs: 60000,
   746|    maxTokensPerMinute: 10000,
   747|    maxConcurrentExecutions: 3
   748|  }
   749|})
   750|
   751|await server.start()
   752|
   753|// After 10 requests in 1 minute, returns 429 Too Many Requests
   754|// After 3 concurrent executions, returns 429 Concurrent Limit Exceeded
   755|```
   756|
   757|---
   758|
   759|### Task 6.8: Error Handling & Logging ✅
   760|
   761|**Status:** Completed
   762|
   763|**Purpose:** Comprehensive error handling and logging for production.
   764|
   765|**Implementation:**
   766|1. Create `packages/server/src/middleware/errorHandler.ts`: ✅
   767|   - Catch all errors ✅
   768|   - Format error responses with correlation IDs ✅
   769|   - Log errors with full context ✅
   770|   - Error categorization (server_error, client_error, rate_limit) ✅
   771|   - asyncHandler wrapper for async route handlers ✅
   772|   - ApiError class and error factory functions ✅
   773|
   774|2. Create `packages/server/src/utils/logger.ts`: ✅
   775|   - Structured logging (JSON and text formats) ✅
   776|   - Log levels (debug, info, warn, error, silent) ✅
   777|   - Request logging middleware with performance tracking ✅
   778|   - Request ID generation for tracing ✅
   779|   - Performance logger class for operation timing ✅
   780|   - Sensitive data sanitization (headers, passwords, tokens) ✅
   781|   - Integration-ready (can extend with Winston, Pino) ✅
   782|
   783|3. Error types: ✅
   784|   - Validation errors (400) ✅
   785|   - Authentication errors (401) ✅
   786|   - Authorization errors (403) ✅
   787|   - Not found errors (404) ✅
   788|   - Rate limit errors (429) ✅
   789|   - Internal errors (500) ✅
   790|
   791|4. Features: ✅
   792|   - Correlation IDs for error tracing ✅
   793|   - Request IDs for request tracing ✅
   794|   - Request duration tracking ✅
   795|   - Sensitive data redaction ✅
   796|   - Error categorization for monitoring ✅
   797|   - Performance measurement utilities ✅
   798|
   799|**Tests:** ✅
   800|- ✅ Errors are caught correctly
   801|- ✅ Error format is correct
   802|- ✅ Logs are generated with proper format
   803|- ✅ Sensitive data is redacted
   804|- ✅ Request logging tracks duration
   805|- ✅ Correlation IDs are generated
   806|- ✅ asyncHandler catches async errors
   807|- ✅ Performance logger measures operations
   808|- ✅ 70+ unit tests covering all functionality
   809|
   810|**Verify Steps:**
   811|```typescript
   812|import { 
   813|  WukongServer, 
   814|  createLogger, 
   815|  PerformanceLogger,
   816|  requestLoggingMiddleware,
   817|  asyncHandler
   818|} from '@wukong/server'
   819|
   820|const server = new WukongServer({
   821|  logging: {
   822|    level: 'info',
   823|    format: 'json',
   824|    destination: './logs/server.log'
   825|  }
   826|})
   827|
   828|// Request logging with performance tracking (automatically applied)
   829|await server.start()
   830|
   831|// Use performance logger in your code
   832|const perfLogger = new PerformanceLogger(logger, 'database-query', { table: 'users' })
   833|try {
   834|  const result = await db.query('SELECT * FROM users')
   835|  perfLogger.end({ rowCount: result.length })
   836|} catch (error) {
   837|  perfLogger.error(error)
   838|}
   839|
   840|// Use asyncHandler in routes
   841|app.get('/api/data', asyncHandler(async (req, res) => {
   842|  const data = await fetchData()
   843|  res.json({ success: true, data })
   844|}))
   845|```
   846|
   847|**Integration:** ✅
   848|- ✅ Integrated into WukongServer
   849|- ✅ Applied to all routes
   850|- ✅ Request IDs attached to all requests
   851|- ✅ Correlation IDs included in error responses
   852|- ✅ All sensitive data sanitized in logs
   853|- ✅ All exports available from @wukong/server
   854|
   855|---
   856|
   857|### Task 6.9: CORS & Security Headers ✅
   858|
   859|**Purpose:** Secure the server for production deployment.
   860|
   861|**Implementation:** ✅
   862|1. ✅ Enhanced CORS support:
   863|   - Configurable origins (string, array, or boolean)
   864|   - Credentials support
   865|   - Configurable methods, allowed headers, exposed headers
   866|   - Max age for preflight requests
   867|   - Automatic preflight handling
   868|
   869|2. ✅ Comprehensive security headers:
   870|   - Helmet.js integration with custom configuration
   871|   - Content Security Policy (configurable or disable)
   872|   - HTTPS enforcement middleware
   873|   - HSTS with configurable options (max age, subdomains, preload)
   874|   - X-Frame-Options (DENY by default)
   875|   - X-Content-Type-Options (nosniff)
   876|   - X-DNS-Prefetch-Control
   877|   - Referrer-Policy
   878|   - Custom security headers support
   879|
   880|3. ✅ Enhanced configuration interface:
   881|   ```typescript
   882|   {
   883|     cors: {
   884|       origin: ['https://app.example.com'],
   885|       credentials: true,
   886|       methods: ['GET', 'POST', 'PUT', 'DELETE'],
   887|       allowedHeaders: ['Content-Type', 'Authorization'],
   888|       maxAge: 86400
   889|     },
   890|     security: {
   891|       enforceHttps: true,
   892|       hsts: true,
   893|       hstsMaxAge: 31536000,
   894|       hstsIncludeSubDomains: true,
   895|       hstsPreload: false,
   896|       csp: {
   897|         defaultSrc: ["'self'"],
   898|         scriptSrc: ["'self'", "'unsafe-inline'"]
   899|       },
   900|       customHeaders: {
   901|         'X-API-Version': '1.0'
   902|       }
   903|     }
   904|   }
   905|   ```
   906|
   907|**Files Created:**
   908|- ✅ `packages/server/src/middleware/security.ts` - Security middleware (createSecurityMiddleware, enforceHttps, customSecurityHeaders)
   909|- ✅ `packages/server/src/__tests__/security.test.ts` - Security middleware unit tests
   910|
   911|**Files Modified:**
   912|- ✅ `packages/server/src/types.ts` - Enhanced CORS and security configuration types
   913|- ✅ `packages/server/src/WukongServer.ts` - Integrated security middleware
   914|- ✅ `packages/server/src/index.ts` - Exported security middleware functions
   915|- ✅ `packages/server/src/__tests__/WukongServer.test.ts` - Added integration tests
   916|
   917|**Tests:** ✅
   918|- ✅ Unit tests for all security middleware functions
   919|- ✅ CORS headers are set correctly
   920|- ✅ Security headers (CSP, HSTS, X-Frame-Options, etc.) are applied
   921|- ✅ HTTPS enforcement blocks HTTP requests when enabled
   922|- ✅ HTTPS enforcement allows requests with X-Forwarded-Proto header
   923|- ✅ Custom security headers are applied
   924|- ✅ CSP can be disabled or customized
   925|- ✅ HSTS can be configured with custom settings
   926|- ✅ Integration tests with WukongServer
   927|- ✅ Preflight CORS requests handled correctly
   928|
   929|**Integration:** ✅
   930|- ✅ Security middleware applied to all routes
   931|- ✅ HTTPS enforcement configurable and functional
   932|- ✅ CORS configuration fully customizable
   933|- ✅ Logging for security configuration on startup
   934|- ✅ All security features exported from @wukong/server
   935|
   936|**Verify Steps:**
   937|```typescript
   938|const server = new WukongServer({
   939|  cors: {
   940|    origin: 'https://app.example.com',
   941|    credentials: true,
   942|    methods: ['GET', 'POST'],
   943|    maxAge: 86400
   944|  },
   945|  security: {
   946|    enforceHttps: true,
   947|    hsts: true,
   948|    hstsMaxAge: 31536000,
   949|    csp: {
   950|      defaultSrc: ["'self'"],
   951|      styleSrc: ["'self'", "'unsafe-inline'"]
   952|    },
   953|    customHeaders: {
   954|      'X-API-Version': '1.0'
   955|    }
   956|  }
   957|})
   958|```
   959|
   960|---
   961|
   962|### Task 6.10: Complete Server Example ✅
   963|
   964|**Status:** Completed
   965|
   966|**Purpose:** Provide a fully configured example server.
   967|
   968|**Implementation:**
   969|1. Create `examples/server/`: ✅
   970|   ```
   971|   examples/server/
   972|   ├── index.ts              # Main server file
   973|   ├── config.ts             # Configuration
   974|   ├── tools/                # Custom tools
   975|   ├── .env.example          # Environment variables
   976|   └── README.md             # Documentation
   977|   ```
   978|
   979|2. Features: ✅
   980|   - Complete setup with all options ✅
   981|   - Custom tools examples (calculator, weather) ✅
   982|   - Authentication configured ✅
   983|   - Rate limiting enabled ✅
   984|   - Logging configured ✅
   985|   - Ready for production ✅
   986|
   987|**Verify Steps:**
   988|```bash
   989|cd examples/server
   990|cp .env.example .env
   991|# Edit .env with your API keys
   992|pnpm install
   993|pnpm dev
   994|
   995|# In another terminal
   996|cd examples/ui
   997|pnpm dev
   998|
   999|# UI connects to server and works end-to-end
  1000|```
  1001|
  1002|---
  1003|
  1004|## Phase 7: UI Components Package
  1005|
  1006|### Task 7.1: UI Package Setup ✅
  1007|
  1008|**Status:** Completed
  1009|
  1010|**Purpose:** Set up the @wukong/ui package with React and styling infrastructure.
  1011|
  1012|**Referenced Documentation:**
  1013|- `docs/design/appendix-ui-components.md` - UI component design
  1014|- `docs/design/appendix-trustworthiness.md` - Trustworthiness checklist
  1015|
  1016|**Implementation:**
  1017|1. Initialize `packages/ui` with React support: ✅
  1018|   - Add React, TypeScript, and necessary dependencies ✅
  1019|   - Set up build tooling for React components ✅
  1020|   - Configure CSS-in-JS or CSS modules ✅
  1021|   - Add Storybook for component development (Deferred to Task 7.14)
  1022|
  1023|2. Create theme system: ✅
  1024|   - Define theme interface and default themes ✅
  1025|   - Implement ThemeProvider ✅
  1026|   - Add CSS variables support ✅
  1027|   - Create theme utilities ✅
  1028|
  1029|**Tests:** ✅
  1030|- ✅ Package builds correctly
  1031|- ✅ Theme system works
  1032|- ✅ Components can access theme
  1033|
  1034|**Verify Steps:**
  1035|```typescript
  1036|import { ThemeProvider } from '@wukong/ui'
  1037|
  1038|<ThemeProvider theme="light">
  1039|  <App />
  1040|</ThemeProvider>
  1041|```
  1042|
  1043|---
  1044|
  1045|### Task 7.2: Core UI Components - Startup Phase ✅
  1046|
  1047|**Status:** Completed
  1048|
  1049|**Purpose:** Implement UI components for principles 1-5 (Startup Phase).
  1050|
  1051|**Referenced Documentation:**
  1052|- `docs/design/appendix-ui-components.md` - Component specifications
  1053|- `docs/design/appendix-trustworthiness.md` - Principles 1-5
  1054|
  1055|**Implementation:**
  1056|1. **CapabilitiesPanel** (Principle 1): ✅
  1057|   - Display what agent can/cannot do
  1058|   - Collapsible sections
  1059|   - Support for custom styling
  1060|
  1061|2. **SkillsTree** (Principle 2): ✅
  1062|   - Tree or grid view of available skills
  1063|   - Filtering and search
  1064|   - Skill categories
  1065|
  1066|3. **ExamplePrompts** (Principle 3): ✅
  1067|   - List of example commands
  1068|   - Click to use
  1069|   - Categorized by use case
  1070|
  1071|4. **UpdateBanner** (Principle 4): ✅
  1072|   - Show new features/updates
  1073|   - Dismissible
  1074|   - Version comparison
  1075|
  1076|5. **SourceIndicator** (Principle 5): ✅
  1077|   - Mark information sources
  1078|   - Link to original sources
  1079|   - Source type badges
  1080|
  1081|**Tests:**
  1082|- All components render correctly ✅
  1083|- Interactive features work ✅
  1084|- Theme integration works ✅
  1085|- Accessibility standards met ✅
  1086|
  1087|**Verify Steps:**
  1088|```tsx
  1089|import { CapabilitiesPanel, SkillsTree, ExamplePrompts } from '@wukong/ui'
  1090|
  1091|<div>
  1092|  <CapabilitiesPanel agent={agent} />
  1093|  <SkillsTree skills={skills} />
  1094|  <ExamplePrompts examples={examples} onSelect={handleSelect} />
  1095|</div>
  1096|```
  1097|
  1098|---
  1099|
  1100|### Task 7.3: Core UI Components - Before Execution ✅
  1101|
  1102|**Status:** Completed
  1103|
  1104|**Purpose:** Implement UI components for principles 6-11 (Before Execution).
  1105|
  1106|**Referenced Documentation:**
  1107|- `docs/design/appendix-ui-components.md` - Component specifications
  1108|- `docs/design/appendix-trustworthiness.md` - Principles 6-11
  1109|
  1110|**Implementation:**
  1111|1. **PlanPreview** (Principle 6): ✅
  1112|   - Display generated plan
  1113|   - Support sidebar/modal layouts
  1114|   - Step dependencies visualization
  1115|   - Time/cost estimates
  1116|
  1117|2. **ExecutionPlan** (Principles 7-8): ✅
  1118|   - Show detailed execution steps
  1119|   - Accept/Edit/Cancel buttons
  1120|   - Risk warnings with color coding
  1121|   - Time/cost estimates
  1122|   - Expandable step details
  1123|
  1124|3. **TodoList** (Principles 9-10): ✅
  1125|   - Expandable checklist
  1126|   - Progress indicators
  1127|   - Group by status
  1128|   - Dependencies visualization
  1129|   - Subtasks support
  1130|
  1131|4. **ThinkingBox** (Principle 11): ✅
  1132|   - Real-time streaming display
  1133|   - Markdown-like rendering
  1134|   - Auto-scroll with manual override
  1135|   - Collapsible
  1136|   - Timestamp display
  1137|
  1138|**Tests:** ✅
  1139|- ✅ All components render correctly
  1140|- ✅ Real-time updates work
  1141|- ✅ User interactions work
  1142|- ✅ Streaming performance is good
  1143|- ✅ Theme integration works
  1144|- ✅ Accessibility standards met
  1145|
  1146|**Verify Steps:**
  1147|```tsx
  1148|import { PlanPreview, ExecutionPlan, TodoList, ThinkingBox } from '@wukong/ui'
  1149|
  1150|<div>
  1151|  <PlanPreview plan={plan} onAccept={accept} onEdit={edit} />
  1152|  <ExecutionPlan steps={steps} showRisks={true} onAccept={accept} />
  1153|  <TodoList todos={todos} groupBy="status" onUpdate={updateTodo} />
  1154|  <ThinkingBox thinking={thinking} streaming={true} />
  1155|</div>
  1156|```
  1157|
  1158|**Integration:** ✅
  1159|- ✅ Components exported from @wukong/ui
  1160|- ✅ Integrated into examples/ui demo application
  1161|- ✅ Live demo with interactive examples
  1162|- ✅ All components themed and styled consistently
  1163|
  1164|---
  1165|
  1166|### Task 7.4: Core UI Components - During Execution
  1167|
  1168|**Purpose:** Implement UI components for principles 12-17 (During Execution).
  1169|
  1170|**Referenced Documentation:**
  1171|- `docs/design/appendix-ui-components.md` - Component specifications
  1172|- `docs/design/appendix-trustworthiness.md` - Principles 12-17
  1173|
  1174|**Implementation:**
  1175|1. **StatusIndicator** (Principle 12):
  1176|   - Real-time status display
  1177|   - Status icons and colors
  1178|   - Animation for active states
  1179|
  1180|2. **ProgressBar** (Principle 13):
  1181|   - Progress percentage
  1182|   - Step counter
  1183|   - Estimated time remaining
  1184|   - Smooth animations
  1185|
  1186|3. **DecisionLog** (Principle 14):
  1187|   - Timeline of decisions
  1188|   - Expandable entries
  1189|   - Search and filter
  1190|
  1191|4. **ThinkingProcess** (Principle 15):
  1192|   - Streaming reasoning display
  1193|   - Syntax highlighting
  1194|   - Collapsible sections
  1195|
  1196|5. **CostIndicator** (Principle 16):
  1197|   - Token usage display
  1198|   - Cost estimation
  1199|   - Savings from optimizations
  1200|
  1201|6. **WhyButton** (Principle 17):
  1202|   - Explain reasoning
  1203|   - Tooltip or modal
  1204|   - Context-aware
  1205|
  1206|**Tests:**
  1207|- Real-time updates work smoothly
  1208|- Animations perform well
  1209|- Cost calculations are accurate
  1210|- All interactive features work
  1211|
  1212|**Verify Steps:**
  1213|```tsx
  1214|import {
  1215|  StatusIndicator,
  1216|  ProgressBar,
  1217|  DecisionLog,
  1218|  CostIndicator
  1219|} from '@wukong/ui'
  1220|
  1221|<div>
  1222|  <StatusIndicator status={status} />
  1223|  <ProgressBar progress={progress} estimatedTime={eta} />
  1224|  <DecisionLog decisions={decisions} />
  1225|  <CostIndicator tokens={tokens} cost={cost} />
  1226|</div>
  1227|```
  1228|
  1229|---
  1230|
  1231|### Task 7.5: Core UI Components - Error Handling
  1232|
  1233|**Purpose:** Implement UI components for principles 18-24 (After Errors).
  1234|
  1235|**Referenced Documentation:**
  1236|- `docs/design/appendix-ui-components.md` - Component specifications
  1237|- `docs/design/appendix-trustworthiness.md` - Principles 18-24
  1238|
  1239|**Implementation:**
  1240|1. **UndoButton** (Principle 18):
  1241|   - Undo last action
  1242|   - Show what will be undone
  1243|   - Keyboard shortcuts
  1244|
  1245|2. **VersionHistory** (Principle 19):
  1246|   - Timeline of changes
  1247|   - Diff preview
  1248|   - Restore to any version
  1249|
  1250|3. **SandboxPreview** (Principle 20):
  1251|   - Preview changes before applying
  1252|   - Side-by-side comparison
  1253|   - Highlight differences
  1254|
  1255|4. **DiffView** (Principle 21):
  1256|   - Line-by-line comparison
  1257|   - Syntax highlighting
  1258|   - Expand/collapse sections
  1259|
  1260|5. **StopButton** (Principle 22):
  1261|   - Always visible
  1262|   - Confirmation options
  1263|   - Graceful shutdown
  1264|
  1265|6. **ConfirmDialog** (Principle 23):
  1266|   - High-risk operation warnings
  1267|   - Risk explanation
  1268|   - Require explicit confirmation
  1269|
  1270|7. **EscalateButton** (Principle 24):
  1271|   - Escalate to human
  1272|   - Show error context
  1273|   - Contact options
  1274|
  1275|**Tests:**
  1276|- All buttons work correctly
  1277|- Confirmations prevent accidents
  1278|- Undo/redo works properly
  1279|- Diff rendering is accurate
  1280|
  1281|**Verify Steps:**
  1282|```tsx
  1283|import {
  1284|  UndoButton,
  1285|  VersionHistory,
  1286|  DiffView,
  1287|  StopButton,
  1286|  ConfirmDialog
  1287|} from '@wukong/ui'
  1288|
  1289|<div>
  1290|  <StopButton onStop={handleStop} />
  1291|  <UndoButton onUndo={handleUndo} />
  1292|  <VersionHistory versions={versions} onRestore={restore} />
  1293|  <DiffView before={before} after={after} />
  1294|  <ConfirmDialog
  1295|    open={showConfirm}
  1296|    risks={risks}
  1297|    onConfirm={confirm}
  1298|    onCancel={cancel}
  1299|  />
  1300|</div>
  1301|```
  1302|
  1303|---
  1304|
  1305|### Task 7.6: Core UI Components - Feedback & Metrics
  1306|
  1307|**Purpose:** Implement UI components for principles 25-30 (New Loop).
  1308|
  1309|**Referenced Documentation:**
  1310|- `docs/design/appendix-ui-components.md` - Component specifications
  1311|- `docs/design/appendix-trustworthiness.md` - Principles 25-30
  1312|
  1313|**Implementation:**
  1314|1. **MemorySettings** (Principle 25):
  1315|   - Control what to remember
  1316|   - Privacy settings
  1317|   - Retention period
  1318|
  1319|2. **RetryButton** (Principle 26):
  1320|   - One-click restart
  1321|   - Show what will be retried
  1322|   - Different retry options
  1323|
  1324|3. **FeedbackButtons** (Principle 27):
  1325|   - Thumbs up/down
  1326|   - Stars rating
  1327|   - Emoji reactions
  1328|
  1329|4. **FeedbackForm** (Principle 28):
  1330|   - Detailed feedback
  1331|   - Category selection
  1332|   - Free-form text
  1333|   - Screenshot attachment
  1334|
  1335|5. **MetricsDashboard** (Principle 29):
  1336|   - Task completion rate
  1337|   - Average steps
  1338|   - Token usage
  1339|   - Response times
  1340|   - Charts and graphs
  1341|
  1342|6. **TrustScore** (Principle 30):
  1343|   - Overall trust score
  1344|   - Score breakdown
  1345|   - Historical trends
  1346|   - Factors affecting score
  1347|
  1348|**Tests:**
  1349|- All feedback mechanisms work
  1350|- Metrics are calculated correctly
  1351|- Dashboard renders properly
  1352|- Data persistence works
  1353|
  1354|**Verify Steps:**
  1355|```tsx
  1356|import {
  1357|  FeedbackButtons,
  1358|  FeedbackForm,
  1359|  MetricsDashboard,
  1360|  TrustScore
  1361|} from '@wukong/ui'
  1362|
  1363|<div>
  1364|  <FeedbackButtons onFeedback={handleFeedback} />
  1365|  <FeedbackForm onSubmit={submitFeedback} />
  1366|  <MetricsDashboard metrics={metrics} />
  1367|  <TrustScore score={score} breakdown={breakdown} />
  1368|</div>
  1369|```
  1370|
  1371|---
  1372|
  1373|### Task 7.7: Complete Chat Interface
  1374|
  1375|**Purpose:** Implement the all-in-one AgentChat component.
  1376|
  1377|**Referenced Documentation:**
  1378|- `docs/design/appendix-ui-components.md` - AgentChat component
  1379|
  1380|**Implementation:**
  1381|1. **AgentChat** component:
  1382|   - Compose all individual components
  1383|   - Responsive layout
  1384|   - Mobile/tablet/desktop views
  1385|   - Built-in state management
  1386|   - Event handling
  1387|
  1388|2. Layout options:
  1389|   - Stack layout (mobile)
  1390|   - Sidebar layout (tablet)
  1391|   - Split layout (desktop)
  1392|
  1393|3. Features:
  1394|   - All 30 trustworthiness principles
  1395|   - Theme support
  1396|   - Internationalization
  1397|   - Accessibility
  1398|
  1399|**Tests:**
  1400|- Complete flow from start to finish
  1401|- All features accessible
  1402|- Responsive on all screen sizes
  1403|- Performance is good
  1404|
  1405|**Verify Steps:**
  1406|```tsx
  1407|import { AgentChat } from '@wukong/ui'
  1408|
  1409|<AgentChat
  1410|  config={agentConfig}
  1411|  theme="light"
  1412|  showCapabilities={true}
  1413|  showProgress={true}
  1414|  enableFeedback={true}
  1415|  onPlanReady={handlePlanReady}
  1416|  onProgress={handleProgress}
  1417|  onComplete={handleComplete}
  1418|/>
  1419|```
  1420|
  1421|---
  1422|
  1423|### Task 7.8: React Hooks
  1424|
  1425|**Purpose:** Implement custom React hooks for agent integration.
  1426|
  1427|**Referenced Documentation:**
  1428|- `docs/design/appendix-ui-components.md` - Hooks section
  1429|
  1430|**Implementation:**
  1431|1. **useAgent**:
  1432|   - Agent state management
  1433|   - Execute, stop, pause, resume
  1434|   - Real-time status updates
  1435|
  1436|2. **useProgress**:
  1437|   - Track execution progress
  1438|   - Current step and total steps
  1439|   - Estimated time remaining
  1440|
  1441|3. **useTodos**:
  1442|   - Todo list state
  1443|   - Add, update, complete todos
  1444|   - Dependencies tracking
  1445|
  1446|4. **useThinking**:
  1447|   - Streaming thinking process
  1448|   - Buffer management
  1449|   - Auto-scroll control
  1450|
  1451|5. **useFeedback**:
  1452|   - Collect user feedback
  1453|   - Submit to backend
  1454|   - Local caching
  1455|
  1456|6. **useMetrics**:
  1457|   - Track usage metrics
  1458|   - Calculate statistics
  1459|   - Historical data
  1460|
  1461|7. **useHistory**:
  1462|   - Session history
  1463|   - Version management
  1464|   - Undo/redo stack
  1465|
  1466|**Tests:**
  1467|- All hooks work correctly
  1468|- State updates properly
  1469|- Memory leaks are prevented
  1470|- Performance is good
  1471|
  1472|**Verify Steps:**
  1473|```tsx
  1474|import { useAgent, useProgress, useTodos } from '@wukong/ui'
  1475|
  1476|function MyComponent() {
  1477|  const { agent, execute, stop, isRunning } = useAgent(config)
  1478|  const { progress, currentStep, totalSteps } = useProgress(agent)
  1479|  const { todos, updateTodo } = useTodos(agent)
  1480|  
  1481|  return (
  1482|    <div>
  1483|      <button onClick={() => execute({ goal: '...' })}>Start</button>
  1484|      <button onClick={stop}>Stop</button>
  1485|      <div>Progress: {progress}%</div>
  1486|      <div>Step {currentStep} of {totalSteps}</div>
  1487|    </div>
  1488|  )
  1489|}
  1490|```
  1491|
  1492|---
  1493|
  1494|### Task 7.9: Providers and Context
  1495|
  1496|**Purpose:** Implement React context providers for global state.
  1497|
  1498|**Referenced Documentation:**
  1499|- `docs/design/appendix-ui-components.md` - Providers section
  1500|
  1501|**Implementation:**
  1502|1. **ThemeProvider**:
  1503|   - Theme context
  1504|   - Theme switching
  1505|   - CSS variables injection
  1506|
  1507|2. **MetricsProvider**:
  1508|   - Metrics collection
  1509|   - Data persistence
  1510|   - Analytics integration
  1511|
  1512|3. **HistoryProvider**:
  1513|   - Session history
  1514|   - Auto-cleanup
  1515|   - Storage management
  1516|
  1517|4. **I18nProvider**:
  1518|   - Internationalization
  1519|   - Language switching
  1520|   - Custom translations
  1521|
  1522|**Tests:**
  1523|- Providers work correctly
  1524|- Context is accessible
  1525|- Data persists properly
  1526|- No memory leaks
  1527|
  1528|**Verify Steps:**
  1529|```tsx
  1530|import {
  1531|  ThemeProvider,
  1532|  MetricsProvider,
  1533|  HistoryProvider,
  1534|  I18nProvider
  1535|} from '@wukong/ui'
  1536|
  1537|<ThemeProvider theme="light">
  1538|  <I18nProvider locale="zh-CN">
  1539|    <MetricsProvider storageKey="metrics">
  1540|      <HistoryProvider maxSessions={10}>
  1541|        <App />
  1542|      </HistoryProvider>
  1543|    </MetricsProvider>
  1544|  </I18nProvider>
  1545|</ThemeProvider>
  1546|```
  1547|
  1548|---
  1549|
  1550|### Task 7.10: Styling and Theming
  1551|
  1552|**Purpose:** Implement comprehensive theming system.
  1553|
  1554|**Referenced Documentation:**
  1555|- `docs/design/appendix-ui-components.md` - Theme customization
  1556|
  1557|**Implementation:**
  1558|1. Theme structure:
  1559|   - Colors (primary, secondary, success, warning, error)
  1560|   - Spacing (xs, sm, md, lg, xl)
  1561|   - Typography (font family, sizes, weights)
  1562|   - Border radius
  1563|   - Shadows
  1564|   - Component-specific overrides
  1565|
  1566|2. Preset themes:
  1567|   - Light theme
  1568|   - Dark theme
  1569|   - Auto (system preference)
  1570|
  1571|3. CSS variables:
  1572|   - Generate from theme
  1573|   - Runtime updates
  1574|   - Fallback values
  1575|
  1576|**Tests:**
  1577|- Themes apply correctly
  1578|- Custom themes work
  1579|- CSS variables update
  1580|- No style conflicts
  1581|
  1582|**Verify Steps:**
  1583|```tsx
  1584|<ThemeProvider theme={{
  1585|  colors: {
  1586|    primary: '#0070f3',
  1587|    background: '#ffffff'
  1588|  },
  1589|  spacing: { md: 16 },
  1590|  borderRadius: { md: 8 }
  1591|}}>
  1592|  <AgentChat config={config} />
  1593|</ThemeProvider>
  1594|```
  1595|
  1596|---
  1597|
  1598|### Task 7.11: Accessibility
  1599|
  1600|**Purpose:** Ensure all components meet WCAG 2.1 AA standards.
  1601|
  1602|**Referenced Documentation:**
  1603|- `docs/design/appendix-ui-components.md` - Accessibility section
  1604|
  1605|**Implementation:**
  1606|1. Keyboard navigation:
  1607|   - Tab order
  1608|   - Focus management
  1609|   - Keyboard shortcuts
  1610|
  1611|2. Screen reader support:
  1612|   - ARIA labels
  1613|   - ARIA descriptions
  1614|   - Live regions for updates
  1615|
  1616|3. Visual accessibility:
  1617|   - Sufficient color contrast
  1618|   - Focus indicators
  1619|   - High contrast mode
  1620|
  1621|4. Accessibility options:
  1622|   - Enable/disable features
  1623|   - Announce progress
  1624|   - Custom aria labels
  1625|
  1626|**Tests:**
  1627|- Keyboard navigation works
  1628|- Screen reader announces correctly
  1629|- Color contrast meets standards
  1630|- Focus management is correct
  1631|
  1632|**Verify Steps:**
  1633|```tsx
  1634|<AgentChat
  1635|  accessibility={{
  1636|    enableKeyboardNavigation: true,
  1637|    announceProgress: true,
  1638|    highContrast: false
  1639|  }}
  1640|/>
  1641|```
  1642|
  1643|---
  1644|
  1645|### Task 7.12: Internationalization
  1646|
  1647|**Purpose:** Support multiple languages.
  1648|
  1649|**Referenced Documentation:**
  1650|- `docs/design/appendix-ui-components.md` - I18n section
  1651|
  1652|**Implementation:**
  1653|1. Translation system:
  1654|   - Default translations (en-US, zh-CN)
  1655|   - Translation loading
  1656|   - Fallback language
  1657|
  1658|2. Supported languages:
  1659|   - English (en-US)
  1660|   - Simplified Chinese (zh-CN)
  1661|   - Japanese (ja-JP)
  1662|   - Korean (ko-KR)
  1663|
  1664|3. Custom translations:
  1665|   - Override defaults
  1666|   - Add new languages
  1667|   - Pluralization support
  1668|
  1669|**Tests:**
  1670|- All languages load correctly
  1671|- Translations display properly
  1672|- Fallbacks work
  1673|- Custom translations work
  1674|
  1675|**Verify Steps:**
  1676|```tsx
  1677|<I18nProvider locale="zh-CN">
  1678|  <AgentChat config={config} />
  1679|</I18nProvider>
  1680|```
  1681|
  1682|---
  1683|
  1684|### Task 7.13: Responsive Design
  1685|
  1686|**Purpose:** Ensure all components work on all screen sizes.
  1687|
  1688|**Referenced Documentation:**
  1689|- `docs/design/appendix-ui-components.md` - Responsive design
  1690|
  1691|**Implementation:**
  1692|1. Breakpoints:
  1693|   - Mobile: < 640px
  1694|   - Tablet: 640px - 1024px
  1695|   - Desktop: > 1024px
  1696|
  1697|2. Layout modes:
  1698|   - Stack (mobile): vertical layout
  1699|   - Sidebar (tablet): side panel
  1700|   - Split (desktop): two columns
  1701|
  1702|3. Responsive components:
  1703|   - Adapt to screen size
  1704|   - Touch-friendly on mobile
  1705|   - Hover effects on desktop
  1706|
  1707|**Tests:**
  1708|- All layouts work correctly
  1709|- Components adapt to screen size
  1710|- Touch interactions work
  1711|- No horizontal scroll
  1712|
  1713|**Verify Steps:**
  1714|```tsx
  1715|<AgentChat
  1716|  layout={{
  1717|    mobile: 'stack',
  1718|    tablet: 'sidebar',
  1719|    desktop: 'split'
  1720|  }}
  1721|  breakpoints={{
  1722|    mobile: 640,
  1723|    tablet: 1024,
  1724|    desktop: 1280
  1725|  }}
  1726|/>
  1727|```
  1728|
  1729|---
  1730|
  1731|### Task 7.14: Component Documentation with Storybook
  1732|
  1733|**Purpose:** Document all components with interactive examples.
  1734|
  1735|**Implementation:**
  1736|1. Set up Storybook:
  1737|   - Install and configure
  1738|   - Add stories for all components
  1739|   - Configure addons (a11y, docs)
  1740|
  1741|2. Write stories:
  1742|   - Basic usage
  1743|   - All props/variants
  1744|   - Interactive examples
  1745|   - Accessibility checks
  1746|
  1747|3. Documentation:
  1748|   - Component descriptions
  1749|   - Props table
  1750|   - Usage examples
  1751|   - Best practices
  1752|
  1753|**Tests:**
  1754|- All stories render correctly
  1755|- Props are documented
  1756|- Examples work
  1757|- Accessibility passes
  1758|
  1759|**Verify Steps:**
  1760|```bash
  1761|cd packages/ui
  1762|pnpm storybook
  1763|# Visit http://localhost:6006
  1764|```
  1765|
  1766|---
  1767|
  1768|## Phase 8: Documentation & Examples
  1769|
  1770|### Task 8.1: API Documentation
  1771|
  1772|**Purpose:** Generate comprehensive API documentation for all public interfaces.
  1773|
  1774|**Implementation:**
  1775|1. Add JSDoc comments to all public APIs
  1776|2. Generate documentation with TypeDoc
  1777|3. Create API reference website
  1778|
  1779|**Verify Steps:**
  1780|- All public methods have JSDoc comments
  1781|- Documentation generates without errors
  1782|- Examples are included
  1783|- Type signatures are correct
  1784|
  1785|---
  1786|
  1787|### Task 8.2: Usage Examples
  1788|
  1789|**Purpose:** Provide working examples for common use cases.
  1790|
  1791|**Referenced Documentation:**
  1792|- `docs/design/11-examples.md` - Usage examples
  1793|
  1794|**Implementation:**
  1795|1. Create example applications in `examples/`:
  1796|   - `examples/basic` - Simple agent usage (already exists, enhance it)
  1797|   - `examples/interactive` - InteractiveAgent with UI
  1798|   - `examples/auto` - AutoAgent with knowledge base
  1799|   - `examples/ui-components` - UI components showcase
  1800|   - `examples/custom-adapter` - Custom storage adapter
  1801|   - `examples/custom-tools` - Custom tool creation
  1802|   - `examples/server` - Complete server setup (created in Phase 7) ✅
  1803|   - `examples/ui` - UI connecting to server (already exists, enhance with real connection)
  1804|
  1805|**Verify Steps:**
  1806|```bash
  1807|cd examples/interactive
  1808|pnpm install
  1809|pnpm dev
  1810|# Should run successfully with UI
  1811|```
  1812|
  1813|---
  1814|
  1815|### Task 8.3: Migration Guide
  1816|
  1817|**Purpose:** Help users migrate from other agent frameworks.
  1818|
  1819|**Implementation:**
  1820|1. Create migration guides:
  1821|   - From LangChain
  1822|   - From raw OpenAI API
  1823|   - From other agent frameworks
  1824|
  1825|---
  1826|
  1827|### Task 8.4: Tutorial Series
  1828|
  1829|**Purpose:** Guide users through building real applications.
  1830|
  1831|**Implementation:**
  1832|1. Create tutorials:
  1833|   - Building a document Q&A agent
  1834|   - Building a data analysis agent
  1835|   - Building a multi-agent system
  1836|   - Building custom tools
  1837|   - Deploying to production
  1838|   - Integrating UI components
  1839|
  1840|---
  1841|
  1842|## Testing Strategy
  1843|
  1844|### Unit Tests
  1845|
  1846|For each component:
  1847|- Test all public methods
  1848|- Test error cases
  1849|- Test edge cases
  1850|- Mock external dependencies
  1851|- Aim for >80% coverage
  1852|
  1853|### Integration Tests
  1854|
  1855|Test component interactions:
  1856|- Agent + Storage + LLM
  1857|- Agent + Tools + Knowledge Base
  1858|- Complete execution flows
  1859|- Error recovery scenarios
  1860|
  1861|### End-to-End Tests
  1862|
  1863|Test complete user scenarios:
  1864|- Create session → Execute task → Get result
  1865|- Interactive mode with user confirmations
  1866|- Auto mode with knowledge base search
  1867|- Agent fork with sub-tasks
  1868|- Stop and resume
  1869|
  1870|### Performance Tests
  1871|
  1872|- Token counting accuracy
  1873|- Cache hit rate
  1874|- Database query performance
  1875|- Vector search latency
  1876|- Concurrent request handling
  1877|
  1878|---
  1879|
  1880|## Deployment Checklist
  1881|
  1882|### Before Production
  1883|
  1884|- [ ] All tests pass
  1885|- [ ] Documentation is complete
  1886|- [ ] Examples work
  1887|- [ ] Security audit completed
  1888|- [ ] Performance benchmarks met
  1889|- [ ] Error handling is robust
  1890|- [ ] Monitoring is configured
  1891|- [ ] Rate limiting is enabled
  1892|
  1893|### Production Deployment
  1894|
  1895|1. Deploy to staging environment
  1896|2. Run smoke tests
  1897|3. Monitor for errors
  1898|4. Deploy to production
  1899|5. Monitor metrics:
  1900|   - Request rate
  1901|   - Error rate
  1902|   - Token usage
  1903|   - Response times
  1904|   - Cache hit rate
  1905|
  1906|---
  1907|
  1908|## Success Metrics
  1909|
  1910|### Functionality
  1911|- All core features work as designed
  1912|- Test coverage >80%
  1913|- No critical bugs
  1914|
  1915|### Performance
  1916|- Average response time < 2s
  1917|- Token optimization >90% vs traditional
  1918|- Cache hit rate >60%
  1919|
  1920|### Developer Experience
  1921|- Easy to install (< 5 min)
  1922|- Easy to configure (< 10 lines)
  1923|- Good documentation
  1924|- Working examples
  1925|
  1926|---
  1927|
  1928|
  1929|---
  1930|
  1931|## Priority Levels
  1932|
  1933|### P0 (Must Have - Minimum Viable Product)
  1934|- Phase 1: All tasks ✅
  1935|- Phase 2: All tasks ✅
  1936|- Phase 3: Tasks 3.1-3.3, 3.9 ✅
  1937|- Core agent functionality without advanced features
  1938|
  1939|### P1 (Should Have - Full Feature Set)
  1940|- Phase 3: Tasks 3.4-3.8, 3.10 ✅
  1941|- Phase 4: All tasks ✅
  1942|- Phase 6: Tasks 6.1-6.5 (Basic server functionality) ✅
  1943|- Phase 7: Tasks 7.1-7.7 (Core UI components)
  1944|- Complete feature set with server and UI components
  1945|
  1946|### P2 (Nice to Have - Polish & Enhancement)
  1947|- Phase 5: All tasks (Optimization)
  1948|- Phase 6: Tasks 6.6-6.11 (Advanced server features) ✅
  1949|- Phase 7: Tasks 7.8-7.14 (Advanced UI features)
  1950|- Phase 8: All tasks (Documentation & Examples)
  1951|- Optimization, advanced server/UI features, and documentation
  1952|
  1953|---
  1954|
  1955|## Next Steps
  1956|
  1957|1. **Review this plan** with the team
  1958|2. **Set up development environment** (Task 1.1)
  1959|3. **Start with Phase 1** foundation tasks
  1960|4. **Implement incrementally** and test thoroughly
  1961|5. **Iterate based on feedback**
  1962|
  1963|---
  1964|
  1965|## Questions to Resolve
  1966|
  1967|Before starting implementation, clarify:
  1968|
  1969|1. **Target Node.js version?** (Recommend: Node 18+)
  1970|2. **Browser support needed?** (Or Node.js only?)
  1971|3. **License?** (MIT recommended for library)
  1972|4. **Package registry?** (npm public or private?)
  1973|5. **Monorepo tool?** (pnpm workspaces recommended)
  1974|6. **CI/CD platform?** (GitHub Actions, GitLab CI, etc.)
  1975|7. **Hosting for docs?** (Vercel, Netlify, GitHub Pages?)
  1976|
  1977|---
  1978|
  1979|## Related Documentation
  1980|
  1981|- [Core Design Principles](../design/01-core-concepts.md)
  1982|- [Architecture](../design/02-architecture.md)
  1983|- [Interfaces](../design/03-interfaces.md)
  1984|- [Knowledge Base](../design/04-knowledge-base.md)
  1985|- [Tools System](../design/05-tools-system.md)
  1986|- [Advanced Features](../design/06-advanced-features.md)
  1987|- [Todo List](../design/07-todo-list.md)
  1988|- [Token Optimization](../design/08-token-optimization.md)
  1989|- [Trustworthiness](../design/09-trustworthiness.md)
  1990|- [Implementation Details](../design/10-implementation.md)
  1991|- [Prompt Engineering](../design/12-prompt-engineering.md)
  1992|- [Database Design](../design/13-database-design.md)
  1993|- [Implementation Patterns](../design/14-implementation-patterns.md)
  1994|- [Trustworthiness Checklist](../design/appendix-trustworthiness.md)
  1995|- [UI Components](../design/appendix-ui-components.md)
  1996|- [Recommended Libraries](./recommended-libraries.md)
  1997|
  1998|---
  1999|
  2000|**Ready to start building!** 🚀
  2001|
  2002|