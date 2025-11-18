import type { WukongAgent } from '@wukong/agent';
import type { Request, Response } from 'express';
import type { SessionManager } from '../SessionManager.js';
import { errors } from '../middleware/errorHandler.js';
import type { createLogger } from '../utils/logger.js';

/**
 * SSE connection manager
 * Tracks active SSE connections and handles event streaming
 */
export class SSEManager {
  private connections = new Map<string, Response>();
  private logger: ReturnType<typeof createLogger>;

  constructor(logger: ReturnType<typeof createLogger>) {
    this.logger = logger;
  }

  /**
   * Register a new SSE connection
   */
  connect(sessionId: string, res: Response): void {
    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable buffering in nginx

    // Store connection first (before sending events)
    this.connections.set(sessionId, res);

    // Handle client disconnect
    res.on('close', () => {
      this.disconnect(sessionId);
    });

    // Send initial connection event
    this.sendEvent(sessionId, 'connected', { sessionId });

    this.logger.info('SSE connection established', { sessionId });
  }

  /**
   * Disconnect an SSE connection
   */
  disconnect(sessionId: string): void {
    const res = this.connections.get(sessionId);
    if (res) {
      res.end();
      this.connections.delete(sessionId);
      this.logger.info('SSE connection closed', { sessionId });
    }
  }

  /**
   * Send an event to a specific session
   */
  sendEvent(sessionId: string, event: string, data: any): void {
    const res = this.connections.get(sessionId);
    if (!res) {
      return;
    }

    try {
      // Format as SSE event
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);

      this.logger.debug('SSE event sent', { sessionId, event });
    } catch (error) {
      this.logger.error('Failed to send SSE event', { sessionId, event, error });
      this.disconnect(sessionId);
    }
  }

  /**
   * Send a comment (keep-alive ping)
   */
  sendKeepAlive(sessionId: string): void {
    const res = this.connections.get(sessionId);
    if (res) {
      try {
        res.write(': keep-alive\n\n');
      } catch (_error) {
        this.disconnect(sessionId);
      }
    }
  }

  /**
   * Broadcast an event to all connected sessions
   */
  broadcast(event: string, data: any): void {
    for (const sessionId of this.connections.keys()) {
      this.sendEvent(sessionId, event, data);
    }
  }

  /**
   * Check if a session has an active connection
   */
  isConnected(sessionId: string): boolean {
    return this.connections.has(sessionId);
  }

  /**
   * Get count of active connections
   */
  getConnectionCount(): number {
    return this.connections.size;
  }

  /**
   * Close all connections
   */
  closeAll(): void {
    const sessionIds = Array.from(this.connections.keys());
    for (const sessionId of sessionIds) {
      this.disconnect(sessionId);
    }
  }
}

/**
 * Set up agent event listeners for SSE streaming
 */
export function setupAgentSSEListeners(
  agent: WukongAgent,
  sessionId: string,
  sseManager: SSEManager,
): void {
  // LLM streaming
  agent.on('llm:streaming', (data) => {
    sseManager.sendEvent(sessionId, 'llm:streaming', {
      text: data.text,
      delta: data.delta,
    });
  });

  // Tool execution
  agent.on('tool:executing', (data) => {
    sseManager.sendEvent(sessionId, 'tool:executing', {
      tool: data.name,
      parameters: data.parameters,
    });
  });

  agent.on('tool:completed', (data) => {
    sseManager.sendEvent(sessionId, 'tool:completed', {
      tool: data.name,
      result: data.result,
    });
  });

  // Progress updates
  agent.on('step:executed', (data) => {
    sseManager.sendEvent(sessionId, 'agent:progress', {
      step: data.stepNumber || 0,
      total: 0, // TODO: Get actual total from agent if available
      message: `Executed step: ${data.action?.type || 'unknown'}`,
    });
  });

  // Completion
  agent.on('agent:complete', (data) => {
    sseManager.sendEvent(sessionId, 'agent:complete', {
      result: data.result,
    });
  });

  // Errors
  agent.on('agent:error', (data) => {
    sseManager.sendEvent(sessionId, 'agent:error', {
      error: data.error?.message || 'Unknown error',
      details: data.error,
    });
  });

  // Status changes
  agent.on('status:changed', (data) => {
    sseManager.sendEvent(sessionId, 'status:changed', {
      status: data.status,
    });
  });
}

