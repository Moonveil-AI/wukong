import type { TokenUsage, WukongAgent } from '@wukong/agent';
import { useEffect, useState } from 'react';

export interface AgentMetrics {
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  estimatedCost: number;
  tokensSaved: number;
  savings: {
    mcpSavings: number;
    skillsSavings: number;
    discardSavings: number;
    total: number;
  };
}

export function useMetrics(agent: WukongAgent | null) {
  const [metrics, setMetrics] = useState<AgentMetrics>({
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
  });

  useEffect(() => {
    if (!agent) return;

    const handleTokensUsed = (data: any) => {
      const usage: TokenUsage = data.usage;
      setMetrics((prev) => ({
        ...prev,
        totalTokens: prev.totalTokens + usage.totalTokens,
        promptTokens: prev.promptTokens + usage.promptTokens,
        completionTokens: prev.completionTokens + usage.completionTokens,
        estimatedCost: prev.estimatedCost + usage.estimatedCost,
      }));
    };

    const handleTokensSaved = (data: any) => {
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
  }, [agent]);

  return metrics;
}
