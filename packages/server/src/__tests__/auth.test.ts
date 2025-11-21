import express, { type Request, type Response } from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createAuthMiddleware, generateToken } from '../middleware/auth.js';
import { errorHandler } from '../middleware/errorHandler.js';

describe('Auth Middleware', () => {
  const setupApp = (authConfig: any) => {
    const app = express();
    app.use(createAuthMiddleware(authConfig));
    app.get('/test', (req: Request, res: Response) => {
      res.json({ user: (req as any).user });
    });
    app.use(errorHandler(console as any));
    return app;
  };

  it('should allow requests when auth is disabled', async () => {
    const app = setupApp({ enabled: false, type: 'apikey' });

    const res = await request(app).get('/test');

    expect(res.status).toBe(200);
    expect(res.body.user).toBeUndefined();
  });

  describe('API Key Auth', () => {
    it('should authenticate with valid API key in header', async () => {
      const app = setupApp({
        enabled: true,
        type: 'apikey',
        apiKeys: ['valid-key'],
      });

      const res = await request(app).get('/test').set('X-API-Key', 'valid-key');

      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.id).toBe('apikey-user');
    });

    it('should authenticate with valid API key in Bearer token', async () => {
      const app = setupApp({
        enabled: true,
        type: 'apikey',
        apiKeys: ['valid-key'],
      });

      const res = await request(app).get('/test').set('Authorization', 'Bearer valid-key');

      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();
    });

    it('should reject invalid API key', async () => {
      const app = setupApp({
        enabled: true,
        type: 'apikey',
        apiKeys: ['valid-key'],
      });

      const res = await request(app).get('/test').set('X-API-Key', 'invalid-key');

      expect(res.status).toBe(401);
    });

    it('should reject missing API key', async () => {
      const app = setupApp({
        enabled: true,
        type: 'apikey',
        apiKeys: ['valid-key'],
      });

      const res = await request(app).get('/test');

      expect(res.status).toBe(401);
    });
  });

  describe('JWT Auth', () => {
    const secret = 'test-secret';

    it('should authenticate with valid JWT', async () => {
      const app = setupApp({
        enabled: true,
        type: 'jwt',
        jwtSecret: secret,
      });

      const token = generateToken({ id: 'user1' }, secret);

      const res = await request(app).get('/test').set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.user.id).toBe('user1');
    });

    it('should reject invalid JWT', async () => {
      const app = setupApp({
        enabled: true,
        type: 'jwt',
        jwtSecret: secret,
      });

      const res = await request(app).get('/test').set('Authorization', 'Bearer invalid-token');

      expect(res.status).toBe(401);
    });

    it('should reject missing JWT', async () => {
      const app = setupApp({
        enabled: true,
        type: 'jwt',
        jwtSecret: secret,
      });

      const res = await request(app).get('/test');

      expect(res.status).toBe(401);
    });
  });

  describe('Custom Auth', () => {
    it('should use custom validator', async () => {
      const customValidator = vi.fn().mockResolvedValue({ id: 'custom-user' });
      const app = setupApp({
        enabled: true,
        type: 'custom',
        customValidator,
      });

      const res = await request(app).get('/test');

      expect(res.status).toBe(200);
      expect(res.body.user.id).toBe('custom-user');
      expect(customValidator).toHaveBeenCalled();
    });

    it('should reject if validator returns null', async () => {
      const customValidator = vi.fn().mockResolvedValue(null);
      const app = setupApp({
        enabled: true,
        type: 'custom',
        customValidator,
      });

      const res = await request(app).get('/test');

      expect(res.status).toBe(401);
    });
  });
});
