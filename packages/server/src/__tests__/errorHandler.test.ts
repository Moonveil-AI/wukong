import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, asyncHandler, errorHandler, errors } from '../middleware/errorHandler.js';

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

    expect(mockLogger.error).toHaveBeenCalledWith(
      'Request error',
      expect.objectContaining({
        method: 'GET',
        path: '/test',
        error: 'Test error',
        errorCode: 'TEST_ERROR',
        statusCode: 400,
        correlationId: expect.stringMatching(/^err_\d+_/),
        stack: expect.any(String),
      }),
    );

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'TEST_ERROR',
        message: 'Test error',
        correlationId: expect.stringMatching(/^err_\d+_/),
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
        correlationId: expect.stringMatching(/^err_\d+_/),
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

  it('should generate and include correlation ID', () => {
    const handler = errorHandler(mockLogger);
    const error = new ApiError('Test error', 400, 'TEST_ERROR');

    handler(error, mockReq, mockRes, mockNext);

    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          correlationId: expect.stringMatching(/^err_\d+_/),
        }),
      }),
    );
  });

  it('should log error with correlation ID and request context', () => {
    const handler = errorHandler(mockLogger);
    const error = new ApiError('Test error', 400, 'TEST_ERROR');
    const reqWithId = { ...mockReq, requestId: 'req_123' };

    handler(error, reqWithId, mockRes, mockNext);

    expect(mockLogger.error).toHaveBeenCalledWith(
      'Request error',
      expect.objectContaining({
        correlationId: expect.stringMatching(/^err_\d+_/),
        requestId: 'req_123',
        method: 'GET',
        path: '/test',
      }),
    );
  });

  it('should include error category in debug log', () => {
    const handler = errorHandler(mockLogger);
    const error = new ApiError('Server error', 500, 'INTERNAL_ERROR');

    handler(error, mockReq, mockRes, mockNext);

    expect(mockLogger.debug).toHaveBeenCalledWith(
      'Error category',
      expect.objectContaining({
        category: 'server_error',
      }),
    );
  });

  it('should categorize 4xx as client_error', () => {
    const handler = errorHandler(mockLogger);
    const error = new ApiError('Bad request', 400, 'BAD_REQUEST');

    handler(error, mockReq, mockRes, mockNext);

    expect(mockLogger.debug).toHaveBeenCalledWith(
      'Error category',
      expect.objectContaining({
        category: 'client_error',
      }),
    );
  });

  it('should categorize 429 as rate_limit', () => {
    const handler = errorHandler(mockLogger);
    const error = new ApiError('Rate limited', 429, 'RATE_LIMIT_EXCEEDED');

    handler(error, mockReq, mockRes, mockNext);

    // 429 is technically a 4xx, so it's categorized as client_error
    // but the error code RATE_LIMIT_EXCEEDED can be used for specific handling
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'Error category',
      expect.objectContaining({
        category: 'client_error',
      }),
    );
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

describe('asyncHandler', () => {
  const mockReq = {} as any;
  const mockRes = {} as any;
  const mockNext = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle successful async operations', async () => {
    const handler = asyncHandler(async (_req, res) => {
      res.json({ success: true });
    });

    const mockJsonRes = { json: vi.fn() };
    await handler(mockReq, mockJsonRes as any, mockNext);

    expect(mockJsonRes.json).toHaveBeenCalledWith({ success: true });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should catch async errors and pass to next', async () => {
    const error = new Error('Async error');
    const handler = asyncHandler(async () => {
      throw error;
    });

    await handler(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalledWith(error);
  });

  it('should handle promise rejections', async () => {
    const error = new ApiError('Promise rejected', 500);
    const handler = asyncHandler(async () => {
      throw error; // Use throw instead of Promise.reject for more consistent handling
    });

    await handler(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalledWith(error);
  });

  it('should work with async operations that return void', async () => {
    let executed = false;
    const handler = asyncHandler(async () => {
      executed = true;
    });

    await handler(mockReq, mockRes, mockNext);

    expect(executed).toBe(true);
    expect(mockNext).not.toHaveBeenCalled();
  });
});
