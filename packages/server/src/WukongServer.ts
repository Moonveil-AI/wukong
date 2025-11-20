import { type Server as HTTPServer, createServer } from 'node:http';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { WebSocketServer } from 'ws';
import { SessionManager } from './SessionManager.js';
import { errorHandler } from './middleware/errorHandler.js';
import { type RateLimiter, createRateLimiter } from './middleware/rateLimit.js';
import { setupRoutes } from './routes/index.js';
import { SSEManager } from './routes/sse.js';
import type { WukongServerConfig } from './types.js';
import { createLogger, requestLoggingMiddleware } from './utils/logger.js';
import { WebSocketManager } from './websocket/WebSocketManager.js';

/**
 * Production-ready backend server for Wukong agent execution
 *
 * Provides HTTP REST API, WebSocket communication, and Server-Sent Events
 * for real-time agent execution and monitoring.
 *
 * @example
 * ```typescript
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
 */
export class WukongServer {
  private app: Express;
  private httpServer: HTTPServer | null = null;
  private wsServer: WebSocketServer | null = null;
  private sessionManager: SessionManager;
  private wsManager: WebSocketManager | null = null;
  private sseManager: SSEManager | null = null;
  private rateLimiter: RateLimiter | null = null;
  private config: Required<WukongServerConfig>;
  private logger: ReturnType<typeof createLogger>;

  constructor(config: WukongServerConfig) {
    // Set default configuration
    this.config = {
      port: config.port ?? 3000,
      host: config.host ?? '0.0.0.0',
      agent: config.agent,
      cors: config.cors ?? { origin: true, credentials: true },
      auth: config.auth ?? { enabled: false, type: 'apikey' },
      rateLimit: {
        windowMs: config.rateLimit?.windowMs ?? 60 * 1000,
        maxRequests: config.rateLimit?.maxRequests ?? 60,
        maxTokensPerMinute: config.rateLimit?.maxTokensPerMinute ?? 100000,
        maxConcurrentExecutions: config.rateLimit?.maxConcurrentExecutions ?? 3,
      },
      session: {
        timeout: config.session?.timeout ?? 30 * 60 * 1000,
        maxSessionsPerUser: config.session?.maxSessionsPerUser ?? 5,
        cleanupInterval: config.session?.cleanupInterval ?? 5 * 60 * 1000,
        persist: config.session?.persist ?? true,
      },
      logging: {
        level: config.logging?.level ?? 'info',
        format: config.logging?.format ?? 'json',
        destination: config.logging?.destination,
      },
      security: {
        enforceHttps: config.security?.enforceHttps ?? false,
        hsts: config.security?.hsts ?? false,
      },
      websocket: {
        enabled: config.websocket?.enabled ?? true,
        path: config.websocket?.path ?? '/ws',
      },
      sse: {
        enabled: config.sse?.enabled ?? true,
        path: config.sse?.path ?? '/events',
      },
    };

    this.logger = createLogger(this.config.logging);
    this.app = express();

    // Try to get cache adapter from agent instance if available
    const cacheAdapter = this.config.agent.instance?.getAdapter();
    this.sessionManager = new SessionManager(
      this.config.agent,
      this.config.session,
      cacheAdapter as any, // CacheAdapter is part of the combined adapter
    );

    // Create rate limiter if configured
    this.rateLimiter = createRateLimiter(
      config.rateLimit,
      cacheAdapter as any, // CacheAdapter is part of the combined adapter
    );

    this.setupMiddleware();
  }

  /**
   * Set up Express middleware
   */
  private setupMiddleware(): void {
    // Security headers
    this.app.use(helmet());

    // CORS
    this.app.use(cors(this.config.cors));

    // Body parsing
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // Request logging with performance tracking
    this.app.use(requestLoggingMiddleware(this.logger));

    // Rate limiting
    if (this.rateLimiter) {
      this.app.use(this.rateLimiter.middleware());
      this.logger.info('Rate limiting enabled', {
        maxRequests: this.config.rateLimit?.maxRequests,
        windowMs: this.config.rateLimit?.windowMs,
      });
    }
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    // Set up SSE manager if enabled
    if (this.config.sse.enabled) {
      this.sseManager = new SSEManager(this.logger);
      this.logger.info('SSE enabled', {
        path: this.config.sse.path,
      });
    }

    // Set up routes
    setupRoutes(this.app, {
      sessionManager: this.sessionManager,
      config: this.config,
      logger: this.logger,
      sseManager: this.sseManager ?? undefined,
      rateLimiter: this.rateLimiter ?? undefined,
    });

    // Error handler (must be last)
    this.app.use(errorHandler(this.logger));

    // Create HTTP server
    this.httpServer = createServer(this.app);

    // Set up WebSocket if enabled
    if (this.config.websocket.enabled) {
      this.wsServer = new WebSocketServer({
        server: this.httpServer,
        path: this.config.websocket.path,
      });

      this.wsManager = new WebSocketManager(this.wsServer, this.sessionManager, this.logger);

      this.logger.info('WebSocket enabled', {
        path: this.config.websocket.path,
      });
    }

    // Start listening
    await new Promise<void>((resolve) => {
      this.httpServer?.listen(this.config.port, this.config.host, () => {
        this.logger.info('Server started', {
          host: this.config.host,
          port: this.config.port,
        });
        resolve();
      });
    });

    // Restore sessions from persistent storage
    if (this.config.session.persist) {
      const restoredCount = await this.sessionManager.restoreSessions();
      if (restoredCount > 0) {
        this.logger.info('Restored sessions', { count: restoredCount });
      }
    }

    // Start session cleanup
    this.sessionManager.startCleanup();
  }

  /**
   * Stop the server
   */
  async stop(): Promise<void> {
    this.logger.info('Stopping server');

    // Stop session cleanup
    this.sessionManager.stopCleanup();

    // Close SSE connections
    if (this.sseManager) {
      this.sseManager.closeAll();
    }

    // Close WebSocket connections
    if (this.wsManager) {
      this.wsManager.closeAll();
    }

    // Close WebSocket server
    if (this.wsServer) {
      await new Promise<void>((resolve, reject) => {
        this.wsServer?.close((err) => {
          // Ignore "The server is not running" error
          if (err && !err.message?.includes('not running')) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
      this.wsServer = null;
    }

    // Close HTTP server
    if (this.httpServer) {
      await new Promise<void>((resolve, reject) => {
        this.httpServer?.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      this.httpServer = null;
    }

    this.logger.info('Server stopped');
  }

  /**
   * Get the Express app instance
   */
  getApp(): Express {
    return this.app;
  }

  /**
   * Get server info
   */
  getInfo(): {
    port: number;
    host: string;
    websocket: boolean;
    sse: boolean;
  } {
    return {
      port: this.config.port,
      host: this.config.host,
      websocket: this.config.websocket.enabled ?? true,
      sse: this.config.sse.enabled ?? true,
    };
  }
}
