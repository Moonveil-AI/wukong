/**
 * API Client for Wukong Backend
 *
 * Provides methods to interact with the Wukong server via:
 * - REST API for session management
 * - WebSocket for real-time bidirectional communication
 * - Server-Sent Events (SSE) for streaming responses
 */

export interface SessionInfo {
  id: string;
  userId: string;
  createdAt: string;
  lastActivityAt: string;
  metadata?: Record<string, any>;
}

export interface ExecuteRequest {
  goal: string;
  maxSteps?: number;
  mode?: 'auto' | 'confirm' | 'manual';
}

export interface ExecuteResponse {
  success: boolean;
  sessionId: string;
  status: 'started' | 'running' | 'completed' | 'failed';
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export interface Capability {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  category?: string;
}

/**
 * Event types from WebSocket/SSE
 */
export type AgentEvent =
  | { type: 'session:created'; session: SessionInfo }
  | { type: 'llm:started'; stepId: number; model: string }
  | { type: 'llm:streaming'; text: string; index: number; isFinal: boolean }
  | { type: 'llm:complete'; stepId: number; response: any }
  | { type: 'step:started'; step: any }
  | { type: 'step:completed'; step: any }
  | { type: 'tool:executing'; sessionId: string; toolName: string; parameters: any }
  | { type: 'tool:completed'; sessionId: string; toolName: string; result: any }
  | { type: 'agent:progress'; sessionId: string; progress: any }
  | { type: 'agent:complete'; sessionId: string; result: any }
  | { type: 'agent:error'; sessionId: string; error: string };

export type EventHandler = (event: AgentEvent) => void;

/**
 * Wukong API Client
 */
export class WukongClient {
  private baseUrl: string;
  private wsUrl: string;
  private ws: WebSocket | null = null;
  private eventSource: EventSource | null = null;
  private eventHandlers: Set<EventHandler> = new Set();

  constructor(baseUrl = 'http://localhost:3001') {
    this.baseUrl = baseUrl;
    this.wsUrl = baseUrl.replace(/^http/, 'ws');
  }

  // ==================== REST API Methods ====================

  /**
   * Create a new session
   */
  async createSession(userId = 'default-user'): Promise<SessionInfo> {
    const response = await fetch(`${this.baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });

    const data: ApiResponse<SessionInfo> = await response.json();

    if (!(data.success && data.data)) {
      throw new Error(data.error?.message || 'Failed to create session');
    }

    return data.data;
  }

  /**
   * Get session details
   */
  async getSession(sessionId: string): Promise<SessionInfo> {
    const response = await fetch(`${this.baseUrl}/api/sessions/${sessionId}`);
    const data: ApiResponse<SessionInfo> = await response.json();

    if (!(data.success && data.data)) {
      throw new Error(data.error?.message || 'Failed to get session');
    }

    return data.data;
  }

  /**
   * List all sessions for a user
   */
  async listSessions(userId: string): Promise<SessionInfo[]> {
    const response = await fetch(`${this.baseUrl}/api/sessions?userId=${userId}`);
    const data: ApiResponse<SessionInfo[]> = await response.json();

    if (!(data.success && data.data)) {
      throw new Error(data.error?.message || 'Failed to list sessions');
    }

    return data.data;
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/sessions/${sessionId}`, {
      method: 'DELETE',
    });

    const data: ApiResponse = await response.json();

    if (!data.success) {
      throw new Error(data.error?.message || 'Failed to delete session');
    }
  }

  /**
   * Execute a task (async - returns immediately)
   */
  async execute(sessionId: string, request: ExecuteRequest): Promise<ExecuteResponse> {
    const response = await fetch(`${this.baseUrl}/api/sessions/${sessionId}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    const data: ApiResponse<ExecuteResponse> = await response.json();

    if (!(data.success && data.data)) {
      throw new Error(data.error?.message || 'Failed to execute task');
    }

    return data.data;
  }

  /**
   * Stop execution
   */
  async stopExecution(sessionId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/sessions/${sessionId}/stop`, {
      method: 'POST',
    });

    const data: ApiResponse = await response.json();

    if (!data.success) {
      throw new Error(data.error?.message || 'Failed to stop execution');
    }
  }

