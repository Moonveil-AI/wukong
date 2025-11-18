import type { Express, Request, Response } from 'express';
import type { SessionManager } from '../SessionManager.js';
import { errors } from '../middleware/errorHandler.js';
import type { ApiResponse, WukongServerConfig } from '../types.js';
import type { createLogger } from '../utils/logger.js';
import { type SSEManager, setupSSERoutes } from './sse.js';

interface RouteContext {
  sessionManager: SessionManager;
  config: Required<WukongServerConfig>;
  logger: ReturnType<typeof createLogger>;
  sseManager?: SSEManager;
}

/**
 * Set up all HTTP routes
 */
export function setupRoutes(app: Express, context: RouteContext): void {
  const { sessionManager, logger, sseManager } = context;

  // Set up SSE routes if enabled
  if (sseManager) {
    setupSSERoutes(app, sessionManager, sseManager, logger);
  }

  /**
   * Health check endpoint
   */
  app.get('/api/health', (_req: Request, res: Response) => {
    const response: ApiResponse = {
      success: true,
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
      },
    };
    res.json(response);
  });

  /**
   * Create new session
   */
  app.post('/api/sessions', async (req: Request, res: Response, next) => {
    try {
      const { userId = 'anonymous' } = req.body;

      const { sessionId } = await sessionManager.create(userId);

      const response: ApiResponse = {
        success: true,
        data: {
          sessionId,
          createdAt: new Date().toISOString(),
        },
      };

      logger.info('Session created', { sessionId, userId });
      res.json(response);
    } catch (error) {
      next(error);
    }
  });

  /**
   * Get session details
   */
  app.get('/api/sessions/:sessionId', (req: Request, res: Response, next) => {
    try {
      const { sessionId } = req.params;
      const session = sessionManager.get(sessionId);

      if (!session) {
        throw errors.notFound(`Session ${sessionId} not found`);
      }

      const response: ApiResponse = {
        success: true,
        data: session.info,
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  });

  /**
   * List sessions for a user
   */
  app.get('/api/sessions', (req: Request, res: Response, next) => {
    try {
      const { userId = 'anonymous' } = req.query;

      const sessions = sessionManager.getActiveSessions(userId as string);

      const response: ApiResponse = {
        success: true,
        data: { sessions },
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  });

  /**
   * Delete session
   */
  app.delete('/api/sessions/:sessionId', (req: Request, res: Response, next) => {
    try {
      const { sessionId } = req.params;

      sessionManager.destroy(sessionId);

      const response: ApiResponse = {
        success: true,
        data: { message: 'Session deleted' },
      };

      logger.info('Session deleted', { sessionId });
      res.json(response);
    } catch (error) {
      next(error);
    }
  });

  /**
   * Execute task (non-streaming)
   */
  app.post('/api/sessions/:sessionId/execute', async (req: Request, res: Response, next) => {
    try {
      const { sessionId } = req.params;
      const { goal, context } = req.body;

      if (!goal) {
        throw errors.badRequest('Goal is required');
      }

      const session = sessionManager.get(sessionId);
      if (!session) {
        throw errors.notFound(`Session ${sessionId} not found`);
      }

      // Update status
      sessionManager.updateStatus(sessionId, 'running');

      // Execute (this is a simplified version - real implementation would handle streaming, etc.)
      try {
        const result = await session.agent.execute({ goal, context });

        sessionManager.updateStatus(sessionId, 'completed');

        const response: ApiResponse = {
          success: true,
          data: result,
        };

        logger.info('Execution completed', { sessionId });
        res.json(response);
      } catch (error: any) {
        sessionManager.updateStatus(sessionId, 'error');
        throw error;
      }
    } catch (error) {
      next(error);
    }
  });

  /**
   * Stop execution
   */
  app.post('/api/sessions/:sessionId/stop', (req: Request, res: Response, next) => {
    try {
      const { sessionId } = req.params;

      const session = sessionManager.get(sessionId);
      if (!session) {
        throw errors.notFound(`Session ${sessionId} not found`);
      }

      // TODO: Implement proper stop mechanism
      // The agent doesn't have a public stop() method
      // We need to use the StopController or implement a stop mechanism

      sessionManager.updateStatus(sessionId, 'idle');

      const response: ApiResponse = {
        success: true,
        data: { message: 'Execution stopped' },
      };

      logger.info('Execution stopped', { sessionId });
      res.json(response);
    } catch (error) {
      next(error);
    }
  });

  /**
   * Get agent capabilities
   */
  app.get('/api/capabilities', (_req: Request, res: Response) => {
    const response: ApiResponse = {
      success: true,
      data: {
        features: [
          'Interactive agent mode',
          'Auto agent mode',
          'Tool execution',
          'Knowledge base search',
          'Session management',
          'WebSocket streaming',
          'Server-Sent Events',
        ],
      },
    };

    res.json(response);
  });
}
