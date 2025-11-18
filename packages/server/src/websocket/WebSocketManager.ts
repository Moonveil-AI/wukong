import { WebSocket, type WebSocketServer } from 'ws';
import type { SessionManager } from '../SessionManager.js';
import type { WebSocketEvent, WebSocketMessage } from '../types.js';
import type { createLogger } from '../utils/logger.js';

/**
 * Manages WebSocket connections and message routing
 */
export class WebSocketManager {
  private connections = new Map<string, WebSocket>();
  private sessionConnections = new Map<string, Set<string>>();

  constructor(
    private wsServer: WebSocketServer,
    private sessionManager: SessionManager,
    private logger: ReturnType<typeof createLogger>,
  ) {
    this.setupWebSocket();
  }

  /**
   * Set up WebSocket server
   */
  private setupWebSocket(): void {
    this.wsServer.on('connection', (ws: WebSocket, _req) => {
      const connectionId = this.generateConnectionId();
      this.connections.set(connectionId, ws);

      this.logger.info('WebSocket connection opened', { connectionId });

      // Handle messages
      ws.on('message', async (data: Buffer) => {
        try {
          const message: WebSocketMessage = JSON.parse(data.toString());
          await this.handleMessage(connectionId, ws, message);
        } catch (error: any) {
          this.logger.error('WebSocket message error', {
            connectionId,
            error: error.message,
          });
          this.sendError(ws, 'Invalid message format');
        }
      });

      // Handle close
      ws.on('close', () => {
        this.logger.info('WebSocket connection closed', { connectionId });
        this.cleanup(connectionId);
      });

      // Handle errors
      ws.on('error', (error) => {
        this.logger.error('WebSocket error', {
          connectionId,
          error: error.message,
        });
      });

      // Send connected event
      this.sendEvent(ws, {
        type: 'connected',
        sessionId: connectionId,
      });
    });
  }

  /**
   * Handle WebSocket messages
   */
  private async handleMessage(
    connectionId: string,
    ws: WebSocket,
    message: WebSocketMessage,
  ): Promise<void> {
    this.logger.debug('WebSocket message received', {
      connectionId,
      type: message.type,
    });

    switch (message.type) {
      case 'execute': {
        const { goal, context } = message;

        // Create or get session
        const session = await this.sessionManager.create('anonymous');
        const sessionId = session.sessionId;

        // Associate connection with session
        if (!this.sessionConnections.has(sessionId)) {
          this.sessionConnections.set(sessionId, new Set());
        }
        this.sessionConnections.get(sessionId)?.add(connectionId);

        // Set up event listeners for streaming
        this.setupAgentEventListeners(session.agent, ws);

        // Execute
        try {
          this.sessionManager.updateStatus(sessionId, 'running');
          this.sendEvent(ws, {
            type: 'execution:started',
            sessionId,
          });

          const result = await session.agent.execute({ goal, context });

          this.sessionManager.updateStatus(sessionId, 'completed');
          this.sendEvent(ws, {
            type: 'agent:complete',
            result,
          });
        } catch (error: any) {
          this.sessionManager.updateStatus(sessionId, 'error');
          this.logger.error('Agent execution error', {
            sessionId,
            error: error.message,
            stack: error.stack,
          });

          this.sendEvent(ws, {
            type: 'agent:error',
            error: error.message,
            details: {
              name: error.name,
              code: error.code,
              // biome-ignore lint/complexity/useLiteralKeys: TypeScript requires bracket notation for process.env
              stack: process.env['NODE_ENV'] === 'development' ? error.stack : undefined,
            },
          });
        }
        break;
      }

      case 'stop': {
        // Find session for this connection
        for (const [sessionId, connections] of this.sessionConnections) {
          if (connections.has(connectionId)) {
            const session = this.sessionManager.get(sessionId);
            if (session) {
              // TODO: Implement proper stop mechanism
              // The agent doesn't have a public stop() method
              // We need to use the StopController or implement a stop mechanism
              this.sessionManager.updateStatus(sessionId, 'idle');
              this.sendEvent(ws, {
                type: 'agent:stopped',
                sessionId,
              });
            }
            break;
          }
        }
        break;
      }

      case 'pause': {
        // Find session for this connection
        for (const [sessionId, connections] of this.sessionConnections) {
          if (connections.has(connectionId)) {
            const session = this.sessionManager.get(sessionId);
            if (session) {
              this.sessionManager.updateStatus(sessionId, 'paused');
              this.sendEvent(ws, {
                type: 'agent:paused',
                sessionId,
              });
            }
            break;
          }
        }
        break;
      }

      case 'resume': {
        // Find session for this connection
        for (const [sessionId, connections] of this.sessionConnections) {
          if (connections.has(connectionId)) {
            const session = this.sessionManager.get(sessionId);
            if (session) {
              this.sessionManager.updateStatus(sessionId, 'running');
              this.sendEvent(ws, {
                type: 'agent:resumed',
                sessionId,
              });
            }
            break;
          }
        }
        break;
      }

      case 'feedback': {
        // Handle user feedback
        const { feedback } = message;
        this.logger.info('Received user feedback', {
          connectionId,
          feedback,
        });

        // Find session for this connection
        for (const [_sessionId, connections] of this.sessionConnections) {
          if (connections.has(connectionId)) {
            // Store feedback or emit event for processing
            this.sendEvent(ws, {
              type: 'feedback:received',
              success: true,
            });
            break;
          }
        }
        break;
      }

      case 'ping': {
        this.sendEvent(ws, { type: 'pong' });
        break;
      }

      default:
        this.logger.warn('Unknown message type', { type: (message as any).type });
    }
  }

