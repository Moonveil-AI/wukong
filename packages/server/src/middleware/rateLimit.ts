import type { CacheAdapter } from '@wukong/agent';
import type { NextFunction, Request, Response } from 'express';
import type { AuthenticatedRequest, WukongServerConfig } from '../types.js';
import { createLogger } from '../utils/logger.js';

// Create logger lazily to avoid initialization issues
let logger: ReturnType<typeof createLogger> | null = null;
function getLogger() {
  if (!logger) {
    logger = createLogger({ level: 'error' });
  }
  return logger;
}

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  /** Time window in milliseconds */
  windowMs: number;
  /** Maximum requests per window */
  maxRequests: number;
  /** Maximum tokens per minute */
  maxTokensPerMinute?: number;
  /** Maximum concurrent executions */
  maxConcurrentExecutions?: number;
  /** Key generator function */
  keyGenerator?: (req: Request) => string;
  /** Custom error handler */
  handler?: (req: Request, res: Response) => void;
  /** Skip rate limiting for certain requests */
  skip?: (req: Request) => boolean;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Required<
  Omit<RateLimitConfig, 'maxTokensPerMinute' | 'keyGenerator' | 'handler' | 'skip'>
> = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 60,
  maxConcurrentExecutions: 3,
};

/**
 * Rate limiter using sliding window algorithm
 */
export class RateLimiter {
  private config: RateLimitConfig;
  private cacheAdapter?: CacheAdapter;

