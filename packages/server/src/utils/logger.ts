import type { NextFunction, Request, Response } from 'express';
import type { WukongServerConfig } from '../types.js';

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

interface LogData {
  [key: string]: any;
}

/**
 * Sensitive header patterns to redact in logs
 */
const SENSITIVE_HEADERS = [
  'authorization',
  'cookie',
  'x-api-key',
  'x-auth-token',
  'x-access-token',
];

/**
 * Sanitize sensitive data from objects
 */
function sanitizeData(data: any): any {
  if (!data || typeof data !== 'object') return data;

  const sanitized = { ...data };

  // Redact sensitive headers
  if (sanitized.headers && typeof sanitized.headers === 'object') {
    sanitized.headers = { ...sanitized.headers };
    for (const key of Object.keys(sanitized.headers)) {
      if (SENSITIVE_HEADERS.includes(key.toLowerCase())) {
        sanitized.headers[key] = '[REDACTED]';
      }
    }
  }

  // Redact authorization data
  if (sanitized.authorization) {
    sanitized.authorization = '[REDACTED]';
  }
  if (sanitized.apiKey) {
    sanitized.apiKey = '[REDACTED]';
  }
  if (sanitized.password) {
    sanitized.password = '[REDACTED]';
  }
  if (sanitized.token) {
    sanitized.token = '[REDACTED]';
  }

  return sanitized;
}

/**
 * Simple logger utility
 */
export function createLogger(config: Required<WukongServerConfig>['logging']) {
  const levelPriority: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
    silent: 999, // Silent suppresses all logs
  };

  const currentLevel = levelPriority[config.level ?? 'info'];

  function log(level: LogLevel, message: string, data?: LogData): void {
    if (levelPriority[level] < currentLevel) return;

    const timestamp = new Date().toISOString();
    const sanitizedData = data ? sanitizeData(data) : undefined;
    const logEntry = {
      timestamp,
      level,
      message,
      ...sanitizedData,
    };

    const output =
      config.format === 'json'
        ? JSON.stringify(logEntry)
        : `[${timestamp}] ${level.toUpperCase()}: ${message} ${sanitizedData ? JSON.stringify(sanitizedData) : ''}`;

    // For now, just console output
    // In production, this could write to files, send to logging service, etc.
    const logFn = level === 'error' ? console.error : console.log;
    logFn(output);
  }

  return {
    debug: (message: string, data?: LogData) => log('debug', message, data),
    info: (message: string, data?: LogData) => log('info', message, data),
    warn: (message: string, data?: LogData) => log('warn', message, data),
    error: (message: string, data?: LogData) => log('error', message, data),
  };
}

/**
 * Request logging middleware with performance tracking
 */
export function requestLoggingMiddleware(logger: ReturnType<typeof createLogger>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const startTime = Date.now();
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Attach request ID to request
    (req as any).requestId = requestId;

    // Log request start
    logger.info('Request started', {
      requestId,
      method: req.method,
      path: req.path,
      query: req.query,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    // Intercept response finish to log completion
    const originalSend = res.send;
    res.send = function (body: any): Response {
      const duration = Date.now() - startTime;

      logger.info('Request completed', {
        requestId,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        duration: `${duration}ms`,
      });

      return originalSend.call(this, body);
    };

    next();
  };
}

/**
 * Performance logger for measuring operation duration
 */
export class PerformanceLogger {
  private startTime: number;
  private logger: ReturnType<typeof createLogger>;
  private operation: string;
  private metadata: Record<string, any>;

  constructor(
    logger: ReturnType<typeof createLogger>,
    operation: string,
    metadata?: Record<string, any>,
  ) {
    this.logger = logger;
    this.operation = operation;
    this.metadata = metadata || {};
    this.startTime = Date.now();
  }

  /**
   * End performance measurement and log
   */
  end(additionalData?: Record<string, any>): void {
    const duration = Date.now() - this.startTime;
    this.logger.info(`Performance: ${this.operation}`, {
      operation: this.operation,
      duration: `${duration}ms`,
      ...this.metadata,
      ...additionalData,
    });
  }

  /**
   * End with error
   */
  error(error: Error, additionalData?: Record<string, any>): void {
    const duration = Date.now() - this.startTime;
    this.logger.error(`Performance: ${this.operation} (failed)`, {
      operation: this.operation,
      duration: `${duration}ms`,
      error: error.message,
      ...this.metadata,
      ...additionalData,
    });
  }
}
