import type React from 'react';
import { useState } from 'react';
import { useTheme } from '../theme';

export interface FeedbackFormProps {
  onSubmit: (feedback: { category: string; text: string; screenshot?: File }) => void;
  onCancel: () => void;
  className?: string;
}

export const FeedbackForm: React.FC<FeedbackFormProps> = ({
  onSubmit,
  onCancel,
  className = '',
}) => {
  const { theme } = useTheme();
  const [category, setCategory] = useState('general');
  const [text, setText] = useState('');
  const [screenshot, setScreenshot] = useState<File | undefined>(undefined);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ category, text, screenshot });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={className}
      style={{
        padding: theme.spacing.md,
        backgroundColor: theme.colors.surface,
        borderRadius: theme.borderRadius.md,
        border: `1px solid ${theme.colors.border}`,
        color: theme.colors.text,
        display: 'flex',
        flexDirection: 'column',
        gap: theme.spacing.md,
        fontFamily: theme.typography.fontFamily,
      }}
    >
      <h3
        style={{
          margin: 0,
          fontSize: theme.typography.fontSize.lg,
          fontWeight: theme.typography.fontWeight.bold,
        }}
      >
        Provide Feedback
      </h3>

      <div>
        <label
          htmlFor="feedback-category"
          style={{
            display: 'block',
            marginBottom: theme.spacing.xs,
            fontSize: theme.typography.fontSize.sm,
            fontWeight: theme.typography.fontWeight.medium,
          }}
        >
          Category
        </label>
        <select
          id="feedback-category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          style={{
            width: '100%',
            padding: theme.spacing.sm,
            borderRadius: theme.borderRadius.sm,
            border: `1px solid ${theme.colors.border}`,
            backgroundColor: theme.colors.background,
            color: theme.colors.text,
            fontSize: theme.typography.fontSize.md,
          }}
        >
          <option value="general">General</option>
          <option value="bug">Bug Report</option>
          <option value="feature">Feature Request</option>
          <option value="accuracy">Response Accuracy</option>
          <option value="performance">Performance</option>
        </select>
      </div>

      <div>
        <label
          htmlFor="feedback-details"
          style={{
            display: 'block',
            marginBottom: theme.spacing.xs,
            fontSize: theme.typography.fontSize.sm,
            fontWeight: theme.typography.fontWeight.medium,
          }}
        >
          Details
        </label>
        <textarea
          id="feedback-details"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Tell us more about your experience..."
          required
          rows={4}
          style={{
            width: '100%',
            padding: theme.spacing.sm,
            borderRadius: theme.borderRadius.sm,
            border: `1px solid ${theme.colors.border}`,
            backgroundColor: theme.colors.background,
            color: theme.colors.text,
            resize: 'vertical',
            fontFamily: 'inherit',
            fontSize: theme.typography.fontSize.md,
          }}
        />
      </div>

      <div>
        <label
          htmlFor="feedback-screenshot"
          style={{
            display: 'block',
            marginBottom: theme.spacing.xs,
            fontSize: theme.typography.fontSize.sm,
            fontWeight: theme.typography.fontWeight.medium,
          }}
        >
          Screenshot (optional)
        </label>
        <input
          id="feedback-screenshot"
          type="file"
          accept="image/*"
          onChange={(e) => setScreenshot(e.target.files?.[0])}
          style={{ fontSize: theme.typography.fontSize.sm }}
        />
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: theme.spacing.sm,
          marginTop: theme.spacing.sm,
        }}
      >
        <button
          type="button"
          onClick={onCancel}
          style={{
            padding: `${theme.spacing.xs}px ${theme.spacing.md}px`,
            backgroundColor: 'transparent',
            color: theme.colors.textSecondary,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: theme.borderRadius.sm,
            cursor: 'pointer',
            fontSize: theme.typography.fontSize.md,
          }}
        >
          Cancel
        </button>
        <button
          type="submit"
          style={{
            padding: `${theme.spacing.xs}px ${theme.spacing.md}px`,
            backgroundColor: theme.colors.primary,
            color: '#fff',
            border: 'none',
            borderRadius: theme.borderRadius.sm,
            cursor: 'pointer',
            fontSize: theme.typography.fontSize.md,
            fontWeight: theme.typography.fontWeight.medium,
          }}
        >
          Submit Feedback
        </button>
      </div>
    </form>
  );
};
