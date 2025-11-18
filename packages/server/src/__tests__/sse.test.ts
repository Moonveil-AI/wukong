import type { WukongAgent } from '@wukong/agent';
import type { Response } from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SSEManager, setupAgentSSEListeners } from '../routes/sse.js';
import { createLogger } from '../utils/logger.js';

describe('SSEManager', () => {
  let sseManager: SSEManager;
  let mockLogger: ReturnType<typeof createLogger>;

  beforeEach(() => {
    mockLogger = createLogger({ level: 'silent' });
    sseManager = new SSEManager(mockLogger);
  });

  afterEach(() => {
    sseManager.closeAll();
  });

  describe('connect', () => {
    it('should establish SSE connection with proper headers', () => {
      const mockRes = createMockResponse();
      const sessionId = 'test-session-1';

      sseManager.connect(sessionId, mockRes);

      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
      expect(mockRes.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-cache');
      expect(mockRes.setHeader).toHaveBeenCalledWith('Connection', 'keep-alive');
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-Accel-Buffering', 'no');
    });

    it('should send initial connected event', () => {
      const mockRes = createMockResponse();
      const sessionId = 'test-session-1';

      sseManager.connect(sessionId, mockRes);

      expect(mockRes.write).toHaveBeenCalledWith('event: connected\n');
      expect(mockRes.write).toHaveBeenCalledWith(
        expect.stringContaining('"sessionId":"test-session-1"'),
      );
    });

    it('should track active connections', () => {
      const mockRes = createMockResponse();
      const sessionId = 'test-session-1';

      expect(sseManager.isConnected(sessionId)).toBe(false);
      expect(sseManager.getConnectionCount()).toBe(0);

      sseManager.connect(sessionId, mockRes);

      expect(sseManager.isConnected(sessionId)).toBe(true);
      expect(sseManager.getConnectionCount()).toBe(1);
    });

    it('should handle client disconnect', () => {
      const mockRes = createMockResponse();
      const sessionId = 'test-session-1';

      sseManager.connect(sessionId, mockRes);
      expect(sseManager.isConnected(sessionId)).toBe(true);

      // Simulate client disconnect
      const closeHandler = (mockRes.on as any).mock.calls.find(
        (call: any) => call[0] === 'close',
      )?.[1];
      expect(closeHandler).toBeDefined();

      closeHandler?.();

      expect(sseManager.isConnected(sessionId)).toBe(false);
      expect(mockRes.end).toHaveBeenCalled();
    });
  });

  describe('disconnect', () => {
    it('should close connection and remove from tracking', () => {
      const mockRes = createMockResponse();
      const sessionId = 'test-session-1';

      sseManager.connect(sessionId, mockRes);
      expect(sseManager.isConnected(sessionId)).toBe(true);

      sseManager.disconnect(sessionId);

      expect(sseManager.isConnected(sessionId)).toBe(false);
      expect(mockRes.end).toHaveBeenCalled();
    });

    it('should handle disconnecting non-existent session', () => {
      expect(() => {
        sseManager.disconnect('non-existent');
      }).not.toThrow();
    });
  });

  describe('sendEvent', () => {
    it('should send properly formatted SSE event', () => {
      const mockRes = createMockResponse();
      const sessionId = 'test-session-1';

      sseManager.connect(sessionId, mockRes);

      // Clear previous calls from connect
      vi.clearAllMocks();

      const eventData = { message: 'test event', value: 123 };
      sseManager.sendEvent(sessionId, 'test-event', eventData);

      expect(mockRes.write).toHaveBeenCalledWith('event: test-event\n');
      expect(mockRes.write).toHaveBeenCalledWith(`data: ${JSON.stringify(eventData)}\n\n`);
    });

    it('should handle sending event to non-existent session', () => {
      expect(() => {
        sseManager.sendEvent('non-existent', 'test-event', {});
      }).not.toThrow();
    });

    it('should disconnect on write error', () => {
      const mockRes = createMockResponse();
      const sessionId = 'test-session-1';

      sseManager.connect(sessionId, mockRes);
      expect(sseManager.isConnected(sessionId)).toBe(true);

      // Now set up the error-throwing mock after connect
      mockRes.write = vi.fn().mockImplementation(() => {
        throw new Error('Write error');
      });

      sseManager.sendEvent(sessionId, 'test-event', {});

      expect(sseManager.isConnected(sessionId)).toBe(false);
    });
  });

  describe('sendKeepAlive', () => {
    it('should send keep-alive comment', () => {
      const mockRes = createMockResponse();
      const sessionId = 'test-session-1';

      sseManager.connect(sessionId, mockRes);
      vi.clearAllMocks();

      sseManager.sendKeepAlive(sessionId);

      expect(mockRes.write).toHaveBeenCalledWith(': keep-alive\n\n');
    });

    it('should disconnect on keep-alive error', () => {
      const mockRes = createMockResponse();
      const sessionId = 'test-session-1';

      sseManager.connect(sessionId, mockRes);
      expect(sseManager.isConnected(sessionId)).toBe(true);

      // Now set up the error-throwing mock after connect
      mockRes.write = vi.fn().mockImplementation(() => {
        throw new Error('Write error');
      });

      sseManager.sendKeepAlive(sessionId);

      expect(sseManager.isConnected(sessionId)).toBe(false);
    });
  });

  describe('broadcast', () => {
    it('should send event to all connected sessions', () => {
      const mockRes1 = createMockResponse();
      const mockRes2 = createMockResponse();
      const mockRes3 = createMockResponse();

      sseManager.connect('session-1', mockRes1);
      sseManager.connect('session-2', mockRes2);
      sseManager.connect('session-3', mockRes3);

      vi.clearAllMocks();

      const eventData = { message: 'broadcast' };
      sseManager.broadcast('broadcast-event', eventData);

      // Each session should receive the event
      expect(mockRes1.write).toHaveBeenCalled();
      expect(mockRes2.write).toHaveBeenCalled();
      expect(mockRes3.write).toHaveBeenCalled();

      // Verify event format
      expect(mockRes1.write).toHaveBeenCalledWith('event: broadcast-event\n');
      expect(mockRes1.write).toHaveBeenCalledWith(`data: ${JSON.stringify(eventData)}\n\n`);
    });

    it('should handle broadcast with no connections', () => {
      expect(() => {
        sseManager.broadcast('test-event', {});
      }).not.toThrow();
    });
  });

  describe('closeAll', () => {
    it('should close all active connections', () => {
      const mockRes1 = createMockResponse();
      const mockRes2 = createMockResponse();
      const mockRes3 = createMockResponse();

      sseManager.connect('session-1', mockRes1);
      sseManager.connect('session-2', mockRes2);
      sseManager.connect('session-3', mockRes3);

      expect(sseManager.getConnectionCount()).toBe(3);

      sseManager.closeAll();

      expect(sseManager.getConnectionCount()).toBe(0);
      expect(mockRes1.end).toHaveBeenCalled();
      expect(mockRes2.end).toHaveBeenCalled();
      expect(mockRes3.end).toHaveBeenCalled();
    });
  });

  describe('multiple concurrent connections', () => {
    it('should handle multiple sessions simultaneously', () => {
      const sessions = Array.from({ length: 10 }, (_, i) => ({
        id: `session-${i}`,
        res: createMockResponse(),
      }));

      // Connect all sessions
      for (const session of sessions) {
        sseManager.connect(session.id, session.res);
      }

      expect(sseManager.getConnectionCount()).toBe(10);

      // Send events to specific sessions
      sseManager.sendEvent('session-3', 'test-event', { data: 'test' });
      sseManager.sendEvent('session-7', 'test-event', { data: 'test' });

      // Disconnect some sessions
      sseManager.disconnect('session-1');
      sseManager.disconnect('session-5');

      expect(sseManager.getConnectionCount()).toBe(8);

      // Broadcast to remaining sessions
      vi.clearAllMocks();
      sseManager.broadcast('broadcast', {});

      // Only remaining sessions should receive broadcast
      let writeCount = 0;
      for (const session of sessions) {
        if (sseManager.isConnected(session.id)) {
          expect(session.res.write).toHaveBeenCalled();
          writeCount++;
        }
      }
      expect(writeCount).toBe(8);
    });
  });
});

describe('setupAgentSSEListeners', () => {
  let sseManager: SSEManager;
  let mockLogger: ReturnType<typeof createLogger>;
  let mockAgent: Partial<WukongAgent>;
  let eventHandlers: Map<string, (...args: any[]) => void>;

  beforeEach(() => {
    mockLogger = createLogger({ level: 'silent' });
    sseManager = new SSEManager(mockLogger);
    eventHandlers = new Map();

    mockAgent = {
      on: vi.fn((event: string, handler: (...args: any[]) => void) => {
        eventHandlers.set(event, handler);
      }) as any,
    };
  });

  afterEach(() => {
    sseManager.closeAll();
  });

  it('should set up all agent event listeners', () => {
    const sessionId = 'test-session';

    setupAgentSSEListeners(mockAgent as WukongAgent, sessionId, sseManager);

    expect(mockAgent.on).toHaveBeenCalledWith('llm:streaming', expect.any(Function));
    expect(mockAgent.on).toHaveBeenCalledWith('tool:executing', expect.any(Function));
    expect(mockAgent.on).toHaveBeenCalledWith('tool:completed', expect.any(Function));
    expect(mockAgent.on).toHaveBeenCalledWith('step:executed', expect.any(Function));
    expect(mockAgent.on).toHaveBeenCalledWith('agent:complete', expect.any(Function));
    expect(mockAgent.on).toHaveBeenCalledWith('agent:error', expect.any(Function));
    expect(mockAgent.on).toHaveBeenCalledWith('status:changed', expect.any(Function));
  });

  it('should forward llm:streaming events to SSE', () => {
    const mockRes = createMockResponse();
    const sessionId = 'test-session';

    sseManager.connect(sessionId, mockRes);
    setupAgentSSEListeners(mockAgent as WukongAgent, sessionId, sseManager);

    vi.clearAllMocks();

    const handler = eventHandlers.get('llm:streaming');
    handler?.({ text: 'Hello', delta: 'Hello' });

    expect(mockRes.write).toHaveBeenCalledWith('event: llm:streaming\n');
    expect(mockRes.write).toHaveBeenCalledWith(expect.stringContaining('"text":"Hello"'));
  });

  it('should forward tool:executing events to SSE', () => {
    const mockRes = createMockResponse();
    const sessionId = 'test-session';

    sseManager.connect(sessionId, mockRes);
    setupAgentSSEListeners(mockAgent as WukongAgent, sessionId, sseManager);

    vi.clearAllMocks();

    const handler = eventHandlers.get('tool:executing');
    handler?.({ name: 'calculator', parameters: { a: 1, b: 2 } });

    expect(mockRes.write).toHaveBeenCalledWith('event: tool:executing\n');
    expect(mockRes.write).toHaveBeenCalledWith(expect.stringContaining('"tool":"calculator"'));
  });

  it('should forward tool:completed events to SSE', () => {
    const mockRes = createMockResponse();
    const sessionId = 'test-session';

    sseManager.connect(sessionId, mockRes);
    setupAgentSSEListeners(mockAgent as WukongAgent, sessionId, sseManager);

    vi.clearAllMocks();

    const handler = eventHandlers.get('tool:completed');
    handler?.({ name: 'calculator', result: 3 });

    expect(mockRes.write).toHaveBeenCalledWith('event: tool:completed\n');
    expect(mockRes.write).toHaveBeenCalledWith(expect.stringContaining('"tool":"calculator"'));
  });

  it('should forward agent:complete events to SSE', () => {
    const mockRes = createMockResponse();
    const sessionId = 'test-session';

    sseManager.connect(sessionId, mockRes);
    setupAgentSSEListeners(mockAgent as WukongAgent, sessionId, sseManager);

    vi.clearAllMocks();

    const handler = eventHandlers.get('agent:complete');
    handler?.({ result: { success: true } });

    expect(mockRes.write).toHaveBeenCalledWith('event: agent:complete\n');
    expect(mockRes.write).toHaveBeenCalledWith(expect.stringContaining('"success":true'));
  });

  it('should forward agent:error events to SSE', () => {
    const mockRes = createMockResponse();
    const sessionId = 'test-session';

    sseManager.connect(sessionId, mockRes);
    setupAgentSSEListeners(mockAgent as WukongAgent, sessionId, sseManager);

    vi.clearAllMocks();

    const handler = eventHandlers.get('agent:error');
    handler?.({ error: new Error('Test error') });

    expect(mockRes.write).toHaveBeenCalledWith('event: agent:error\n');
    expect(mockRes.write).toHaveBeenCalledWith(expect.stringContaining('"error":"Test error"'));
  });
});

// Helper function to create mock Express Response
function createMockResponse(): Response {
  const mockRes: any = {
    setHeader: vi.fn(),
    write: vi.fn(),
    end: vi.fn(),
    on: vi.fn(),
  };
  return mockRes as Response;
}