  constructor(config: Partial<RateLimitConfig>, cacheAdapter?: CacheAdapter) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };
    this.cacheAdapter = cacheAdapter;
  }

  /**
   * Get the key for rate limiting
   */
  private getKey(req: Request, type: 'requests' | 'tokens' | 'concurrent'): string {
    const baseKey = this.config.keyGenerator
      ? this.config.keyGenerator(req)
      : this.getDefaultKey(req);
    return `ratelimit:${type}:${baseKey}`;
  }

  /**
   * Default key generator (IP or user-based)
   */
  private getDefaultKey(req: Request): string {
    const authReq = req as AuthenticatedRequest;
    // Use user ID if authenticated, otherwise use IP
    if (authReq.user?.id) {
      return `user:${authReq.user.id}`;
    }
    // Get IP address from various sources
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      (req.headers['x-real-ip'] as string) ||
      req.socket.remoteAddress ||
      'unknown';
    return `ip:${ip}`;
  }

  /**
   * Check if request should be rate limited
   */
  private shouldSkip(req: Request): boolean {
    return this.config.skip ? this.config.skip(req) : false;
  }

  /**
   * Increment request counter using sliding window
   */
  private async checkRequestLimit(
    req: Request,
  ): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
    if (!this.cacheAdapter) {
      // No cache adapter, allow all requests
      return {
        allowed: true,
        remaining: this.config.maxRequests,
        resetAt: new Date(Date.now() + this.config.windowMs),
      };
    }

    const key = this.getKey(req, 'requests');
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    try {
      // Get current count
      const data = await this.cacheAdapter.get<{ requests: number[] }>(key);
      let requests = data?.requests || [];

      // Remove requests outside the window
      requests = requests.filter((timestamp) => timestamp > windowStart);

      // Check if limit exceeded
      if (requests.length >= this.config.maxRequests) {
        const oldestRequest = requests[0] || now;
        const resetAt = new Date(oldestRequest + this.config.windowMs);
        return { allowed: false, remaining: 0, resetAt };
      }

      // Add current request
      requests.push(now);

      // Save updated list
      await this.cacheAdapter.set(
        key,
        { requests },
        { ttl: Math.ceil(this.config.windowMs / 1000) + 1 }, // Add 1 second buffer
      );

      const remaining = this.config.maxRequests - requests.length;
      const resetAt = new Date(now + this.config.windowMs);

      return { allowed: true, remaining, resetAt };
    } catch (error) {
      getLogger().error('Error checking request limit:', {
        error: error instanceof Error ? error.message : String(error),
      });
      // On error, allow the request
      return {
        allowed: true,
        remaining: this.config.maxRequests,
        resetAt: new Date(Date.now() + this.config.windowMs),
      };
    }
  }

  /**
   * Check token usage limit
   */
  async checkTokenLimit(
    req: Request,
    tokensUsed: number,
  ): Promise<{ allowed: boolean; remaining: number }> {
    if (!(this.config.maxTokensPerMinute && this.cacheAdapter)) {
      return { allowed: true, remaining: this.config.maxTokensPerMinute || 0 };
    }

    const key = this.getKey(req, 'tokens');
    const now = Date.now();
    const windowStart = now - 60 * 1000; // 1 minute window

    try {
      // Get current usage
      const data = await this.cacheAdapter.get<{
        usage: Array<{ timestamp: number; tokens: number }>;
      }>(key);
      let usage = data?.usage || [];

      // Remove usage outside the window
      usage = usage.filter((entry) => entry.timestamp > windowStart);

      // Calculate total tokens in window
      const totalTokens = usage.reduce((sum, entry) => sum + entry.tokens, 0);

      // Check if adding new tokens would exceed limit
      if (totalTokens + tokensUsed > this.config.maxTokensPerMinute) {
        return {
          allowed: false,
          remaining: Math.max(0, this.config.maxTokensPerMinute - totalTokens),
        };
      }

      // Add current usage
      usage.push({ timestamp: now, tokens: tokensUsed });

      // Save updated usage
      await this.cacheAdapter.set(key, { usage }, { ttl: 61 }); // 61 seconds

      const remaining = this.config.maxTokensPerMinute - (totalTokens + tokensUsed);
      return { allowed: true, remaining };
    } catch (error) {
      getLogger().error('Error checking token limit:', {
        error: error instanceof Error ? error.message : String(error),
      });
      return { allowed: true, remaining: this.config.maxTokensPerMinute || 0 };
    }
  }

  /**
   * Check concurrent execution limit
   */
  async checkConcurrentLimit(req: Request): Promise<{ allowed: boolean; current: number }> {
    if (!(this.config.maxConcurrentExecutions && this.cacheAdapter)) {
      return { allowed: true, current: 0 };
    }

    const key = this.getKey(req, 'concurrent');

    try {
      // Get current concurrent count
      const count = (await this.cacheAdapter.get<number>(key)) || 0;

      // Check if limit exceeded
      if (count >= this.config.maxConcurrentExecutions) {
        return { allowed: false, current: count };
      }

      return { allowed: true, current: count };
    } catch (error) {
      getLogger().error('Error checking concurrent limit:', {
        error: error instanceof Error ? error.message : String(error),
      });
      return { allowed: true, current: 0 };
    }
  }

  /**
   * Increment concurrent execution counter
   */
  async incrementConcurrent(req: Request): Promise<void> {
    if (!(this.config.maxConcurrentExecutions && this.cacheAdapter)) {
      return;
    }

    const key = this.getKey(req, 'concurrent');

    try {
      const count = (await this.cacheAdapter.get<number>(key)) || 0;
      await this.cacheAdapter.set(key, count + 1, { ttl: 3600 }); // 1 hour TTL
    } catch (error) {
      getLogger().error('Error incrementing concurrent counter:', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Decrement concurrent execution counter
   */
  async decrementConcurrent(req: Request): Promise<void> {
    if (!(this.config.maxConcurrentExecutions && this.cacheAdapter)) {
      return;
    }

    const key = this.getKey(req, 'concurrent');

    try {
      const count = (await this.cacheAdapter.get<number>(key)) || 0;
      if (count > 0) {
        await this.cacheAdapter.set(key, count - 1, { ttl: 3600 });
      }
    } catch (error) {
      getLogger().error('Error decrementing concurrent counter:', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Express middleware for rate limiting
   */
  middleware() {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      // Skip if configured to skip
      if (this.shouldSkip(req)) {
        next();
        return;
      }

      try {
        // Check request rate limit
        const { allowed, remaining, resetAt } = await this.checkRequestLimit(req);

        // Set rate limit headers
        res.setHeader('X-RateLimit-Limit', this.config.maxRequests.toString());
        res.setHeader('X-RateLimit-Remaining', remaining.toString());
        res.setHeader('X-RateLimit-Reset', resetAt.toISOString());

        if (!allowed) {
          // Rate limit exceeded
          const retryAfter = Math.ceil((resetAt.getTime() - Date.now()) / 1000);
          res.setHeader('Retry-After', retryAfter.toString());

          if (this.config.handler) {
            this.config.handler(req, res);
          } else {
            res.status(429).json({
              success: false,
              error: {
                code: 'RATE_LIMIT_EXCEEDED',
                message: 'Too many requests, please try again later',
                details: {
                  retryAfter,
                  resetAt: resetAt.toISOString(),
                },
              },
            });
          }
          return;
        }

        next();
      } catch (error) {
        getLogger().error('Rate limit middleware error:', {
          error: error instanceof Error ? error.message : String(error),
        });
        // On error, allow the request
        next();
      }
    };
  }
}

/**
 * Create rate limiting middleware
 */
export function createRateLimiter(
  config: WukongServerConfig['rateLimit'],
  cacheAdapter?: CacheAdapter,
): RateLimiter | null {
  if (!config) {
    return null;
  }

  return new RateLimiter(
    {
      windowMs: config.windowMs,
      maxRequests: config.maxRequests,
      maxTokensPerMinute: config.maxTokensPerMinute,
      maxConcurrentExecutions: config.maxConcurrentExecutions,
    },
    cacheAdapter,
  );
}

/**
 * Middleware for concurrent execution limiting
 */
export function concurrentLimitMiddleware(rateLimiter: RateLimiter | null) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!rateLimiter) {
      next();
      return;
    }

    try {
      const { allowed, current } = await rateLimiter.checkConcurrentLimit(req);

      if (!allowed) {
        res.status(429).json({
          success: false,
          error: {
            code: 'CONCURRENT_LIMIT_EXCEEDED',
            message: 'Too many concurrent executions, please wait for one to complete',
            details: {
              current,
              max: (rateLimiter as any).config.maxConcurrentExecutions,
            },
          },
        });
        return;
      }

      // Increment counter
      await rateLimiter.incrementConcurrent(req);

      // Attach cleanup function to response
      const originalSend = res.send;
      res.send = function (data) {
        rateLimiter.decrementConcurrent(req).catch((err) => {
          getLogger().error('Error decrementing concurrent counter:', {
            error: err instanceof Error ? err.message : String(err),
          });
        });
        return originalSend.call(this, data);
      };

      next();
    } catch (error) {
      getLogger().error('Concurrent limit middleware error:', {
        error: error instanceof Error ? error.message : String(error),
      });
      next();
    }
  };
}
