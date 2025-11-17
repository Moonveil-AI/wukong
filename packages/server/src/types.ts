import type { WukongAgent } from '@wukong/agent';
import type { Request } from 'express';

/**
 * Server configuration options
 */
export interface WukongServerConfig {
  /** Port to run the server on */
  port?: number;

  /** Host to bind to */
  host?: string;

  /** Agent configuration */
  agent: {
    /** Agent instance or factory function */
    instance?: WukongAgent;
    factory?: () => WukongAgent | Promise<WukongAgent>;
  };

  /** CORS configuration */
  cors?: {
    /** Allowed origins */
    origin?: string | string[] | boolean;
    /** Allow credentials */
    credentials?: boolean;
  };

  /** Authentication configuration */
  auth?: {
    /** Enable authentication */
    enabled: boolean;
    /** Authentication type */
    type: 'apikey' | 'jwt' | 'custom';
    /** API keys for apikey auth */
    apiKeys?: string[];
    /** JWT secret for jwt auth */
    jwtSecret?: string;
    /** Custom validator function */
    customValidator?: (req: Request) => Promise<User | null>;
  };

  /** Rate limiting configuration */
  rateLimit?: {
    /** Time window in milliseconds */
    windowMs?: number;
    /** Maximum requests per window */
    maxRequests?: number;
    /** Maximum tokens per minute */
    maxTokensPerMinute?: number;
    /** Maximum concurrent executions */
    maxConcurrentExecutions?: number;
  };

  /** Session management configuration */
  session?: {
    /** Session timeout in milliseconds */
    timeout?: number;
    /** Maximum sessions per user */
    maxSessionsPerUser?: number;
    /** Cleanup interval in milliseconds */
    cleanupInterval?: number;
    /** Persist sessions to storage */
    persist?: boolean;
  };

  /** Logging configuration */
  logging?: {
    /** Log level */
    level?: 'debug' | 'info' | 'warn' | 'error' | 'silent';
    /** Log format */
    format?: 'json' | 'text';
    /** Log destination */
    destination?: string;
  };

  /** Security configuration */
  security?: {
    /** Enforce HTTPS */
    enforceHttps?: boolean;
    /** Enable HSTS */
    hsts?: boolean;
  };

  /** WebSocket configuration */
  websocket?: {
    /** Enable WebSocket support */
    enabled?: boolean;
    /** Path for WebSocket connections */
    path?: string;
  };

  /** Server-Sent Events configuration */
  sse?: {
    /** Enable SSE support */
    enabled?: boolean;
    /** Path for SSE connections */
    path?: string;
  };
}

/**
 * User information
 */
export interface User {
  id: string;
  email?: string;
  name?: string;
  [key: string]: any;
}

/**
 * API response format
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

/**
 * Session information
 */
export interface SessionInfo {
  id: string;
  userId: string;
  createdAt: Date;
  lastActivityAt: Date;
  status: 'idle' | 'running' | 'paused' | 'completed' | 'error';
}

/**
 * WebSocket message types
 */
export type WebSocketMessage =
  | { type: 'execute'; goal: string; context?: any }
  | { type: 'stop' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'feedback'; feedback: any }
  | { type: 'ping' };

/**
 * WebSocket event types
 */
export type WebSocketEvent =
  | { type: 'connected'; sessionId: string }
  | { type: 'execution:started'; sessionId: string }
  | { type: 'llm:streaming'; text: string; delta: string }
  | { type: 'tool:executing'; tool: string; parameters: any }
  | { type: 'tool:completed'; tool: string; result: any }
  | { type: 'agent:progress'; step: number; total: number; message: string }
  | { type: 'agent:complete'; result: any }
  | { type: 'agent:error'; error: string; details?: any }
  | { type: 'agent:stopped'; sessionId: string }
  | { type: 'agent:paused'; sessionId: string }
  | { type: 'agent:resumed'; sessionId: string }
  | { type: 'feedback:received'; success: boolean }
  | { type: 'pong' };

/**
 * Authenticated request with user info
 */
export interface AuthenticatedRequest extends Request {
  user?: User;
}
