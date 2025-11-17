import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, errorHandler, errors } from '../middleware/errorHandler.js';

describe('errorHandler', () => {
  const mockLogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  const mockReq = {
    method: 'GET',
    path: '/test',
  } as any;

  const mockRes = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  } as any;

  const mockNext = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle ApiError correctly', () => {
    const handler = errorHandler(mockLogger);
    const error = new ApiError('Test error', 400, 'TEST_ERROR');

    handler(error, mockReq, mockRes, mockNext);

    expect(mockLogger.error).toHaveBeenCalledWith('Request error', {
      method: 'GET',
      path: '/test',
      error: 'Test error',
      stack: expect.any(String),
    });

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'TEST_ERROR',
        message: 'Test error',
        details: undefined,
      },
    });
  });

  it('should handle generic Error', () => {
    const handler = errorHandler(mockLogger);
    const error = new Error('Generic error');

    handler(error, mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Generic error',
        details: undefined,
      },
    });
  });

  it('should use default status code 500 for unknown errors', () => {
    const handler = errorHandler(mockLogger);
    const error = { message: 'Unknown error' };

    handler(error, mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(500);
  });
});

describe('ApiError', () => {
  it('should create error with all parameters', () => {
    const error = new ApiError('Test message', 404, 'NOT_FOUND');

    expect(error.message).toBe('Test message');
    expect(error.statusCode).toBe(404);
    expect(error.code).toBe('NOT_FOUND');
    expect(error.name).toBe('ApiError');
  });

  it('should use default values', () => {
    const error = new ApiError('Test message');

    expect(error.statusCode).toBe(500);
    expect(error.code).toBe('API_ERROR');
  });

  it('should be instance of Error', () => {
    const error = new ApiError('Test');
    expect(error instanceof Error).toBe(true);
  });
});

describe('error factory functions', () => {
  it('should create badRequest error', () => {
    const error = errors.badRequest('Bad request');
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('BAD_REQUEST');
    expect(error.message).toBe('Bad request');
  });

  it('should create unauthorized error', () => {
    const error = errors.unauthorized();
    expect(error.statusCode).toBe(401);
    expect(error.code).toBe('UNAUTHORIZED');
    expect(error.message).toBe('Unauthorized');
  });

  it('should create forbidden error', () => {
    const error = errors.forbidden();
    expect(error.statusCode).toBe(403);
    expect(error.code).toBe('FORBIDDEN');
  });

  it('should create notFound error', () => {
    const error = errors.notFound('Resource not found');
    expect(error.statusCode).toBe(404);
    expect(error.code).toBe('NOT_FOUND');
  });

  it('should create tooManyRequests error', () => {
    const error = errors.tooManyRequests();
    expect(error.statusCode).toBe(429);
    expect(error.code).toBe('RATE_LIMIT_EXCEEDED');
  });

  it('should create internal error', () => {
    const error = errors.internal();
    expect(error.statusCode).toBe(500);
    expect(error.code).toBe('INTERNAL_ERROR');
  });
});
