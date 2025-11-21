import type { NextFunction, Request, Response } from 'express';
import jwt, { type SignOptions } from 'jsonwebtoken';
import type { AuthenticatedRequest, User, WukongServerConfig } from '../types.js';
import { ApiError } from './errorHandler.js';

/**
 * Create authentication middleware based on configuration
 */
export function createAuthMiddleware(config: WukongServerConfig['auth']) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    // 1. Check if auth is enabled
    if (!config?.enabled) {
      return next();
    }

    try {
      let user: User | null = null;

      // 2. Extract token/key from headers
      const authHeader = req.headers.authorization;
      const apiKeyHeader = req.headers['x-api-key'] as string;

      let token = '';
      if (authHeader?.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }

      // 3. Validate based on auth type
      if (config.type === 'apikey') {
        const apiKey = apiKeyHeader || token;

        if (!apiKey) {
          throw new ApiError(
            'Missing API key',
            401,
            'UNAUTHORIZED',
            'Please provide X-API-Key header or Bearer token',
          );
        }

        if (!config.apiKeys?.includes(apiKey)) {
          throw new ApiError('Invalid API key', 401, 'UNAUTHORIZED');
        }

        // Create simple user object for API key auth
        user = {
          id: 'apikey-user',
          name: 'API Key User',
          apiKey: `${apiKey.substring(0, 8)}...`, // redact for safety
        };
      } else if (config.type === 'jwt') {
        if (!token) {
          throw new ApiError(
            'Missing JWT token',
            401,
            'UNAUTHORIZED',
            'Please provide Authorization: Bearer <token>',
          );
        }

        if (!config.jwtSecret) {
          // This is a server configuration error, so 500
          throw new ApiError('JWT secret not configured', 500, 'INTERNAL_ERROR');
        }

        try {
          const decoded = jwt.verify(token, config.jwtSecret) as any;
          user = {
            id: decoded.sub || decoded.id || 'unknown',
            ...decoded,
          };
        } catch (err: any) {
          throw new ApiError('Invalid JWT token', 401, 'UNAUTHORIZED', err.message);
        }
      } else if (config.type === 'custom') {
        if (!config.customValidator) {
          throw new ApiError('Custom validator not configured', 500, 'INTERNAL_ERROR');
        }

        user = await config.customValidator(req);

        if (!user) {
          throw new ApiError('Authentication failed', 401, 'UNAUTHORIZED');
        }
      }

      if (!user) {
        throw new ApiError('Authentication failed', 401, 'UNAUTHORIZED');
      }

      // 4. Attach user to request
      (req as AuthenticatedRequest).user = user;
      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Generate a JWT token for a user
 */
export function generateToken(
  user: User,
  secret: string,
  expiresIn: string | number = '1h',
): string {
  return jwt.sign(user, secret, { expiresIn } as SignOptions);
}
