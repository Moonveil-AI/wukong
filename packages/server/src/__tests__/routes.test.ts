import { EventEmitter } from 'node:events';
import type { WukongAgent } from '@wukong/agent';
import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { SessionManager } from '../SessionManager.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { setupRoutes } from '../routes/index.js';
import type { WukongServerConfig } from '../types.js';
import { createLogger } from '../utils/logger.js';

// Mock WukongAgent
class MockAgent extends EventEmitter {
  async execute(params: { goal: string; context?: any }): Promise<any> {
    // Simulate execution
    this.emit('agent:progress', { step: 1, total: 2, message: 'Starting' });
    this.emit('llm:streaming', { text: 'Thinking...', delta: 'Thinking...' });
    this.emit('tool:executing', { tool: 'calculator', parameters: {} });
    this.emit('tool:completed', { tool: 'calculator', result: { answer: 42 } });
    this.emit('agent:progress', { step: 2, total: 2, message: 'Completing' });

    return {
      goal: params.goal,
      result: 'Task completed',
      output: 'Success',
    };
  }

  async getHistory(_params: { limit?: number; offset?: number }): Promise<any[]> {
    return [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' },
    ];
  }

  getAdapter() {
    return {
      getSession: async (_sessionId: string) => ({
        id: _sessionId,
        goal: 'Test goal',
        initialGoal: 'Test goal',
      }),
    };
  }
}

