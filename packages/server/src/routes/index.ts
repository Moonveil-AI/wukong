import type { Express, Request, Response } from 'express';
import type { SessionManager } from '../SessionManager.js';
import { errors } from '../middleware/errorHandler.js';
import { type RateLimiter, concurrentLimitMiddleware } from '../middleware/rateLimit.js';
import type { ApiResponse, WukongServerConfig } from '../types.js';
import type { createLogger } from '../utils/logger.js';
import { type SSEManager, setupSSERoutes } from './sse.js';

interface RouteContext {
  sessionManager: SessionManager;
  config: Required<WukongServerConfig>;
  logger: ReturnType<typeof createLogger>;
  sseManager?: SSEManager;
  rateLimiter?: RateLimiter;
}

/**
 * Set up all HTTP routes
 */
export function setupRoutes(app: Express, context: RouteContext): void {
  const { sessionManager, logger, sseManager, rateLimiter } = context;

  // Create concurrent limit middleware
  const concurrentLimit = concurrentLimitMiddleware(rateLimiter ?? null);

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
      const session = sessionManager.get(sessionId);

      if (!session) {
        throw errors.internal('Failed to retrieve created session');
      }

      const response: ApiResponse = {
        success: true,
        data: session.info,
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
      if (!sessionId) {
        throw errors.badRequest('Session ID is required');
      }
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
      if (!sessionId) {
        throw errors.badRequest('Session ID is required');
      }

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
   * Execute task (non-streaming, async)
   * Returns immediately with status; use SSE/WebSocket for real-time updates
   */
  app.post(
    '/api/sessions/:sessionId/execute',
    concurrentLimit,
    async (req: Request, res: Response, next) => {
      try {
        const { sessionId } = req.params;
        if (!sessionId) {
          throw errors.badRequest('Session ID is required');
        }
        const { goal, context } = req.body;

        if (!goal) {
          throw errors.badRequest('Goal is required');
        }

        const session = sessionManager.get(sessionId);
        if (!session) {
          throw errors.notFound(`Session ${sessionId} not found`);
        }

        // Update status
        await sessionManager.updateStatus(sessionId, 'running');

        // Return immediately - execution happens in background
        const response: ApiResponse = {
          success: true,
          data: {
            sessionId,
            status: 'running',
            message: 'Execution started. Use SSE or WebSocket for real-time updates.',
          },
        };

        logger.info('Execution started (async)', { sessionId });
        res.json(response);

        // Execute in background - pass sessionId to ensure history is saved to the right session
        session.agent
          .execute({ goal, context, sessionId })
          .then(async () => {
            await sessionManager.updateStatus(sessionId, 'completed');
            logger.info('Execution completed', { sessionId });
          })
          .catch(async (error: any) => {
            await sessionManager.updateStatus(sessionId, 'error');
            logger.error('Execution error', { sessionId, error: error.message });
          });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * Execute task with streaming (chunked transfer)
   * Streams events as newline-delimited JSON
   */
  app.post(
    '/api/sessions/:sessionId/execute-stream',
    concurrentLimit,
    async (req: Request, res: Response, next) => {
      try {
        const { sessionId } = req.params;
        if (!sessionId) {
          throw errors.badRequest('Session ID is required');
        }
        const { goal, context } = req.body;

        if (!goal) {
          throw errors.badRequest('Goal is required');
        }

        const session = sessionManager.get(sessionId);
        if (!session) {
          throw errors.notFound(`Session ${sessionId} not found`);
        }

        // Set up streaming response
        res.setHeader('Content-Type', 'application/x-ndjson');
        res.setHeader('Transfer-Encoding', 'chunked');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        // Helper to send events
        const sendEvent = (type: string, data: any) => {
          const event = { type, data, timestamp: new Date().toISOString() };
          res.write(`${JSON.stringify(event)}\n`);
        };

        // Update status
        await sessionManager.updateStatus(sessionId, 'running');
        sendEvent('execution:started', { sessionId });

        // Set up event listeners
        const onStreaming = (event: any) => {
          sendEvent('llm:streaming', {
            text: event.chunk?.fullText || '',
            delta: event.chunk?.text || '',
          });
        };

        const onToolExecuting = (event: any) => {
          sendEvent('tool:executing', {
            tool: event.toolName,
            parameters: event.parameters,
          });
        };

        const onToolCompleted = (event: any) => {
          sendEvent('tool:completed', {
            tool: event.toolName,
            result: event.result,
          });
        };

        // Attach event listeners
        session.agent.on('llm:streaming', onStreaming);
        session.agent.on('tool:executing', onToolExecuting);
        session.agent.on('tool:completed', onToolCompleted);

        try {
          // Execute - pass sessionId to ensure history is saved to the right session
          const result = await session.agent.execute({ goal, context, sessionId });

          await sessionManager.updateStatus(sessionId, 'completed');
          sendEvent('agent:complete', result);

          logger.info('Streaming execution completed', { sessionId });
        } catch (error: any) {
          await sessionManager.updateStatus(sessionId, 'error');
          sendEvent('agent:error', {
            error: error.message,
            details: error.stack,
          });
          logger.error('Streaming execution error', { sessionId, error: error.message });
        } finally {
          // Remove event listeners
          session.agent.off('llm:streaming', onStreaming);
          session.agent.off('tool:executing', onToolExecuting);
          session.agent.off('tool:completed', onToolCompleted);

          // End response
          res.end();
        }
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * Stop execution
   */
  app.post('/api/sessions/:sessionId/stop', async (req: Request, res: Response, next) => {
    try {
      const { sessionId } = req.params;
      if (!sessionId) {
        throw errors.badRequest('Session ID is required');
      }

      const session = sessionManager.get(sessionId);
      if (!session) {
        throw errors.notFound(`Session ${sessionId} not found`);
      }

      // TODO: Implement proper stop mechanism
      // The agent doesn't have a public stop() method
      // We need to use the StopController or implement a stop mechanism

      await sessionManager.updateStatus(sessionId, 'idle');

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
   * Get chat history for a session
   */
  app.get('/api/sessions/:sessionId/history', async (req: Request, res: Response, next) => {
    try {
      const { sessionId } = req.params;
      if (!sessionId) {
        throw errors.badRequest('Session ID is required');
      }
      const { limit = '50', offset = '0' } = req.query;

      const session = sessionManager.get(sessionId);
      if (!session) {
        throw errors.notFound(`Session ${sessionId} not found`);
      }

      // Get history from agent
      // Note: getHistory expects just sessionId
      const history = await session.agent.getHistory?.(sessionId);

      // Get session details from adapter to include goal
      const adapter = session.agent.getAdapter();
      const sessionDetails = await adapter.getSession(sessionId);

      const response: ApiResponse = {
        success: true,
        data: {
          sessionId,
          goal: sessionDetails?.goal,
          initialGoal: sessionDetails?.initialGoal,
          history: history || [],
          limit: Number.parseInt(limit as string, 10),
          offset: Number.parseInt(offset as string, 10),
        },
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  });

  /**
   * Submit feedback
   */
  app.post('/api/feedback', (req: Request, res: Response, next) => {
    try {
      const { sessionId, type, rating, comment, metadata } = req.body;

      if (!sessionId) {
        throw errors.badRequest('Session ID is required');
      }

      if (!(type && ['positive', 'negative', 'neutral'].includes(type))) {
        throw errors.badRequest('Valid feedback type is required (positive, negative, neutral)');
      }

      // Validate session exists
      const session = sessionManager.get(sessionId);
      if (!session) {
        throw errors.notFound(`Session ${sessionId} not found`);
      }

      // Store feedback
      // Note: In a real implementation, we'd store this in a database
      // For now, we just log it
      const feedback = {
        id: `feedback-${Date.now()}`,
        sessionId,
        type,
        rating,
        comment,
        metadata,
        timestamp: new Date().toISOString(),
      };

      logger.info('Feedback received', feedback);

      const response: ApiResponse = {
        success: true,
        data: {
          message: 'Feedback received',
          feedbackId: feedback.id,
        },
      };

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
          'Streaming execution',
          'Chat history',
          'Feedback collection',
        ],
      },
    };

    res.json(response);
  });
}
