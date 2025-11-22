import type React from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export interface Session {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  metadata?: Record<string, any>;
}

interface HistoryContextValue {
  sessions: Session[];
  addSession: (session: Session) => void;
  updateSession: (id: string, updates: Partial<Session>) => void;
  removeSession: (id: string) => void;
  clearHistory: () => void;
}

const HistoryContext = createContext<HistoryContextValue | undefined>(undefined);

export interface HistoryProviderProps {
  children: React.ReactNode;
  maxSessions?: number;
  storageKey?: string;
}

export function HistoryProvider({
  children,
  maxSessions = 10,
  storageKey = 'wukong_history',
}: HistoryProviderProps) {
  const [sessions, setSessions] = useState<Session[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.error('Failed to parse history', e);
        }
      }
    }
    return [];
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(storageKey, JSON.stringify(sessions));
    }
  }, [sessions, storageKey]);

  const addSession = useCallback(
    (session: Session) => {
      setSessions((prev) => {
        const existing = prev.findIndex((s) => s.id === session.id);
        let newSessions: Session[];
        if (existing >= 0) {
          newSessions = [...prev];
          newSessions[existing] = session;
          // Move to top
          newSessions.splice(existing, 1);
          newSessions.unshift(session);
        } else {
          newSessions = [session, ...prev];
        }
        return newSessions.slice(0, maxSessions);
      });
    },
    [maxSessions],
  );

  const updateSession = useCallback((id: string, updates: Partial<Session>) => {
    setSessions((prev) => {
      const idx = prev.findIndex((s) => s.id === id);
      if (idx === -1) return prev;
      const newSessions = [...prev];
      const currentSession = newSessions[idx];
      if (!currentSession) return prev;

      const updatedSession = { ...currentSession, ...updates, updatedAt: Date.now() };
      // Ensure id and title are present if they were somehow undefined in updates
      if (!updatedSession.id) updatedSession.id = currentSession.id;
      if (!updatedSession.title) updatedSession.title = currentSession.title;

      newSessions[idx] = updatedSession as Session;
      return newSessions;
    });
  }, []);

  const removeSession = useCallback((id: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const clearHistory = useCallback(() => {
    setSessions([]);
  }, []);

  const value = useMemo(
    () => ({ sessions, addSession, updateSession, removeSession, clearHistory }),
    [sessions, addSession, updateSession, removeSession, clearHistory],
  );

  return <HistoryContext.Provider value={value}>{children}</HistoryContext.Provider>;
}

export function useGlobalHistory() {
  const context = useContext(HistoryContext);
  if (!context) {
    throw new Error('useGlobalHistory must be used within a HistoryProvider');
  }
  return context;
}
