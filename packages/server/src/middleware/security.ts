import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import type { WukongServerConfig } from '../types.js';

/**
 * Configure helmet security middleware with customizable options
 */
export function createSecurityMiddleware(config: WukongServerConfig['security']) {
  const helmetConfig: Parameters<typeof helmet>[0] = {
    // Content Security Policy
    contentSecurityPolicy:
      config?.csp !== false
        ? {
            directives: {
              defaultSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'"],
              scriptSrc: ["'self'"],
              imgSrc: ["'self'", 'data:', 'https:'],
              connectSrc: ["'self'"],
              fontSrc: ["'self'"],
              objectSrc: ["'none'"],
              mediaSrc: ["'self'"],
              frameSrc: ["'none'"],
              ...(config?.csp && typeof config.csp === 'object' ? config.csp : {}),
            },
          }
        : false,

    // HTTP Strict Transport Security (HSTS)
    hsts: config?.hsts
      ? {
          maxAge: config.hstsMaxAge ?? 31536000, // 1 year default
          includeSubDomains: config.hstsIncludeSubDomains ?? true,
          preload: config.hstsPreload ?? false,
        }
      : false,

    // X-Frame-Options
    frameguard: {
      action: 'deny',
    },

    // X-Content-Type-Options
    noSniff: true,

    // X-DNS-Prefetch-Control
    dnsPrefetchControl: {
      allow: false,
    },

    // X-Download-Options
    ieNoOpen: true,

    // Referrer-Policy
    referrerPolicy: {
      policy: 'strict-origin-when-cross-origin',
    },
  };

  return helmet(helmetConfig);
}

/**
 * Middleware to enforce HTTPS in production
 */
export function enforceHttps(enforce = true) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!enforce) {
      next();
      return;
    }

    // Check if request is secure
    const isSecure =
      req.secure ||
      req.headers['x-forwarded-proto'] === 'https' ||
      req.headers['x-forwarded-ssl'] === 'on';

    if (!isSecure) {
      res.status(403).json({
        success: false,
        error: {
          code: 'HTTPS_REQUIRED',
          message: 'HTTPS is required for this endpoint',
        },
      });
      return;
    }

    next();
  };
}

/**
 * Middleware to add custom security headers
 */
export function customSecurityHeaders(config?: Record<string, string>) {
  return (_req: Request, res: Response, next: NextFunction): void => {
    if (config) {
      for (const [header, value] of Object.entries(config)) {
        res.setHeader(header, value);
      }
    }
    next();
  };
}
