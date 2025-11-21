import type React from 'react';
import { useState } from 'react';
import { useTheme } from '../theme';

export interface FeedbackButtonsProps {
  onFeedback: (type: 'thumbs-up' | 'thumbs-down' | 'star', value?: number) => void;
  allowStars?: boolean;
  className?: string;
}

export const FeedbackButtons: React.FC<FeedbackButtonsProps> = ({
  onFeedback,
  allowStars = false,
  className = '',
}) => {
  const { theme } = useTheme();
  const [selected, setSelected] = useState<'up' | 'down' | number | null>(null);

  const handleThumbsUp = () => {
    setSelected('up');
    onFeedback('thumbs-up');
  };

  const handleThumbsDown = () => {
    setSelected('down');
    onFeedback('thumbs-down');
  };

  const handleStar = (rating: number) => {
    setSelected(rating);
    onFeedback('star', rating);
  };

  const buttonStyle = (isActive: boolean) => ({
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: theme.spacing.xs,
    color: isActive ? theme.colors.primary : theme.colors.textSecondary,
    transition: 'color 0.2s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  });

  return (
    <div
      className={className}
      style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.md }}
    >
      <div style={{ display: 'flex', gap: theme.spacing.sm }}>
        <button
          type="button"
          onClick={handleThumbsUp}
          style={buttonStyle(selected === 'up')}
          title="Good response"
          aria-label="Thumbs up"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill={selected === 'up' ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <title>Thumbs Up</title>
            <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
          </svg>
        </button>
        <button
          type="button"
          onClick={handleThumbsDown}
          style={buttonStyle(selected === 'down')}
          title="Bad response"
          aria-label="Thumbs down"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill={selected === 'down' ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <title>Thumbs Down</title>
            <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" />
          </svg>
        </button>
      </div>

      {allowStars && (
        <div
          style={{
            display: 'flex',
            gap: 2,
            marginLeft: theme.spacing.sm,
            borderLeft: `1px solid ${theme.colors.border}`,
            paddingLeft: theme.spacing.md,
          }}
        >
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => handleStar(star)}
              style={{
                ...buttonStyle(typeof selected === 'number' && star <= selected),
                padding: 2,
              }}
              title={`${star} star${star > 1 ? 's' : ''}`}
              aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill={typeof selected === 'number' && star <= selected ? 'currentColor' : 'none'}
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <title>{star} Star</title>
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
