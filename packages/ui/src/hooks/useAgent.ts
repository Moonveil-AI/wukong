import {
  type ExecuteOptions,
  type ExecutionResult,
  WukongAgent,
  type WukongAgentConfig,
} from '@wukong/agent';
import { useCallback, useEffect, useState } from 'react';

export interface UseAgentOptions extends WukongAgentConfig {
  initialGoal?: string;
  autoStart?: boolean;
}

export function useAgent(config: UseAgentOptions) {
  const [agent, setAgent] = useState<WukongAgent | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [status, setStatus] = useState<
    'idle' | 'running' | 'paused' | 'stopped' | 'completed' | 'error'
  >('idle');
  const [error, setError] = useState<Error | null>(null);
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    const newAgent = new WukongAgent(config);
    setAgent(newAgent);

    // Cleanup
    return () => {
      // Potentially stop if unmounted?
      // newAgent.stop();
    };
  }, [config]);

  useEffect(() => {
    if (!agent) return;

    const handleTaskStarted = (_data: any) => {
      setStatus('running');
      setError(null);
    };

    const handleTaskCompleted = (data: any) => {
      setStatus('completed');
      setResult(data);
      setIsRunning(false);
    };

    const handleTaskError = (data: any) => {
      setStatus('error');
      setError(data.error);
      setIsRunning(false);
    };

    const handleTaskStopped = (_data: any) => {
      setStatus('stopped');
      setIsRunning(false);
    };

    agent.on('task:started', handleTaskStarted);
    agent.on('task:completed', handleTaskCompleted);
    agent.on('task:error', handleTaskError);
    agent.on('task:stopped', handleTaskStopped);

    return () => {
      agent.off('task:started', handleTaskStarted);
      agent.off('task:completed', handleTaskCompleted);
      agent.off('task:error', handleTaskError);
      agent.off('task:stopped', handleTaskStopped);
    };
  }, [agent]);

  const execute = useCallback(
    async (options: ExecuteOptions) => {
      if (!agent) return;

      setIsRunning(true);
      setStatus('running');
      setError(null);
      setResult(null);

      try {
        // sessionId might be returned in the result
        const res = await agent.execute(options);
        setResult(res);
        setSessionId(res.sessionId);
        setStatus('completed');
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
        setStatus('error');
      } finally {
        setIsRunning(false);
      }
    },
    [agent],
  );

  const stop = useCallback(() => {
    if (agent) {
      agent.stop();
      // Status update will happen via event listener 'task:stopped'
    }
  }, [agent]);

  useEffect(() => {
    if (agent && config.initialGoal && config.autoStart && status === 'idle') {
      execute({ goal: config.initialGoal });
    }
  }, [agent, config.initialGoal, config.autoStart, status, execute]);

  return {
    agent,
    isRunning,
    status,
    error,
    result,
    execute,
    stop,
    sessionId,
  };
}
