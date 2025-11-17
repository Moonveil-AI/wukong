import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionManager } from '../SessionManager.js';
import type { WukongServerConfig } from '../types.js';

describe('SessionManager', () => {
  let sessionManager: SessionManager;

  const mockAgentFactory = vi.fn(() => ({
    execute: vi.fn().mockResolvedValue({ result: 'success' }),
    on: vi.fn(),
  }));

  const agentConfig: WukongServerConfig['agent'] = {
    factory: mockAgentFactory as any,
  };

  const sessionConfig = {
    timeout: 30000,
    maxSessionsPerUser: 5,
    cleanupInterval: 5000,
    persist: true,
  };

  beforeEach(() => {
    sessionManager = new SessionManager(agentConfig, sessionConfig);
    mockAgentFactory.mockClear();
  });

  describe('create', () => {
    it('should create a new session', async () => {
      const { sessionId, agent } = await sessionManager.create('user1');

      expect(sessionId).toBeDefined();
      expect(typeof sessionId).toBe('string');
      expect(agent).toBeDefined();
      expect(mockAgentFactory).toHaveBeenCalledTimes(1);
    });

    it('should create multiple sessions for different users', async () => {
      const session1 = await sessionManager.create('user1');
      const session2 = await sessionManager.create('user2');

      expect(session1.sessionId).not.toBe(session2.sessionId);
    });

    it('should enforce max sessions per user', async () => {
      // Create max sessions
      for (let i = 0; i < 5; i++) {
        await sessionManager.create('user1');
      }

      // Creating one more should work (oldest is removed)
      const session = await sessionManager.create('user1');
      expect(session.sessionId).toBeDefined();

      // Should still only have 5 sessions for user1
      const activeSessions = sessionManager.getActiveSessions('user1');
      expect(activeSessions).toHaveLength(5);
    });
  });

  describe('get', () => {
    it('should retrieve an existing session', async () => {
      const { sessionId } = await sessionManager.create('user1');
      const session = sessionManager.get(sessionId);

      expect(session).toBeDefined();
      expect(session?.info.id).toBe(sessionId);
      expect(session?.info.userId).toBe('user1');
    });

    it('should return undefined for non-existent session', () => {
      const session = sessionManager.get('non-existent-id');
      expect(session).toBeUndefined();
    });

    it('should update last activity time when accessed', async () => {
      const { sessionId } = await sessionManager.create('user1');
      const session1 = sessionManager.get(sessionId);
      const firstActivityTime = session1?.info.lastActivityAt.getTime();

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 10));

      const session2 = sessionManager.get(sessionId);
      const secondActivityTime = session2?.info.lastActivityAt.getTime();

      expect(secondActivityTime).toBeGreaterThan(firstActivityTime ?? 0);
    });
  });

  describe('updateStatus', () => {
    it('should update session status', async () => {
      const { sessionId } = await sessionManager.create('user1');

      sessionManager.updateStatus(sessionId, 'running');
      let session = sessionManager.get(sessionId);
      expect(session?.info.status).toBe('running');

      sessionManager.updateStatus(sessionId, 'completed');
      session = sessionManager.get(sessionId);
      expect(session?.info.status).toBe('completed');
    });

    it('should do nothing for non-existent session', () => {
      // Should not throw
      sessionManager.updateStatus('non-existent-id', 'running');
    });
  });

  describe('getActiveSessions', () => {
    it('should return all active sessions for a user', async () => {
      await sessionManager.create('user1');
      await sessionManager.create('user1');
      await sessionManager.create('user2');

      const user1Sessions = sessionManager.getActiveSessions('user1');
      const user2Sessions = sessionManager.getActiveSessions('user2');

      expect(user1Sessions).toHaveLength(2);
      expect(user2Sessions).toHaveLength(1);
    });

    it('should return empty array for user with no sessions', () => {
      const sessions = sessionManager.getActiveSessions('user-no-sessions');
      expect(sessions).toEqual([]);
    });
  });

  describe('destroy', () => {
    it('should remove a session', async () => {
      const { sessionId } = await sessionManager.create('user1');

      sessionManager.destroy(sessionId);

      const session = sessionManager.get(sessionId);
      expect(session).toBeUndefined();
    });

    it('should remove session from user sessions', async () => {
      const { sessionId } = await sessionManager.create('user1');
      await sessionManager.create('user1');

      sessionManager.destroy(sessionId);

      const activeSessions = sessionManager.getActiveSessions('user1');
      expect(activeSessions).toHaveLength(1);
      expect(activeSessions[0].id).not.toBe(sessionId);
    });

    it('should do nothing for non-existent session', () => {
      // Should not throw
      sessionManager.destroy('non-existent-id');
    });
  });

  describe('cleanup', () => {
    it('should start and stop cleanup', () => {
      sessionManager.startCleanup();
      sessionManager.stopCleanup();
      // If no errors, test passes
    });

    it('should not start multiple cleanup intervals', () => {
      sessionManager.startCleanup();
      sessionManager.startCleanup();
      sessionManager.stopCleanup();
      // If no errors, test passes
    });
  });
});
