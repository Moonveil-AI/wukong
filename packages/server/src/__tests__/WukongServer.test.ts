import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WukongServer } from '../WukongServer.js';

describe('WukongServer', () => {
  let server: WukongServer;

  // Mock agent factory
  const mockAgentFactory = vi.fn(() => {
    return {
      execute: vi.fn().mockResolvedValue({ result: 'success' }),
      on: vi.fn(),
    } as any;
  });

  afterEach(async () => {
    if (server) {
      await server.stop();
    }
  });

  describe('initialization', () => {
    it('should create server with default config', () => {
      server = new WukongServer({
        agent: {
          factory: mockAgentFactory,
        },
        logging: {
          level: 'error', // Suppress logs in tests
        },
      });

      const info = server.getInfo();
      expect(info.port).toBe(3000);
      expect(info.host).toBe('0.0.0.0');
      expect(info.websocket).toBe(true);
      expect(info.sse).toBe(true);
    });

    it('should create server with custom config', () => {
      server = new WukongServer({
        port: 4000,
        host: 'localhost',
        agent: {
          factory: mockAgentFactory,
        },
        websocket: {
          enabled: false,
        },
        logging: {
          level: 'error', // Suppress logs in tests
        },
      });

      const info = server.getInfo();
      expect(info.port).toBe(4000);
      expect(info.host).toBe('localhost');
      expect(info.websocket).toBe(false);
    });
  });

  describe('server lifecycle', () => {
    it('should start and stop server', async () => {
      server = new WukongServer({
        port: 3001, // Use different port to avoid conflicts
        agent: {
          factory: mockAgentFactory,
        },
        logging: {
          level: 'error', // Suppress logs in tests
        },
      });

      await server.start();
      const app = server.getApp();
      expect(app).toBeDefined();

      await server.stop();
    });

    it('should handle multiple start/stop cycles', async () => {
      server = new WukongServer({
        port: 3002,
        agent: {
          factory: mockAgentFactory,
        },
        logging: {
          level: 'error', // Suppress logs in tests
        },
      });

      await server.start();
      await server.stop();

      // Create new server instance for second cycle
      server = new WukongServer({
        port: 3002,
        agent: {
          factory: mockAgentFactory,
        },
        logging: {
          level: 'error', // Suppress logs in tests
        },
      });
      await server.start();
      await server.stop();
    });
  });

  describe('configuration', () => {
    it('should apply logging configuration', () => {
      server = new WukongServer({
        agent: {
          factory: mockAgentFactory,
        },
        logging: {
          level: 'error', // Use error level to suppress logs in tests
          format: 'json',
        },
      });

      expect(server.getInfo()).toBeDefined();
    });

    it('should apply session configuration', () => {
      server = new WukongServer({
        agent: {
          factory: mockAgentFactory,
        },
        session: {
          timeout: 60000,
          maxSessionsPerUser: 10,
        },
        logging: {
          level: 'error', // Suppress logs in tests
        },
      });

      expect(server.getInfo()).toBeDefined();
    });

    it('should apply CORS configuration', () => {
      server = new WukongServer({
        agent: {
          factory: mockAgentFactory,
        },
        cors: {
          origin: 'https://example.com',
          credentials: true,
        },
        logging: {
          level: 'error', // Suppress logs in tests
        },
      });

      expect(server.getInfo()).toBeDefined();
    });
  });

  describe('Express app', () => {
    it('should provide access to Express app instance', () => {
      server = new WukongServer({
        agent: {
          factory: mockAgentFactory,
        },
        logging: {
          level: 'error', // Suppress logs in tests
        },
      });

      const app = server.getApp();
      expect(app).toBeDefined();
      expect(typeof app.use).toBe('function');
      expect(typeof app.get).toBe('function');
      expect(typeof app.post).toBe('function');
    });
  });

  describe('CORS and Security', () => {
    it('should set default security headers', async () => {
      server = new WukongServer({
        port: 3003,
        agent: {
          factory: mockAgentFactory,
        },
        logging: {
          level: 'error',
        },
      });

      await server.start();
      const response = await request(server.getApp()).get('/api/health');

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-dns-prefetch-control']).toBe('off');
    });

    it('should enable HSTS when configured', async () => {
      server = new WukongServer({
        port: 3004,
        agent: {
          factory: mockAgentFactory,
        },
        security: {
          hsts: true,
          hstsMaxAge: 86400,
        },
        logging: {
          level: 'error',
        },
      });

      await server.start();
      const response = await request(server.getApp()).get('/api/health');

      expect(response.headers['strict-transport-security']).toBeDefined();
      expect(response.headers['strict-transport-security']).toContain('max-age=86400');
    });

    it('should set Content-Security-Policy by default', async () => {
      server = new WukongServer({
        port: 3005,
        agent: {
          factory: mockAgentFactory,
        },
        logging: {
          level: 'error',
        },
      });

      await server.start();
      const response = await request(server.getApp()).get('/api/health');

      expect(response.headers['content-security-policy']).toBeDefined();
      expect(response.headers['content-security-policy']).toContain("default-src 'self'");
    });

    it('should allow disabling CSP', async () => {
      server = new WukongServer({
        port: 3006,
        agent: {
          factory: mockAgentFactory,
        },
        security: {
          csp: false,
        },
        logging: {
          level: 'error',
        },
      });

      await server.start();
      const response = await request(server.getApp()).get('/api/health');

      expect(response.headers['content-security-policy']).toBeUndefined();
    });

    it('should support custom security headers', async () => {
      server = new WukongServer({
        port: 3007,
        agent: {
          factory: mockAgentFactory,
        },
        security: {
          customHeaders: {
            'X-API-Version': '1.0',
            'X-Custom-Header': 'custom-value',
          },
        },
        logging: {
          level: 'error',
        },
      });

      await server.start();
      const response = await request(server.getApp()).get('/api/health');

      expect(response.headers['x-api-version']).toBe('1.0');
      expect(response.headers['x-custom-header']).toBe('custom-value');
    });

    it('should set CORS headers', async () => {
      server = new WukongServer({
        port: 3008,
        agent: {
          factory: mockAgentFactory,
        },
        cors: {
          origin: 'https://example.com',
          credentials: true,
        },
        logging: {
          level: 'error',
        },
      });

      await server.start();
      const response = await request(server.getApp())
        .get('/api/health')
        .set('Origin', 'https://example.com');

      expect(response.headers['access-control-allow-origin']).toBe('https://example.com');
      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });

    it('should handle CORS preflight requests', async () => {
      server = new WukongServer({
        port: 3009,
        agent: {
          factory: mockAgentFactory,
        },
        cors: {
          origin: 'https://example.com',
          credentials: true,
          methods: ['GET', 'POST', 'PUT'],
        },
        logging: {
          level: 'error',
        },
      });

      await server.start();
      const response = await request(server.getApp())
        .options('/api/sessions')
        .set('Origin', 'https://example.com')
        .set('Access-Control-Request-Method', 'POST');

      expect(response.status).toBe(204);
      expect(response.headers['access-control-allow-origin']).toBe('https://example.com');
      expect(response.headers['access-control-allow-methods']).toMatch(/POST/);
    });

    it('should block HTTP requests when HTTPS enforcement is enabled', async () => {
      server = new WukongServer({
        port: 3010,
        agent: {
          factory: mockAgentFactory,
        },
        security: {
          enforceHttps: true,
        },
        logging: {
          level: 'error',
        },
      });

      await server.start();
      const response = await request(server.getApp()).get('/api/health');

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('HTTPS_REQUIRED');
    });

    it('should allow HTTPS requests when enforcement is enabled', async () => {
      server = new WukongServer({
        port: 3011,
        agent: {
          factory: mockAgentFactory,
        },
        security: {
          enforceHttps: true,
        },
        logging: {
          level: 'error',
        },
      });

      await server.start();
      const response = await request(server.getApp())
        .get('/api/health')
        .set('X-Forwarded-Proto', 'https');

      expect(response.status).toBe(200);
    });
  });
});
