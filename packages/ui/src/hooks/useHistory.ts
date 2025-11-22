import type { Step, WukongAgent } from '@wukong/agent';
import { useEffect, useState } from 'react';

export function useHistory(agent: WukongAgent | null, sessionId?: string) {
  const [history, setHistory] = useState<Step[]>([]);

  useEffect(() => {
    if (!(agent && sessionId)) return;

    // Load initial history
    agent.getHistory(sessionId).then((steps) => {
      setHistory(steps);
    });

    const handleStepCompleted = (data: any) => {
      setHistory((prev) => {
        // Check if step already exists (update) or add new
        const exists = prev.some((s) => s.id === data.step.id);
        if (exists) {
          return prev.map((s) => (s.id === data.step.id ? data.step : s));
        }
        return [...prev, data.step];
      });
    };

    const handleTaskCompleted = (data: any) => {
      if (data.sessionId === sessionId) {
        agent.getHistory(sessionId).then((steps) => {
          setHistory(steps);
        });
      }
    };

    agent.on('step:completed', handleStepCompleted);
    agent.on('task:completed', handleTaskCompleted);

    return () => {
      agent.off('step:completed', handleStepCompleted);
      agent.off('task:completed', handleTaskCompleted);
    };
  }, [agent, sessionId]);

  return history;
}
