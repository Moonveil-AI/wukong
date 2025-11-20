/**
 * @wukong/server
 *
 * Production-ready backend server for Wukong agent execution
 *
 * Features:
 * - HTTP REST API for session and agent management
 * - WebSocket support for real-time bidirectional communication
 * - Server-Sent Events (SSE) for streaming responses
 * - Session management with automatic cleanup
 * - Error handling and logging
 * - CORS and security middleware
 * - Rate limiting and authentication (optional)
 *
 * @example
 * ```typescript
 * import { WukongServer } from '@wukong/server'
 * import { LocalAdapter } from '@wukong/adapter-local'
 * import { ClaudeAdapter } from '@wukong/llm-anthropic'
 * import { WukongAgent } from '@wukong/agent'
 *
 * const server = new WukongServer({
 *   port: 3000,
 *   agent: {
 *     factory: () => new WukongAgent({
 *       adapter: new LocalAdapter({ dbPath: './data/wukong.db' }),
 *       llm: { models: [new ClaudeAdapter()] }
 *     })
 *   }
 * })
 *
 * await server.start()
 * console.log('Server running on http://localhost:3000')
 * ```
 *
 * @packageDocumentation
 */

export { WukongServer } from './WukongServer.js';
export { SessionManager } from './SessionManager.js';
export { WebSocketManager } from './websocket/WebSocketManager.js';
export { SSEManager } from './routes/sse.js';
export { errorHandler, ApiError, errors, asyncHandler } from './middleware/errorHandler.js';
export { createLogger, requestLoggingMiddleware, PerformanceLogger } from './utils/logger.js';
export {
  RateLimiter,
  createRateLimiter,
  concurrentLimitMiddleware,
} from './middleware/rateLimit.js';

export type {
  WukongServerConfig,
  User,
  ApiResponse,
  SessionInfo,
  WebSocketMessage,
  WebSocketEvent,
  AuthenticatedRequest,
} from './types.js';
