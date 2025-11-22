import type { WukongAgent } from '@wukong/agent';
import { useEffect, useRef, useState } from 'react';

export function useThinking(agent: WukongAgent | null) {
  const [thinking, setThinking] = useState<string>('');
  const [isThinking, setIsThinking] = useState(false);
  const bufferRef = useRef<string>('');

  useEffect(() => {
    if (!agent) return;

    const handleStepStarted = () => {
      setThinking('');
      bufferRef.current = '';
      setIsThinking(true);
    };

    const handleLLMStreaming = (data: any) => {
      // data.chunk is StreamChunk { text: string }
      if (data.chunk?.text) {
        bufferRef.current += data.chunk.text;
        setThinking(bufferRef.current);
      }
    };

    const handleReasoningAvailable = (data: any) => {
      if (data.reasoning?.thought) {
        setThinking(data.reasoning.thought);
        bufferRef.current = data.reasoning.thought;
      }
    };

    const handleStepCompleted = () => {
      setIsThinking(false);
    };

    agent.on('step:started', handleStepStarted);
    agent.on('llm:streaming', handleLLMStreaming);
    agent.on('reasoning:available', handleReasoningAvailable);
    agent.on('step:completed', handleStepCompleted);

    return () => {
      agent.off('step:started', handleStepStarted);
      agent.off('llm:streaming', handleLLMStreaming);
      agent.off('reasoning:available', handleReasoningAvailable);
      agent.off('step:completed', handleStepCompleted);
    };
  }, [agent]);

  return {
    thinking,
    isThinking,
  };
}