describe('REST API Routes', () => {
  let app: Express;
  let sessionManager: SessionManager;
  let mockAgent: MockAgent;

  beforeEach(() => {
    // Create mock agent
    mockAgent = new MockAgent();

    // Create session manager
    const config: Required<WukongServerConfig>['session'] = {
      timeout: 30 * 60 * 1000,
      maxSessionsPerUser: 5,
      cleanupInterval: 5 * 60 * 1000,
      persist: false,
    };

    sessionManager = new SessionManager(
      {
        factory: () => Promise.resolve(mockAgent as unknown as WukongAgent),
      },
      config,
    );

    // Create Express app
    app = express();
    app.use(express.json());

    // Set up routes
    const logger = createLogger({ level: 'silent', format: 'json' });
    setupRoutes(app, {
      sessionManager,
      config: {
        port: 3000,
        host: '0.0.0.0',
        agent: { factory: () => Promise.resolve(mockAgent as unknown as WukongAgent) },
        cors: { origin: true, credentials: true },
        auth: { enabled: false, type: 'apikey' },
        rateLimit: {
          windowMs: 60000,
          maxRequests: 60,
          maxTokensPerMinute: 100000,
          maxConcurrentExecutions: 3,
        },
        session: config,
        logging: { level: 'silent', format: 'json' },
        security: { enforceHttps: false, hsts: false },
        websocket: { enabled: true, path: '/ws' },
        sse: { enabled: true, path: '/events' },
      },
      logger,
    });

    // Add error handler
    app.use(errorHandler(logger));
  });

  describe('GET /api/health', () => {
    it('should return healthy status', async () => {
      const response = await request(app).get('/api/health').expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          status: 'healthy',
          timestamp: expect.any(String),
        },
      });
    });
  });

  describe('POST /api/sessions', () => {
    it('should create a new session', async () => {
      const response = await request(app)
        .post('/api/sessions')
        .send({ userId: 'test-user' })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          id: expect.any(String),
          userId: 'test-user',
          createdAt: expect.any(String),
          lastActivityAt: expect.any(String),
          status: 'idle',
        },
      });
    });

    it('should create session with anonymous user if no userId provided', async () => {
      const response = await request(app).post('/api/sessions').send({}).expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBeDefined();
      expect(response.body.data.userId).toBe('anonymous');
    });
  });

  describe('GET /api/sessions/:sessionId', () => {
    it('should get session details', async () => {
      // Create session first
      const createResponse = await request(app).post('/api/sessions').send({ userId: 'test-user' });

      const { id: sessionId } = createResponse.body.data;

      // Get session details
      const response = await request(app).get(`/api/sessions/${sessionId}`).expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          id: sessionId,
          userId: 'test-user',
          createdAt: expect.any(String),
          lastActivityAt: expect.any(String),
          status: 'idle',
        },
      });
    });

    it('should return 404 for non-existent session', async () => {
      const response = await request(app).get('/api/sessions/non-existent-session').expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error?.code).toBe('NOT_FOUND');
    });
  });

  describe('GET /api/sessions', () => {
    it('should list sessions for a user', async () => {
      // Create a session
      const createResponse = await request(app).post('/api/sessions').send({ userId: 'test-user' });

      const { id: sessionId } = createResponse.body.data;

      // List sessions
      const response = await request(app)
        .get('/api/sessions')
        .query({ userId: 'test-user' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.sessions).toHaveLength(1);
      expect(response.body.data.sessions[0].id).toBe(sessionId);
    });

    it('should return empty array for user with no sessions', async () => {
      const response = await request(app)
        .get('/api/sessions')
        .query({ userId: 'no-sessions-user' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.sessions).toEqual([]);
    });
  });

  describe('DELETE /api/sessions/:sessionId', () => {
    it('should delete a session', async () => {
      // Create session first
      const createResponse = await request(app).post('/api/sessions').send({ userId: 'test-user' });

      const { id: sessionId } = createResponse.body.data;

      // Delete session
      const response = await request(app).delete(`/api/sessions/${sessionId}`).expect(200);

      expect(response.body).toEqual({
        success: true,
        data: { message: 'Session deleted' },
      });

      // Verify session is deleted
      await request(app).get(`/api/sessions/${sessionId}`).expect(404);
    });
  });

  describe('POST /api/sessions/:sessionId/execute', () => {
    it('should start execution (async mode)', async () => {
      // Create session first
      const createResponse = await request(app).post('/api/sessions').send({ userId: 'test-user' });

      const { id: sessionId } = createResponse.body.data;

      // Execute
      const response = await request(app)
        .post(`/api/sessions/${sessionId}/execute`)
        .send({ goal: 'Calculate 2 + 2' })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          sessionId,
          status: 'running',
          message: 'Execution started. Use SSE or WebSocket for real-time updates.',
        },
      });

      // Wait a bit for background execution
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Check session status
      const statusResponse = await request(app).get(`/api/sessions/${sessionId}`);
      expect(statusResponse.body.data.status).toBe('completed');
    });

    it('should return 400 if goal is missing', async () => {
      // Create session first
      const createResponse = await request(app).post('/api/sessions').send({ userId: 'test-user' });

      const { id: sessionId } = createResponse.body.data;

      // Execute without goal
      const response = await request(app)
        .post(`/api/sessions/${sessionId}/execute`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error?.code).toBe('BAD_REQUEST');
    });

    it('should return 404 for non-existent session', async () => {
      const response = await request(app)
        .post('/api/sessions/non-existent-session/execute')
        .send({ goal: 'test' })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error?.code).toBe('NOT_FOUND');
    });
  });

  describe('POST /api/sessions/:sessionId/execute-stream', () => {
    it('should stream execution events', async () => {
      // Create session first
      const createResponse = await request(app).post('/api/sessions').send({ userId: 'test-user' });

      const { id: sessionId } = createResponse.body.data;

      // Execute with streaming
      const response = await request(app)
        .post(`/api/sessions/${sessionId}/execute-stream`)
        .send({ goal: 'Calculate 2 + 2' })
        .expect(200);

      // Parse NDJSON response
      const events = response.text
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => JSON.parse(line));

      // Verify events
      expect(events.length).toBeGreaterThan(0);
      expect(events[0]).toMatchObject({
        type: 'execution:started',
        data: { sessionId },
      });

      // Should have various event types
      const eventTypes = events.map((e) => e.type);
      expect(eventTypes).toContain('execution:started');
      expect(eventTypes).toContain('agent:complete');
    });

    it('should return 400 if goal is missing', async () => {
      // Create session first
      const createResponse = await request(app).post('/api/sessions').send({ userId: 'test-user' });

      const { id: sessionId } = createResponse.body.data;

      // Execute without goal
      const response = await request(app)
        .post(`/api/sessions/${sessionId}/execute-stream`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error?.code).toBe('BAD_REQUEST');
    });

    it('should return 404 for non-existent session', async () => {
      const response = await request(app)
        .post('/api/sessions/non-existent-session/execute-stream')
        .send({ goal: 'test' })
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/sessions/:sessionId/stop', () => {
    it('should stop execution', async () => {
      // Create session first
      const createResponse = await request(app).post('/api/sessions').send({ userId: 'test-user' });

      const { id: sessionId } = createResponse.body.data;

      // Stop execution
      const response = await request(app).post(`/api/sessions/${sessionId}/stop`).expect(200);

      expect(response.body).toEqual({
        success: true,
        data: { message: 'Execution stopped' },
      });
    });

    it('should return 404 for non-existent session', async () => {
      const response = await request(app)
        .post('/api/sessions/non-existent-session/stop')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error?.code).toBe('NOT_FOUND');
    });
  });

  describe('GET /api/sessions/:sessionId/history', () => {
    it('should get chat history', async () => {
      // Create session first
      const createResponse = await request(app).post('/api/sessions').send({ userId: 'test-user' });

      const { id: sessionId } = createResponse.body.data;

      // Get history
      const response = await request(app).get(`/api/sessions/${sessionId}/history`).expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          sessionId,
          goal: 'Test goal',
          initialGoal: 'Test goal',
          history: expect.any(Array),
          limit: 50,
          offset: 0,
        },
      });

      expect(response.body.data.history).toHaveLength(2);
    });

    it('should support limit and offset parameters', async () => {
      // Create session first
      const createResponse = await request(app).post('/api/sessions').send({ userId: 'test-user' });

      const { id: sessionId } = createResponse.body.data;

      // Get history with custom limit and offset
      const response = await request(app)
        .get(`/api/sessions/${sessionId}/history`)
        .query({ limit: '10', offset: '5' })
        .expect(200);

      expect(response.body.data.limit).toBe(10);
      expect(response.body.data.offset).toBe(5);
    });

    it('should return 404 for non-existent session', async () => {
      const response = await request(app)
        .get('/api/sessions/non-existent-session/history')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error?.code).toBe('NOT_FOUND');
    });
  });

  describe('POST /api/feedback', () => {
    it('should submit feedback', async () => {
      // Create session first
      const createResponse = await request(app).post('/api/sessions').send({ userId: 'test-user' });

      const { id: sessionId } = createResponse.body.data;

      // Submit feedback
      const response = await request(app)
        .post('/api/feedback')
        .send({
          sessionId,
          type: 'positive',
          rating: 5,
          comment: 'Great job!',
          metadata: { helpful: true },
        })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          message: 'Feedback received',
          feedbackId: expect.any(String),
        },
      });
    });

    it('should return 400 if sessionId is missing', async () => {
      const response = await request(app)
        .post('/api/feedback')
        .send({
          type: 'positive',
          comment: 'Great!',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error?.code).toBe('BAD_REQUEST');
    });

    it('should return 400 if type is invalid', async () => {
      // Create session first
      const createResponse = await request(app).post('/api/sessions').send({ userId: 'test-user' });

      const { id: sessionId } = createResponse.body.data;

      const response = await request(app)
        .post('/api/feedback')
        .send({
          sessionId,
          type: 'invalid-type',
          comment: 'Test',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error?.code).toBe('BAD_REQUEST');
    });

    it('should return 404 for non-existent session', async () => {
      const response = await request(app)
        .post('/api/feedback')
        .send({
          sessionId: 'non-existent-session',
          type: 'positive',
          comment: 'Test',
        })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error?.code).toBe('NOT_FOUND');
    });
  });

  describe('GET /api/capabilities', () => {
    it('should return agent capabilities', async () => {
      const response = await request(app).get('/api/capabilities').expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          features: expect.arrayContaining([
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
          ]),
        },
      });
    });
  });
});
