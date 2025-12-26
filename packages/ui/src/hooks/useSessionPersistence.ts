import { useCallback, useEffect, useState } from 'react';

export type PersistenceStrategy = 'url' | 'localStorage' | 'both';

export interface UseSessionPersistenceOptions {
  /**
   * Query parameter name for session ID in URL
   * @default 'sessionId'
   */
  queryParam?: string;

  /**
   * localStorage key for session ID
   * @default 'wukong-session-id'
   */
  storageKey?: string;

  /**
   * Persistence strategy
   * - 'url': Only persist in URL query string
   * - 'localStorage': Only persist in localStorage
   * - 'both': Persist in both (URL takes priority when reading)
   * @default 'url'
   */
  strategy?: PersistenceStrategy;

  /**
   * Whether to automatically update browser history when session changes
   * @default true
   */
  autoUpdateUrl?: boolean;
}

export interface UseSessionPersistenceResult {
  /**
   * Get the persisted session ID (from URL or localStorage based on strategy)
   */
  getPersistedSessionId: () => string | null;

  /**
   * Persist the session ID (to URL and/or localStorage based on strategy)
   */
  persistSessionId: (sessionId: string) => void;

  /**
   * Clear the persisted session ID
   */
  clearPersistedSessionId: () => void;

  /**
   * Current persisted session ID (reactive)
   */
  persistedSessionId: string | null;

  /**
   * Check if a session ID was found in persistence
   */
  hasPersistedSession: boolean;
}

/**
 * Hook for managing session ID persistence across page refreshes.
 *
 * This hook helps maintain session continuity by persisting the session ID
 * in the URL query string and/or localStorage.
 *
 * @example
 * ```tsx
 * function App() {
 *   const { getPersistedSessionId, persistSessionId } = useSessionPersistence();
 *
 *   useEffect(() => {
 *     const init = async () => {
 *       const existingSessionId = getPersistedSessionId();
 *
 *       if (existingSessionId) {
 *         // Try to restore session
 *         const session = await client.getSession(existingSessionId);
 *         // ... use restored session
 *       } else {
 *         // Create new session
 *         const session = await client.createSession();
 *         persistSessionId(session.id);
 *       }
 *     };
 *     init();
 *   }, []);
 * }
 * ```
 */
export function useSessionPersistence(
  options: UseSessionPersistenceOptions = {},
): UseSessionPersistenceResult {
  const {
    queryParam = 'sessionId',
    storageKey = 'wukong-session-id',
    strategy = 'url',
    autoUpdateUrl = true,
  } = options;

  const [persistedSessionId, setPersistedSessionId] = useState<string | null>(null);

  // Read from URL query string
  const getFromUrl = useCallback((): string | null => {
    if (typeof window === 'undefined') return null;
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(queryParam);
  }, [queryParam]);

  // Read from localStorage
  const getFromStorage = useCallback((): string | null => {
    if (typeof window === 'undefined') return null;
    try {
      return localStorage.getItem(storageKey);
    } catch {
      // localStorage might be unavailable (e.g., private browsing)
      return null;
    }
  }, [storageKey]);

  // Get persisted session ID based on strategy
  const getPersistedSessionId = useCallback((): string | null => {
    switch (strategy) {
      case 'url':
        return getFromUrl();
      case 'localStorage':
        return getFromStorage();
      case 'both':
        // URL takes priority
        return getFromUrl() || getFromStorage();
      default:
        return null;
    }
  }, [strategy, getFromUrl, getFromStorage]);

  // Write to URL query string
  const writeToUrl = useCallback(
    (sessionId: string | null) => {
      if (typeof window === 'undefined' || !autoUpdateUrl) return;

      const url = new URL(window.location.href);
      if (sessionId) {
        url.searchParams.set(queryParam, sessionId);
      } else {
        url.searchParams.delete(queryParam);
      }
      window.history.replaceState({}, '', url.toString());
    },
    [queryParam, autoUpdateUrl],
  );

  // Write to localStorage
  const writeToStorage = useCallback(
    (sessionId: string | null) => {
      if (typeof window === 'undefined') return;
      try {
        if (sessionId) {
          localStorage.setItem(storageKey, sessionId);
        } else {
          localStorage.removeItem(storageKey);
        }
      } catch {
        // localStorage might be unavailable
      }
    },
    [storageKey],
  );

  // Persist session ID based on strategy
  const persistSessionId = useCallback(
    (sessionId: string) => {
      switch (strategy) {
        case 'url':
          writeToUrl(sessionId);
          break;
        case 'localStorage':
          writeToStorage(sessionId);
          break;
        case 'both':
          writeToUrl(sessionId);
          writeToStorage(sessionId);
          break;
      }
      setPersistedSessionId(sessionId);
    },
    [strategy, writeToUrl, writeToStorage],
  );

  // Clear persisted session ID
  const clearPersistedSessionId = useCallback(() => {
    switch (strategy) {
      case 'url':
        writeToUrl(null);
        break;
      case 'localStorage':
        writeToStorage(null);
        break;
      case 'both':
        writeToUrl(null);
        writeToStorage(null);
        break;
    }
    setPersistedSessionId(null);
  }, [strategy, writeToUrl, writeToStorage]);

  // Initialize persisted session ID on mount
  useEffect(() => {
    const sessionId = getPersistedSessionId();
    setPersistedSessionId(sessionId);
  }, [getPersistedSessionId]);

  return {
    getPersistedSessionId,
    persistSessionId,
    clearPersistedSessionId,
    persistedSessionId,
    hasPersistedSession: persistedSessionId !== null,
  };
}
