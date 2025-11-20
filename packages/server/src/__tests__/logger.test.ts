import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PerformanceLogger, createLogger, requestLoggingMiddleware } from '../utils/logger.js';

describe('createLogger', () => {
  let consoleLogSpy: any;
  let consoleErrorSpy: any;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {
      // Mock implementation
    });
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {
      // Mock implementation
    });
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('log levels', () => {
    it('should log info level messages', () => {
      const logger = createLogger({ level: 'info', format: 'text' });
      logger.info('Test message');

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('INFO'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Test message'));
    });

    it('should log error level messages', () => {
      const logger = createLogger({ level: 'info', format: 'text' });
      logger.error('Error message');

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('ERROR'));
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Error message'));
    });

    it('should log warn level messages', () => {
      const logger = createLogger({ level: 'warn', format: 'text' });
      logger.warn('Warning message');

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('WARN'));
    });

    it('should log debug level messages when level is debug', () => {
      const logger = createLogger({ level: 'debug', format: 'text' });
      logger.debug('Debug message');

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('DEBUG'));
    });

    it('should not log debug messages when level is info', () => {
      const logger = createLogger({ level: 'info', format: 'text' });
      logger.debug('Debug message');

      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should not log info messages when level is error', () => {
      const logger = createLogger({ level: 'error', format: 'text' });
      logger.info('Info message');

      expect(consoleLogSpy).not.toHaveBeenCalled();
    });
  });

  describe('log formats', () => {
    it('should format as JSON when format is json', () => {
      const logger = createLogger({ level: 'info', format: 'json' });
      logger.info('Test message', { key: 'value' });

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const logOutput = consoleLogSpy.mock.calls[0][0];
      const parsed = JSON.parse(logOutput);

      expect(parsed.level).toBe('info');
      expect(parsed.message).toBe('Test message');
      expect(parsed.key).toBe('value');
      expect(parsed.timestamp).toBeDefined();
    });

    it('should format as text when format is text', () => {
      const logger = createLogger({ level: 'info', format: 'text' });
      logger.info('Test message');

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const logOutput = consoleLogSpy.mock.calls[0][0];

      expect(logOutput).toContain('INFO');
      expect(logOutput).toContain('Test message');
      expect(logOutput).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/); // ISO timestamp
    });
  });

  describe('log data', () => {
    it('should include additional data in JSON format', () => {
      const logger = createLogger({ level: 'info', format: 'json' });
      logger.info('Test', { userId: '123', action: 'test' });

      const logOutput = consoleLogSpy.mock.calls[0][0];
      const parsed = JSON.parse(logOutput);

      expect(parsed.userId).toBe('123');
      expect(parsed.action).toBe('test');
    });

    it('should include additional data in text format', () => {
      const logger = createLogger({ level: 'info', format: 'text' });
      logger.info('Test', { userId: '123' });

      const logOutput = consoleLogSpy.mock.calls[0][0];
      expect(logOutput).toContain('userId');
      expect(logOutput).toContain('123');
    });
  });

  describe('default level', () => {
    it('should use info as default level when level is undefined', () => {
      const logger = createLogger({ level: undefined, format: 'text' });

      logger.debug('Debug');
      expect(consoleLogSpy).not.toHaveBeenCalled();

      logger.info('Info');
      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('sensitive data sanitization', () => {
    it('should redact authorization header', () => {
      const logger = createLogger({ level: 'info', format: 'json' });
      logger.info('Request', {
        headers: {
          authorization: 'Bearer secret-token',
          'content-type': 'application/json',
        },
      });

      const logOutput = consoleLogSpy.mock.calls[0][0];
      const parsed = JSON.parse(logOutput);

      expect(parsed.headers.authorization).toBe('[REDACTED]');
      expect(parsed.headers['content-type']).toBe('application/json');
    });

    it('should redact api key header', () => {
      const logger = createLogger({ level: 'info', format: 'json' });
      logger.info('Request', {
        headers: {
          'x-api-key': 'secret-api-key',
        },
      });

      const logOutput = consoleLogSpy.mock.calls[0][0];
      const parsed = JSON.parse(logOutput);

      expect(parsed.headers['x-api-key']).toBe('[REDACTED]');
    });

    it('should redact password field', () => {
      const logger = createLogger({ level: 'info', format: 'json' });
      logger.info('Login attempt', {
        username: 'user',
        password: 'secret123',
      });

      const logOutput = consoleLogSpy.mock.calls[0][0];
      const parsed = JSON.parse(logOutput);

      expect(parsed.username).toBe('user');
      expect(parsed.password).toBe('[REDACTED]');
    });

    it('should redact token field', () => {
      const logger = createLogger({ level: 'info', format: 'json' });
      logger.info('Auth', {
        token: 'secret-token',
        userId: '123',
      });

      const logOutput = consoleLogSpy.mock.calls[0][0];
      const parsed = JSON.parse(logOutput);

      expect(parsed.token).toBe('[REDACTED]');
      expect(parsed.userId).toBe('123');
    });

    it('should handle data without sensitive fields', () => {
      const logger = createLogger({ level: 'info', format: 'json' });
      logger.info('Regular log', {
        userId: '123',
        action: 'test',
      });

      const logOutput = consoleLogSpy.mock.calls[0][0];
      const parsed = JSON.parse(logOutput);

      expect(parsed.userId).toBe('123');
      expect(parsed.action).toBe('test');
    });
  });
});

describe('requestLoggingMiddleware', () => {
  let consoleLogSpy: any;
  const mockLogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {
      // Mock implementation
    });
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it('should log request start and completion', () => {
    const middleware = requestLoggingMiddleware(mockLogger);
    const mockReq = {
      method: 'GET',
      path: '/test',
      query: { q: 'search' },
      ip: '127.0.0.1',
      get: vi.fn().mockReturnValue('Mozilla/5.0'),
    } as any;

    const mockRes = {
      send: vi.fn().mockReturnThis(),
      statusCode: 200,
    } as any;

    const mockNext = vi.fn();

    middleware(mockReq, mockRes, mockNext);

    // Check request start log
    expect(mockLogger.info).toHaveBeenCalledWith(
      'Request started',
      expect.objectContaining({
        method: 'GET',
        path: '/test',
        query: { q: 'search' },
        ip: '127.0.0.1',
        requestId: expect.stringMatching(/^req_\d+_/),
      }),
    );

    expect(mockNext).toHaveBeenCalled();
    expect(mockReq.requestId).toMatch(/^req_\d+_/);

    // Simulate response
    mockRes.send('response body');

    // Check request completion log
    expect(mockLogger.info).toHaveBeenCalledWith(
      'Request completed',
      expect.objectContaining({
        method: 'GET',
        path: '/test',
        status: 200,
        duration: expect.stringMatching(/^\d+ms$/),
      }),
    );
  });

  it('should generate unique request IDs', () => {
    const middleware = requestLoggingMiddleware(mockLogger);
    const mockReq1 = {
      method: 'GET',
      path: '/test',
      query: {},
      ip: '127.0.0.1',
      get: vi.fn().mockReturnValue('Mozilla/5.0'),
    } as any;

    const mockReq2 = {
      method: 'POST',
      path: '/test',
      query: {},
      ip: '127.0.0.1',
      get: vi.fn().mockReturnValue('Mozilla/5.0'),
    } as any;

    const mockRes = {
      send: vi.fn().mockReturnThis(),
      statusCode: 200,
    } as any;

    const mockNext = vi.fn();

    middleware(mockReq1, mockRes, mockNext);
    middleware(mockReq2, mockRes, mockNext);

    expect(mockReq1.requestId).not.toBe(mockReq2.requestId);
  });
});

describe('PerformanceLogger', () => {
  let consoleLogSpy: any;
  let consoleErrorSpy: any;

  const mockLogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {
      // Mock implementation
    });
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {
      // Mock implementation
    });
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('should measure and log operation duration', async () => {
    const perfLogger = new PerformanceLogger(mockLogger, 'test-operation', { userId: '123' });

    // Simulate some work
    await new Promise((resolve) => setTimeout(resolve, 10));

    perfLogger.end();

    expect(mockLogger.info).toHaveBeenCalledWith(
      'Performance: test-operation',
      expect.objectContaining({
        operation: 'test-operation',
        duration: expect.stringMatching(/^\d+ms$/),
        userId: '123',
      }),
    );
  });

  it('should include additional data on end', async () => {
    const perfLogger = new PerformanceLogger(mockLogger, 'database-query');

    await new Promise((resolve) => setTimeout(resolve, 5));

    perfLogger.end({ rowCount: 42 });

    expect(mockLogger.info).toHaveBeenCalledWith(
      'Performance: database-query',
      expect.objectContaining({
        operation: 'database-query',
        rowCount: 42,
      }),
    );
  });

  it('should log errors with duration', async () => {
    const perfLogger = new PerformanceLogger(mockLogger, 'api-call');

    await new Promise((resolve) => setTimeout(resolve, 5));

    const error = new Error('API failed');
    perfLogger.error(error, { endpoint: '/api/data' });

    expect(mockLogger.error).toHaveBeenCalledWith(
      'Performance: api-call (failed)',
      expect.objectContaining({
        operation: 'api-call',
        error: 'API failed',
        endpoint: '/api/data',
        duration: expect.stringMatching(/^\d+ms$/),
      }),
    );
  });
});
