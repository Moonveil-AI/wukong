import { EventEmitter } from 'node:events';
import type { WukongAgent } from '@wukong/agent';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WebSocket, type WebSocketServer } from 'ws';
import { SessionManager } from '../SessionManager.js';
import { createLogger } from '../utils/logger.js';
import { WebSocketManager } from '../websocket/WebSocketManager.js';

// Mock WebSocket client for testing
class MockWebSocket extends EventEmitter {
  readyState = WebSocket.OPEN;
  sent: string[] = [];

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.readyState = WebSocket.CLOSED;
    this.emit('close');
  }

  simulateMessage(message: any): void {
    const buffer = Buffer.from(JSON.stringify(message));
    this.emit('message', buffer);
  }

  simulateError(error: Error): void {
    this.emit('error', error);
  }
}

// Mock Agent for testing
class MockAgent extends EventEmitter {
  async execute({ goal }: { goal: string; context?: any }): Promise<any> {
    // Simulate some events during execution
    this.emit('agent:progress', { step: 1, total: 3, message: 'Starting...' });
    this.emit('tool:executing', { tool: 'test-tool', parameters: {} });
    this.emit('tool:completed', { tool: 'test-tool', result: 'success' });
    this.emit('llm:streaming', { text: 'Thinking', delta: 'Thinking' });
    this.emit('agent:progress', { step: 2, total: 3, message: 'Processing...' });

    return { success: true, result: `Completed: ${goal}` };
  }
}