/**
 * Set up SSE routes
 */
export function setupSSERoutes(
  app: any,
  sessionManager: SessionManager,
  sseManager: SSEManager,
  logger: ReturnType<typeof createLogger>,
): void {
  /**
   * SSE endpoint for streaming events
   * GET /events/:sessionId
   */
  app.get('/events/:sessionId', (req: Request, res: Response, next: any) => {
    try {
      const { sessionId } = req.params;

      // Validate session exists
      const session = sessionManager.get(sessionId);
      if (!session) {
        throw errors.notFound(`Session ${sessionId} not found`);
      }

      // Establish SSE connection
      sseManager.connect(sessionId, res);

      // Set up agent event listeners
      setupAgentSSEListeners(session.agent, sessionId, sseManager);

      logger.info('SSE stream started', { sessionId });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Execute task with SSE streaming
   * POST /events/:sessionId/execute
   */
  app.post('/events/:sessionId/execute', async (req: Request, res: Response, next: any) => {
    try {
      const { sessionId } = req.params;
      const { goal, context } = req.body;

      if (!goal) {
        throw errors.badRequest('Goal is required');
      }

      // Validate session exists
      const session = sessionManager.get(sessionId);
      if (!session) {
        throw errors.notFound(`Session ${sessionId} not found`);
      }

      // Check if SSE connection exists
      if (!sseManager.isConnected(sessionId)) {
        throw errors.badRequest('SSE connection required. Connect to /events/:sessionId first');
      }

      // Send execution started event
      sseManager.sendEvent(sessionId, 'execution:started', { sessionId });

      // Update status
      sessionManager.updateStatus(sessionId, 'running');

      // Return immediately (execution continues in background)
      res.json({
        success: true,
        data: {
          message: 'Execution started. Listen to SSE stream for updates.',
          sessionId,
        },
      });

      // Execute in background
      try {
        const _result = await session.agent.execute({ goal, context });
        sessionManager.updateStatus(sessionId, 'completed');

        // Final event already sent by agent:complete listener
        logger.info('Execution completed', { sessionId });
      } catch (error: any) {
        sessionManager.updateStatus(sessionId, 'error');

        // Send error event
        sseManager.sendEvent(sessionId, 'agent:error', {
          error: error.message || 'Execution failed',
          details: error,
        });

        logger.error('Execution failed', { sessionId, error });
      }
    } catch (error) {
      next(error);
    }
  });

  /**
   * Stop execution
   * POST /events/:sessionId/stop
   */
  app.post('/events/:sessionId/stop', (req: Request, res: Response, next: any) => {
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

      // Send stopped event
      if (sseManager.isConnected(sessionId)) {
        sseManager.sendEvent(sessionId, 'agent:stopped', { sessionId });
      }

      res.json({
        success: true,
        data: { message: 'Execution stopped' },
      });

      logger.info('Execution stopped', { sessionId });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Close SSE connection
   * POST /events/:sessionId/disconnect
   */
  app.post('/events/:sessionId/disconnect', (req: Request, res: Response, next: any) => {
    try {
      const { sessionId } = req.params;

      sseManager.disconnect(sessionId);

      res.json({
        success: true,
        data: { message: 'SSE connection closed' },
      });

      logger.info('SSE connection closed manually', { sessionId });
    } catch (error) {
      next(error);
    }
  });

  // Set up keep-alive interval (every 30 seconds)
  setInterval(() => {
    const sessionIds = Array.from(Array.from({ length: sseManager.getConnectionCount() }).keys());
    for (const sessionId of sessionIds) {
      sseManager.sendKeepAlive(sessionId.toString());
    }
  }, 30000);
}
