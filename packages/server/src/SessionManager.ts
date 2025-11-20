import { randomUUID } from 'node:crypto';
import type { CacheAdapter, WukongAgent } from '@wukong/agent';
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
  private cacheAdapter?: CacheAdapter;

  constructor(
    private agentConfig: WukongServerConfig['agent'],
    private config: Required<WukongServerConfig>['session'],
    cacheAdapter?: CacheAdapter,
  ) {
    this.cacheAdapter = cacheAdapter;
  }

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
        await this.destroy(oldestSessionId);
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

    // Persist session if enabled
    await this.persistSession(sessionId);

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
  async updateStatus(sessionId: string, status: SessionInfo['status']): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.info.status = status;
      session.info.lastActivityAt = new Date();
      // Persist updated session
      await this.persistSession(sessionId);
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
  async destroy(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Remove from persistent storage
    await this.unpersistSession(sessionId);

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
  private async cleanup(): Promise<void> {
    const now = Date.now();
    const staleSessionIds: string[] = [];
    const timeout = this.config.timeout ?? 30 * 60 * 1000;

    for (const [sessionId, { info }] of this.sessions) {
      const timeSinceActivity = now - info.lastActivityAt.getTime();
      if (timeSinceActivity > timeout) {
        staleSessionIds.push(sessionId);
      }
    }

    // Clean up stale sessions in parallel
    await Promise.all(staleSessionIds.map((sessionId) => this.destroy(sessionId)));
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

  /**
   * Save session metadata to persistent storage
   */
  private async persistSession(sessionId: string): Promise<void> {
    if (!(this.config.persist && this.cacheAdapter)) {
      return;
    }

    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    // Store session info with 7-day TTL (longer than typical session timeout)
    const cacheKey = `wukong:server:session:${sessionId}`;
    await this.cacheAdapter.set(cacheKey, session.info, {
      ttl: 7 * 24 * 60 * 60, // 7 days
    });

    // Store user-to-sessions mapping
    const userSessionsKey = `wukong:server:user:sessions:${session.info.userId}`;
    const existingSessions = await this.cacheAdapter.get<string[]>(userSessionsKey);
    const sessionIds = existingSessions ? [...existingSessions, sessionId] : [sessionId];
    await this.cacheAdapter.set(userSessionsKey, [...new Set(sessionIds)], {
      ttl: 7 * 24 * 60 * 60,
    });
  }

  /**
   * Remove session from persistent storage
   */
  private async unpersistSession(sessionId: string): Promise<void> {
    if (!(this.config.persist && this.cacheAdapter)) {
      return;
    }

    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    // Remove session
    const cacheKey = `wukong:server:session:${sessionId}`;
    await this.cacheAdapter.delete(cacheKey);

    // Update user-to-sessions mapping
    const userSessionsKey = `wukong:server:user:sessions:${session.info.userId}`;
    const existingSessions = await this.cacheAdapter.get<string[]>(userSessionsKey);
    if (existingSessions) {
      const updated = existingSessions.filter((id) => id !== sessionId);
      if (updated.length > 0) {
        await this.cacheAdapter.set(userSessionsKey, updated, {
          ttl: 7 * 24 * 60 * 60,
        });
      } else {
        await this.cacheAdapter.delete(userSessionsKey);
      }
    }
  }

  /**
   * Restore sessions from persistent storage
   * This is called on server startup to restore sessions from previous runs
   */
  async restoreSessions(): Promise<number> {
    if (!(this.config.persist && this.cacheAdapter)) {
      return 0;
    }

    let restoredCount = 0;

    try {
      // Find all persisted session keys
      const sessionKeys = await this.cacheAdapter.keys('wukong:server:session:*');

      for (const key of sessionKeys) {
        try {
          const sessionInfo = await this.cacheAdapter.get<SessionInfo>(key);
          if (!sessionInfo) {
            continue;
          }

          // Check if session is still valid (not timed out)
          const timeSinceActivity = Date.now() - new Date(sessionInfo.lastActivityAt).getTime();
          const timeout = this.config.timeout ?? 30 * 60 * 1000;
          if (timeSinceActivity > timeout) {
            // Session is stale, remove it
            await this.cacheAdapter.delete(key);
            continue;
          }

          // Recreate the agent instance
          const agent = await this.createAgent();

          // Restore session to memory
          this.sessions.set(sessionInfo.id, {
            info: {
              ...sessionInfo,
              // Convert date strings back to Date objects
              createdAt: new Date(sessionInfo.createdAt),
              lastActivityAt: new Date(sessionInfo.lastActivityAt),
              status: 'idle', // Reset status to idle on restore
            },
            agent,
          });

          // Restore user sessions mapping
          if (!this.userSessions.has(sessionInfo.userId)) {
            this.userSessions.set(sessionInfo.userId, new Set());
          }
          this.userSessions.get(sessionInfo.userId)?.add(sessionInfo.id);

          restoredCount++;
        } catch (error) {
          // Log error but continue with other sessions
          console.error(`Failed to restore session from ${key}:`, error);
        }
      }
    } catch (error) {
      console.error('Failed to restore sessions:', error);
    }

    return restoredCount;
  }

  /**
   * Get statistics about sessions
   */
  getStats(): {
    totalSessions: number;
    totalUsers: number;
    sessionsByStatus: Record<SessionInfo['status'], number>;
  } {
    const stats = {
      totalSessions: this.sessions.size,
      totalUsers: this.userSessions.size,
      sessionsByStatus: {
        idle: 0,
        running: 0,
        paused: 0,
        completed: 0,
        error: 0,
      } as Record<SessionInfo['status'], number>,
    };

    for (const { info } of this.sessions.values()) {
      stats.sessionsByStatus[info.status]++;
    }

    return stats;
  }
}
