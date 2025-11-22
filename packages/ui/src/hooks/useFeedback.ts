import { useCallback, useState } from 'react';

export interface FeedbackData {
  category: string;
  text: string;
  screenshot?: File;
  rating?: number; // For simple thumbs up/down or stars
}

export interface UseFeedbackOptions {
  onSubmit?: (feedback: FeedbackData) => Promise<void>;
}

export function useFeedback(options: UseFeedbackOptions = {}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const submitFeedback = useCallback(
    async (feedback: FeedbackData) => {
      setIsSubmitting(true);
      setError(null);
      setIsSuccess(false);

      try {
        if (options.onSubmit) {
          await options.onSubmit(feedback);
        } else {
          // Default behavior: just log or mock
          console.log('Feedback submitted:', feedback);
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
        setIsSuccess(true);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to submit feedback'));
      } finally {
        setIsSubmitting(false);
      }
    },
    [options],
  );

  const reset = useCallback(() => {
    setIsSuccess(false);
    setError(null);
  }, []);

  return {
    submitFeedback,
    isSubmitting,
    error,
    isSuccess,
    reset,
  };
}
