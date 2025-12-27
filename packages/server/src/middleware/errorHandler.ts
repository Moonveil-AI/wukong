import type { NextFunction, Request, Response } from 'express';
import type { ApiResponse } from '../types.js';
import type { createLogger } from '../utils/logger.js';

/**
 * Generate correlation ID for error tracking
 */
function generateCorrelationId(): string {
  return `err_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}

/**
 * Global error handler middleware
 */
export function errorHandler(logger: ReturnType<typeof createLogger>) {
  return (err: any, req: Request, res: Response, _next: NextFunction): void => {
    // Generate correlation ID for tracing
    const correlationId = generateCorrelationId();
    const requestId = (req as any).requestId;

    // Log error with full context
    logger.error('Request error', {
      correlationId,
      requestId,
      method: req.method,
      path: req.path,
      query: req.query,
      params: req.params,
      error: err.message,
      errorCode: err.code,
      statusCode: err.statusCode || err.status || 500,
      stack: err.stack,
      userId: (req as any).userId, // If auth middleware attaches userId
    });

    // Determine status code
    const statusCode = err.statusCode || err.status || 500;

    // Determine error code
    const errorCode = err.code || 'INTERNAL_ERROR';

    // Categorize error for better monitoring
    const errorCategory = categorizeError(statusCode);
    logger.debug('Error category', { correlationId, category: errorCategory });

    // Build response
    const response: ApiResponse = {
      success: false,
      error: {
        code: errorCode,
        message: err.message || 'An unexpected error occurred',
        correlationId, // Include correlation ID for support
        details: err.details || (process.env['NODE_ENV'] === 'development' ? err.stack : undefined),
      },
    };

    res.status(statusCode).json(response);
  };
}

/**
 * Categorize error for monitoring and alerting
 */
function categorizeError(statusCode: number): string {
  if (statusCode >= 500) return 'server_error';
  if (statusCode >= 400 && statusCode < 500) return 'client_error';
  if (statusCode === 429) return 'rate_limit';
  return 'unknown';
}

/**
 * Custom error class
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode = 500,
    public code = 'API_ERROR',
    public details?: any,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Error factory functions
 */
export const errors = {
  badRequest: (message: string) => new ApiError(message, 400, 'BAD_REQUEST'),
  unauthorized: (message = 'Unauthorized') => new ApiError(message, 401, 'UNAUTHORIZED'),
  forbidden: (message = 'Forbidden') => new ApiError(message, 403, 'FORBIDDEN'),
  notFound: (message: string) => new ApiError(message, 404, 'NOT_FOUND'),
  tooManyRequests: (message = 'Too many requests') =>
    new ApiError(message, 429, 'RATE_LIMIT_EXCEEDED'),
  internal: (message = 'Internal server error') => new ApiError(message, 500, 'INTERNAL_ERROR'),
};

/**
 * Async error wrapper to catch errors in async route handlers
 *
 * @example
 * app.get('/api/data', asyncHandler(async (req, res) => {
 *   const data = await fetchData();
 *   res.json({ success: true, data });
 * }));
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<undefined | Response>,
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
