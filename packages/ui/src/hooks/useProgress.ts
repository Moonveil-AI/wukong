import type { WukongAgent } from '@wukong/agent';
import { useEffect, useState } from 'react';

export function useProgress(agent: WukongAgent | null) {
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [totalSteps, setTotalSteps] = useState(0);
  const [description, setDescription] = useState<string>('');
  // Estimated time remaining is not yet supported by the agent events
  const [estimatedTimeRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!agent) return;

    const handleProgressUpdated = (data: any) => {
      // data corresponds to ProgressUpdatedEvent
      setProgress(data.percentage);
      setCurrentStep(data.currentStep);
      if (data.totalSteps) setTotalSteps(data.totalSteps);
      if (data.description) setDescription(data.description);
      // Estimated time is not in the event currently, but could be calculated
    };

    agent.on('progress:updated', handleProgressUpdated);

    return () => {
      agent.off('progress:updated', handleProgressUpdated);
    };
  }, [agent]);

  return {
    progress,
    currentStep,
    totalSteps,
    description,
    estimatedTimeRemaining,
  };
}
