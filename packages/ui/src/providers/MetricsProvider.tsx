import type { TokenUsage, WukongAgent } from '@wukong/agent';
import type React from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { AgentMetrics } from '../hooks/useMetrics';

interface MetricsContextValue {
  metrics: AgentMetrics;
  trackAgent: (agent: WukongAgent) => () => void;
  resetMetrics: () => void;
}

const MetricsContext = createContext<MetricsContextValue | undefined>(undefined);

export interface MetricsProviderProps {
  children: React.ReactNode;
  storageKey?: string;
}

const initialMetrics: AgentMetrics = {
  totalTokens: 0,
  promptTokens: 0,
  completionTokens: 0,
  estimatedCost: 0,
  tokensSaved: 0,
  savings: {
    mcpSavings: 0,
    skillsSavings: 0,
    discardSavings: 0,
    total: 0,
  },
};

export function MetricsProvider({ children, storageKey = 'wukong_metrics' }: MetricsProviderProps) {
  const [metrics, setMetrics] = useState<AgentMetrics>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.error('Failed to parse metrics', e);
        }
      }
    }
    return initialMetrics;
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(storageKey, JSON.stringify(metrics));
    }
  }, [metrics, storageKey]);

  const trackAgent = useCallback((agent: WukongAgent) => {
    const handleTokensUsed = (data: { usage: TokenUsage }) => {
      setMetrics((prev) => ({
        ...prev,
        totalTokens: prev.totalTokens + data.usage.totalTokens,
        promptTokens: prev.promptTokens + data.usage.promptTokens,
        completionTokens: prev.completionTokens + data.usage.completionTokens,
        estimatedCost: prev.estimatedCost + data.usage.estimatedCost,
      }));
    };

    const handleTokensSaved = (data: { amount: number; savedBy: string }) => {
      setMetrics((prev) => ({
        ...prev,
        tokensSaved: prev.tokensSaved + data.amount,
        savings: {
          ...prev.savings,
          total: prev.savings.total + data.amount,
          mcpSavings: prev.savings.mcpSavings + (data.savedBy === 'mcp' ? data.amount : 0),
          skillsSavings: prev.savings.skillsSavings + (data.savedBy === 'skills' ? data.amount : 0),
          discardSavings:
            prev.savings.discardSavings + (data.savedBy === 'discard' ? data.amount : 0),
        },
      }));
    };

    agent.on('tokens:used', handleTokensUsed);
    agent.on('tokens:saved', handleTokensSaved);

    return () => {
      agent.off('tokens:used', handleTokensUsed);
      agent.off('tokens:saved', handleTokensSaved);
    };
  }, []);

  const resetMetrics = useCallback(() => {
    setMetrics(initialMetrics);
  }, []);

  const value = useMemo(
    () => ({ metrics, trackAgent, resetMetrics }),
    [metrics, trackAgent, resetMetrics],
  );

  return <MetricsContext.Provider value={value}>{children}</MetricsContext.Provider>;
}

export function useGlobalMetrics() {
  const context = useContext(MetricsContext);
  if (!context) {
    throw new Error('useGlobalMetrics must be used within a MetricsProvider');
  }
  return context;
}
