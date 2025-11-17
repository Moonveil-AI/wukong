import type { NextFunction, Request, Response } from 'express';
import type { ApiResponse } from '../types.js';
import type { createLogger } from '../utils/logger.js';

/**
 * Global error handler middleware
 */
export function errorHandler(logger: ReturnType<typeof createLogger>) {
  return (err: any, req: Request, res: Response, _next: NextFunction): void => {
    // Log error
    logger.error('Request error', {
      method: req.method,
      path: req.path,
      error: err.message,
      stack: err.stack,
    });

    // Determine status code
    const statusCode = err.statusCode || err.status || 500;

    // Determine error code
    const errorCode = err.code || 'INTERNAL_ERROR';

    // Build response
    const response: ApiResponse = {
      success: false,
      error: {
        code: errorCode,
        message: err.message || 'An unexpected error occurred',
        details: process.env.NODE_ENV === 'development' ? err.stack : undefined,
      },
    };

    res.status(statusCode).json(response);
  };
}

/**
 * Custom error class
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode = 500,
    public code = 'API_ERROR',
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