  /**
   * Get chat history
   */
  async getHistory(sessionId: string): Promise<any[]> {
    const response = await fetch(`${this.baseUrl}/api/sessions/${sessionId}/history`);
    const data: ApiResponse<any[]> = await response.json();

    if (!(data.success && data.data)) {
      throw new Error(data.error?.message || 'Failed to get history');
    }

    return data.data;
  }

  /**
   * Get agent capabilities
   */
  async getCapabilities(): Promise<Capability[]> {
    const response = await fetch(`${this.baseUrl}/api/capabilities`);
    const data: ApiResponse<Capability[]> = await response.json();

    if (!(data.success && data.data)) {
      throw new Error(data.error?.message || 'Failed to get capabilities');
    }

    return data.data;
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    const response = await fetch(`${this.baseUrl}/api/health`);
    const data: ApiResponse<{ status: string; timestamp: string }> = await response.json();

    if (!(data.success && data.data)) {
      throw new Error(data.error?.message || 'Health check failed');
    }

    return data.data;
  }

  // ==================== WebSocket Methods ====================

  /**
   * Connect to WebSocket
   */
  connectWebSocket(sessionId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(`${this.wsUrl}/ws`);

        this.ws.onopen = () => {
          // Authenticate with session ID
          this.ws?.send(
            JSON.stringify({
              type: 'auth',
              sessionId,
            }),
          );

          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.notifyHandlers(data);
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          reject(error);
        };

        this.ws.onclose = () => {
          this.ws = null;
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Send message via WebSocket
   */
  sendWebSocketMessage(message: any): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected');
    }

    this.ws.send(JSON.stringify(message));
  }

  /**
   * Execute via WebSocket
   */
  executeViaWebSocket(request: ExecuteRequest): void {
    this.sendWebSocketMessage({
      type: 'execute',
      ...request,
    });
  }

  /**
   * Disconnect WebSocket
   */
  disconnectWebSocket(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  // ==================== Server-Sent Events (SSE) Methods ====================

  /**
   * Connect to SSE stream
   */
  connectSSE(sessionId: string): void {
    if (!sessionId || sessionId === 'undefined') {
      console.error('Cannot connect to SSE: invalid session ID', sessionId);
      throw new Error('Invalid session ID');
    }

    // Disconnect any existing SSE connection first
    this.disconnectSSE();

    this.eventSource = new EventSource(`${this.baseUrl}/events/${sessionId}`);

    // Listen to all event types
    const eventTypes = [
      'session:created',
      'llm:started',
      'llm:streaming',
      'llm:complete',
      'step:started',
      'step:completed',
      'tool:executing',
      'tool:completed',
      'agent:progress',
      'agent:complete',
      'agent:error',
    ];

    for (const eventType of eventTypes) {
      this.eventSource.addEventListener(eventType, (event: any) => {
        try {
          const data = JSON.parse(event.data);
          this.notifyHandlers({ type: eventType, ...data });
        } catch (error) {
          console.error(`Failed to parse SSE event ${eventType}:`, error);
        }
      });
    }

    this.eventSource.onerror = (error) => {
      console.error('SSE error:', error);
      this.disconnectSSE();
    };
  }

  /**
   * Disconnect SSE
   */
  disconnectSSE(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  // ==================== Event Handling ====================

  /**
   * Add event handler
   */
  on(handler: EventHandler): void {
    this.eventHandlers.add(handler);
  }

  /**
   * Remove event handler
   */
  off(handler: EventHandler): void {
    this.eventHandlers.delete(handler);
  }

  /**
   * Notify all handlers
   */
  private notifyHandlers(event: AgentEvent): void {
    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch (error) {
        console.error('Error in event handler:', error);
      }
    }
  }

  /**
   * Cleanup all connections
   */
  disconnect(): void {
    this.disconnectWebSocket();
    this.disconnectSSE();
    this.eventHandlers.clear();
  }
}

/**
 * Create a client instance (no singleton to avoid issues with React StrictMode)
 */
export function getClient(baseUrl?: string): WukongClient {
  return new WukongClient(baseUrl);
}