describe('WebSocketManager', () => {
  let wsServer: WebSocketServer;
  let sessionManager: SessionManager;
  let logger: ReturnType<typeof createLogger>;
  let wsManager: WebSocketManager;
  let mockAgent: MockAgent;

  beforeEach(() => {
    // Create a mock WebSocketServer
    wsServer = new EventEmitter() as any;

    // Create mock logger
    logger = createLogger({ level: 'silent' }); // Use silent to suppress all logs in tests

    // Create mock session manager
    mockAgent = new MockAgent();
    const agentFactory = vi.fn(() => mockAgent as any as WukongAgent);

    sessionManager = new SessionManager(
      { factory: agentFactory },
      {
        timeout: 30 * 60 * 1000,
        maxSessionsPerUser: 5,
        cleanupInterval: 5 * 60 * 1000,
        persist: false,
      },
    );

    // Create WebSocketManager
    wsManager = new WebSocketManager(wsServer as any, sessionManager, logger);
  });

  afterEach(() => {
    wsManager.closeAll();
  });

  describe('Connection Handling', () => {
    it('should handle new WebSocket connections', () => {
      const mockWs = new MockWebSocket();

      // Simulate connection
      wsServer.emit('connection', mockWs, {});

      // Should send connected event
      expect(mockWs.sent.length).toBeGreaterThan(0);
      const connectedMessage = JSON.parse(mockWs.sent[0]);
      expect(connectedMessage.type).toBe('connected');
      expect(connectedMessage.sessionId).toBeDefined();
    });

    it('should handle multiple concurrent connections', () => {
      const mockWs1 = new MockWebSocket();
      const mockWs2 = new MockWebSocket();
      const mockWs3 = new MockWebSocket();

      wsServer.emit('connection', mockWs1, {});
      wsServer.emit('connection', mockWs2, {});
      wsServer.emit('connection', mockWs3, {});

      // All should receive connected events
      expect(mockWs1.sent.length).toBeGreaterThan(0);
      expect(mockWs2.sent.length).toBeGreaterThan(0);
      expect(mockWs3.sent.length).toBeGreaterThan(0);

      // Each should have unique session IDs
      const sessionId1 = JSON.parse(mockWs1.sent[0]).sessionId;
      const sessionId2 = JSON.parse(mockWs2.sent[0]).sessionId;
      const sessionId3 = JSON.parse(mockWs3.sent[0]).sessionId;

      expect(sessionId1).not.toBe(sessionId2);
      expect(sessionId2).not.toBe(sessionId3);
      expect(sessionId1).not.toBe(sessionId3);
    });

    it('should clean up on connection close', () => {
      const mockWs = new MockWebSocket();
      wsServer.emit('connection', mockWs, {});

      const initialSentCount = mockWs.sent.length;

      // Close connection
      mockWs.close();

      // Try to send after close - should not send
      wsServer.emit('connection', new MockWebSocket(), {});

      expect(mockWs.sent.length).toBe(initialSentCount);
    });

    it('should handle connection errors gracefully', () => {
      const mockWs = new MockWebSocket();
      wsServer.emit('connection', mockWs, {});

      // Simulate error
      expect(() => {
        mockWs.simulateError(new Error('Connection error'));
      }).not.toThrow();
    });
  });

  describe('Message Handling', () => {
    it('should handle execute messages', async () => {
      const mockWs = new MockWebSocket();
      wsServer.emit('connection', mockWs, {});

      // Clear connected message
      mockWs.sent = [];

      // Send execute message
      mockWs.simulateMessage({
        type: 'execute',
        goal: 'Test task',
      });

      // Wait for execution to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should receive streaming events and completion
      const messages = mockWs.sent.map((msg) => JSON.parse(msg));

      // Check for various event types
      const hasProgress = messages.some((msg) => msg.type === 'agent:progress');
      const hasToolExecuting = messages.some((msg) => msg.type === 'tool:executing');
      const hasToolCompleted = messages.some((msg) => msg.type === 'tool:completed');
      const hasStreaming = messages.some((msg) => msg.type === 'llm:streaming');
      const hasComplete = messages.some((msg) => msg.type === 'agent:complete');

      expect(hasProgress).toBe(true);
      expect(hasToolExecuting).toBe(true);
      expect(hasToolCompleted).toBe(true);
      expect(hasStreaming).toBe(true);
      expect(hasComplete).toBe(true);
    });

    it('should handle ping messages', () => {
      const mockWs = new MockWebSocket();
      wsServer.emit('connection', mockWs, {});

      mockWs.sent = [];

      // Send ping
      mockWs.simulateMessage({ type: 'ping' });

      // Should receive pong
      const messages = mockWs.sent.map((msg) => JSON.parse(msg));
      expect(messages.some((msg) => msg.type === 'pong')).toBe(true);
    });

    it('should handle stop messages', () => {
      const mockWs = new MockWebSocket();
      wsServer.emit('connection', mockWs, {});

      // Execute first
      mockWs.simulateMessage({
        type: 'execute',
        goal: 'Test task',
      });

      mockWs.sent = [];

      // Send stop
      expect(() => {
        mockWs.simulateMessage({ type: 'stop' });
      }).not.toThrow();
    });

    it('should handle pause messages', () => {
      const mockWs = new MockWebSocket();
      wsServer.emit('connection', mockWs, {});

      mockWs.sent = [];

      expect(() => {
        mockWs.simulateMessage({ type: 'pause' });
      }).not.toThrow();
    });

    it('should handle resume messages', () => {
      const mockWs = new MockWebSocket();
      wsServer.emit('connection', mockWs, {});

      mockWs.sent = [];

      expect(() => {
        mockWs.simulateMessage({ type: 'resume' });
      }).not.toThrow();
    });

    it('should handle feedback messages', () => {
      const mockWs = new MockWebSocket();
      wsServer.emit('connection', mockWs, {});

      mockWs.sent = [];

      expect(() => {
        mockWs.simulateMessage({
          type: 'feedback',
          feedback: { rating: 5, comment: 'Great!' },
        });
      }).not.toThrow();
    });

    it('should handle invalid JSON gracefully', () => {
      const mockWs = new MockWebSocket();
      wsServer.emit('connection', mockWs, {});

      mockWs.sent = [];

      // Emit invalid buffer
      const invalidBuffer = Buffer.from('not json');
      mockWs.emit('message', invalidBuffer);

      // Should send error message
      const messages = mockWs.sent.map((msg) => JSON.parse(msg));
      expect(messages.some((msg) => msg.type === 'agent:error')).toBe(true);
    });

    it('should handle unknown message types', () => {
      const mockWs = new MockWebSocket();
      wsServer.emit('connection', mockWs, {});

      mockWs.sent = [];

      expect(() => {
        mockWs.simulateMessage({ type: 'unknown_type' });
      }).not.toThrow();
    });
  });

  describe('Event Streaming', () => {
    it('should stream agent events to connected clients', async () => {
      const mockWs = new MockWebSocket();
      wsServer.emit('connection', mockWs, {});

      mockWs.sent = [];

      // Execute task
      mockWs.simulateMessage({
        type: 'execute',
        goal: 'Test streaming',
      });

      // Wait for execution
      await new Promise((resolve) => setTimeout(resolve, 100));

      const messages = mockWs.sent.map((msg) => JSON.parse(msg));

      // Check streaming events
      const streamingEvents = messages.filter((msg) => msg.type === 'llm:streaming');
      expect(streamingEvents.length).toBeGreaterThan(0);
      expect(streamingEvents[0].text).toBeDefined();
      expect(streamingEvents[0].delta).toBeDefined();
    });

    it('should stream tool events to connected clients', async () => {
      const mockWs = new MockWebSocket();
      wsServer.emit('connection', mockWs, {});

      mockWs.sent = [];

      mockWs.simulateMessage({
        type: 'execute',
        goal: 'Test tool events',
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      const messages = mockWs.sent.map((msg) => JSON.parse(msg));

      const toolExecuting = messages.filter((msg) => msg.type === 'tool:executing');
      const toolCompleted = messages.filter((msg) => msg.type === 'tool:completed');

      expect(toolExecuting.length).toBeGreaterThan(0);
      expect(toolCompleted.length).toBeGreaterThan(0);
      expect(toolExecuting[0].tool).toBe('test-tool');
      expect(toolCompleted[0].result).toBe('success');
    });

    it('should not send to closed connections', () => {
      const mockWs = new MockWebSocket();
      wsServer.emit('connection', mockWs, {});

      // Close immediately
      mockWs.readyState = WebSocket.CLOSED;
      mockWs.sent = [];

      // Try to execute
      mockWs.simulateMessage({
        type: 'execute',
        goal: 'Test closed connection',
      });

      // Should not crash and should not send
      expect(mockWs.sent.length).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle agent execution errors', async () => {
      const failingAgent = new EventEmitter() as any;
      failingAgent.execute = vi.fn().mockRejectedValue(new Error('Execution failed'));

      const failingAgentFactory = vi.fn(() => failingAgent);
      const failingSessionManager = new SessionManager(
        { factory: failingAgentFactory },
        {
          timeout: 30 * 60 * 1000,
          maxSessionsPerUser: 5,
          cleanupInterval: 5 * 60 * 1000,
          persist: false,
        },
      );

      const failingWsManager = new WebSocketManager(wsServer as any, failingSessionManager, logger);

      const mockWs = new MockWebSocket();
      wsServer.emit('connection', mockWs, {});

      mockWs.sent = [];

      mockWs.simulateMessage({
        type: 'execute',
        goal: 'Failing task',
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      const messages = mockWs.sent.map((msg) => JSON.parse(msg));
      const errorMessage = messages.find((msg) => msg.type === 'agent:error');

      expect(errorMessage).toBeDefined();
      expect(errorMessage?.error).toContain('Execution failed');

      failingWsManager.closeAll();
    });

    it('should send error for invalid message format', () => {
      const mockWs = new MockWebSocket();
      wsServer.emit('connection', mockWs, {});

      mockWs.sent = [];

      // Send invalid JSON
      const invalidBuffer = Buffer.from('{ invalid json');
      mockWs.emit('message', invalidBuffer);

      const messages = mockWs.sent.map((msg) => JSON.parse(msg));
      expect(messages.some((msg) => msg.type === 'agent:error')).toBe(true);
    });
  });

  describe('Connection Management', () => {
    it('should track active connections', () => {
      const mockWs1 = new MockWebSocket();
      const mockWs2 = new MockWebSocket();

      wsServer.emit('connection', mockWs1, {});
      wsServer.emit('connection', mockWs2, {});

      // Both connections should be active
      expect(mockWs1.sent.length).toBeGreaterThan(0);
      expect(mockWs2.sent.length).toBeGreaterThan(0);

      // Close one
      mockWs1.close();

      // Other should still be active
      expect(mockWs2.readyState).toBe(WebSocket.OPEN);
    });

    it('should close all connections', () => {
      const mockWs1 = new MockWebSocket();
      const mockWs2 = new MockWebSocket();
      const mockWs3 = new MockWebSocket();

      wsServer.emit('connection', mockWs1, {});
      wsServer.emit('connection', mockWs2, {});
      wsServer.emit('connection', mockWs3, {});

      // Close all
      wsManager.closeAll();

      // All should be closed
      expect(mockWs1.readyState).toBe(WebSocket.CLOSED);
      expect(mockWs2.readyState).toBe(WebSocket.CLOSED);
      expect(mockWs3.readyState).toBe(WebSocket.CLOSED);
    });

    it('should associate connections with sessions', async () => {
      const mockWs = new MockWebSocket();
      wsServer.emit('connection', mockWs, {});

      mockWs.sent = [];

      // Execute to create session
      mockWs.simulateMessage({
        type: 'execute',
        goal: 'Test session association',
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      // Connection should be associated with a session
      // We verify this by ensuring events are delivered
      const messages = mockWs.sent.map((msg) => JSON.parse(msg));
      expect(messages.length).toBeGreaterThan(0);
    });
  });

  describe('Heartbeat/Ping-Pong', () => {
    it('should respond to ping with pong', () => {
      const mockWs = new MockWebSocket();
      wsServer.emit('connection', mockWs, {});

      mockWs.sent = [];

      // Send ping
      mockWs.simulateMessage({ type: 'ping' });

      // Should receive pong immediately
      const messages = mockWs.sent.map((msg) => JSON.parse(msg));
      const pongMessage = messages.find((msg) => msg.type === 'pong');

      expect(pongMessage).toBeDefined();
    });

    it('should handle multiple pings', () => {
      const mockWs = new MockWebSocket();
      wsServer.emit('connection', mockWs, {});

      mockWs.sent = [];

      // Send multiple pings
      mockWs.simulateMessage({ type: 'ping' });
      mockWs.simulateMessage({ type: 'ping' });
      mockWs.simulateMessage({ type: 'ping' });

      const messages = mockWs.sent.map((msg) => JSON.parse(msg));
      const pongMessages = messages.filter((msg) => msg.type === 'pong');

      expect(pongMessages.length).toBe(3);
    });
  });
});
