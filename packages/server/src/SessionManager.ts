import { randomUUID } from 'node:crypto';
import type { WukongAgent } from '@wukong/agent';
import type { SessionInfo, WukongServerConfig } from './types.js';

/**
 * Manages agent sessions with lifecycle and cleanup
 */
export class SessionManager {
  private sessions = new Map<
    string,
    {
      info: SessionInfo;
      agent: WukongAgent;
    }
  >();

  private userSessions = new Map<string, Set<string>>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(
    private agentConfig: WukongServerConfig['agent'],
    private config: Required<WukongServerConfig>['session'],
  ) {}

  /**
   * Create a new session
   */
  async create(userId: string): Promise<{ sessionId: string; agent: WukongAgent }> {
    // Check concurrent session limit
    const userSessionIds = this.userSessions.get(userId) || new Set();
    const maxSessions = this.config.maxSessionsPerUser ?? 5;
    if (userSessionIds.size >= maxSessions) {
      // Remove oldest session
      const oldestSessionId = Array.from(userSessionIds)[0];
      if (oldestSessionId) {
        this.destroy(oldestSessionId);
      }
    }

    // Create session
    const sessionId = randomUUID();
    const agent = await this.createAgent();

    const info: SessionInfo = {
      id: sessionId,
      userId,
      createdAt: new Date(),
      lastActivityAt: new Date(),
      status: 'idle',
    };

    this.sessions.set(sessionId, { info, agent });

    if (!this.userSessions.has(userId)) {
      this.userSessions.set(userId, new Set());
    }
    this.userSessions.get(userId)?.add(sessionId);

    return { sessionId, agent };
  }

  /**
   * Get a session
   */
  get(sessionId: string): { info: SessionInfo; agent: WukongAgent } | undefined {
    const session = this.sessions.get(sessionId);
    if (session) {
      // Update last activity
      session.info.lastActivityAt = new Date();
    }
    return session;
  }

  /**
   * Update session status
   */
  updateStatus(sessionId: string, status: SessionInfo['status']): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.info.status = status;
      session.info.lastActivityAt = new Date();
    }
  }

  /**
   * Get all active sessions for a user
   */
  getActiveSessions(userId: string): SessionInfo[] {
    const sessionIds = this.userSessions.get(userId) || new Set();
    return Array.from(sessionIds)
      .map((id) => this.sessions.get(id)?.info)
      .filter((info): info is SessionInfo => info !== undefined);
  }

  /**
   * Destroy a session
   */
  destroy(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Remove from user sessions
    const userSessionIds = this.userSessions.get(session.info.userId);
    if (userSessionIds) {
      userSessionIds.delete(sessionId);
      if (userSessionIds.size === 0) {
        this.userSessions.delete(session.info.userId);
      }
    }

    // Remove session
    this.sessions.delete(sessionId);
  }

  /**
   * Start automatic cleanup of stale sessions
   */
  startCleanup(): void {
    if (this.cleanupInterval) return;

    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  /**
   * Stop automatic cleanup
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Clean up stale sessions
   */
  private cleanup(): void {
    const now = Date.now();
    const staleSessionIds: string[] = [];
    const timeout = this.config.timeout ?? 30 * 60 * 1000;

    for (const [sessionId, { info }] of this.sessions) {
      const timeSinceActivity = now - info.lastActivityAt.getTime();
      if (timeSinceActivity > timeout) {
        staleSessionIds.push(sessionId);
      }
    }

    for (const sessionId of staleSessionIds) {
      this.destroy(sessionId);
    }
  }

  /**
   * Create an agent instance
   */
  private async createAgent(): Promise<WukongAgent> {
    if (this.agentConfig.instance) {
      return this.agentConfig.instance;
    }

    if (this.agentConfig.factory) {
      return await this.agentConfig.factory();
    }

    throw new Error('No agent instance or factory provided');
  }
}
