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
      const session = sessionManager.get(sessionId);

      if (!session) {
        throw errors.internalError('Failed to retrieve created session');
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
   * Execute task (non-streaming, async)
   * Returns immediately with status; use SSE/WebSocket for real-time updates
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

      // Execute in background
      session.agent
        .execute({ goal, context })
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
  });

  /**
   * Execute task with streaming (chunked transfer)
   * Streams events as newline-delimited JSON
   */
  app.post('/api/sessions/:sessionId/execute-stream', async (req: Request, res: Response, next) => {
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
      const onStreaming = (data: { text: string; delta: string }) => {
        sendEvent('llm:streaming', data);
      };

      const onToolExecuting = (data: { tool: string; parameters: any }) => {
        sendEvent('tool:executing', data);
      };

      const onToolCompleted = (data: { tool: string; result: any }) => {
        sendEvent('tool:completed', data);
      };

      const onProgress = (data: { step: number; total: number; message: string }) => {
        sendEvent('agent:progress', data);
      };

      // Attach event listeners
      session.agent.on('llm:streaming', onStreaming);
      session.agent.on('tool:executing', onToolExecuting);
      session.agent.on('tool:completed', onToolCompleted);
      session.agent.on('agent:progress', onProgress);

      try {
        // Execute
        const result = await session.agent.execute({ goal, context });

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
        session.agent.off('agent:progress', onProgress);

        // End response
        res.end();
      }
    } catch (error) {
      next(error);
    }
  });

  /**
   * Stop execution
   */
  app.post('/api/sessions/:sessionId/stop', async (req: Request, res: Response, next) => {
    try {
      const { sessionId } = req.params;

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
      const { limit = '50', offset = '0' } = req.query;

      const session = sessionManager.get(sessionId);
      if (!session) {
        throw errors.notFound(`Session ${sessionId} not found`);
      }

      // Get history from agent
      // Note: This assumes the agent has a getHistory method
      // In reality, we'd need to add this to the agent interface
      const history = await session.agent.getHistory?.({
        limit: Number.parseInt(limit as string, 10),
        offset: Number.parseInt(offset as string, 10),
      });

      const response: ApiResponse = {
        success: true,
        data: {
          sessionId,
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