  /**
   * Set up agent event listeners for streaming
   */
  private setupAgentEventListeners(agent: any, ws: WebSocket): void {
    // LLM streaming
    agent.on('llm:streaming', (data: { text: string; delta: string }) => {
      this.sendEvent(ws, {
        type: 'llm:streaming',
        text: data.text,
        delta: data.delta,
      });
    });

    // Tool events
    agent.on('tool:executing', (data: { tool: string; parameters: any }) => {
      this.sendEvent(ws, {
        type: 'tool:executing',
        tool: data.tool,
        parameters: data.parameters,
      });
    });

    agent.on('tool:completed', (data: { tool: string; result: any }) => {
      this.sendEvent(ws, {
        type: 'tool:completed',
        tool: data.tool,
        result: data.result,
      });
    });

    // Progress events
    agent.on('agent:progress', (data: { step: number; total: number; message: string }) => {
      this.sendEvent(ws, {
        type: 'agent:progress',
        step: data.step,
        total: data.total,
        message: data.message,
      });
    });
  }

  /**
   * Send event to WebSocket client
   */
  private sendEvent(ws: WebSocket, event: WebSocketEvent): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(event));
    }
  }

  /**
   * Send error to WebSocket client
   */
  private sendError(ws: WebSocket, error: string, details?: any): void {
    this.sendEvent(ws, {
      type: 'agent:error',
      error,
      details,
    });
  }

  /**
   * Broadcast event to all connections in a session
   */
  broadcastToSession(sessionId: string, event: WebSocketEvent): void {
    const connections = this.sessionConnections.get(sessionId);
    if (!connections) {
      return;
    }

    for (const connectionId of connections) {
      const ws = this.connections.get(connectionId);
      if (ws) {
        this.sendEvent(ws, event);
      }
    }
  }

  /**
   * Clean up connection
   */
  private cleanup(connectionId: string): void {
    this.connections.delete(connectionId);

    // Remove from session connections
    for (const [sessionId, connections] of this.sessionConnections) {
      connections.delete(connectionId);
      if (connections.size === 0) {
        this.sessionConnections.delete(sessionId);
      }
    }
  }

  /**
   * Close all connections
   */
  closeAll(): void {
    for (const ws of this.connections.values()) {
      ws.close();
    }
    this.connections.clear();
    this.sessionConnections.clear();
  }

  /**
   * Generate unique connection ID
   */
  private generateConnectionId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
