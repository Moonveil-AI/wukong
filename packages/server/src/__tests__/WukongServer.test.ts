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
});
