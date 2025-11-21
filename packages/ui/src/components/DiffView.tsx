import type React from 'react';
import { useMemo } from 'react';
import { useTheme } from '../theme/ThemeContext';

export interface DiffViewProps {
  oldText: string;
  newText: string;
  language?: string;
  className?: string;
  style?: React.CSSProperties;
  viewMode?: 'split' | 'unified';
}

interface DiffLine {
  type: 'same' | 'added' | 'removed';
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

export const DiffView: React.FC<DiffViewProps> = ({
  oldText,
  newText,
  className,
  style,
  viewMode = 'unified',
}) => {
  const { theme } = useTheme();

  const diffLines = useMemo(() => {
    const lines: DiffLine[] = [];
    const oldLines = oldText.split('\n');
    const newLines = newText.split('\n');

    // Very naive diff implementation for demonstration
    // In a real app, use 'diff' or 'diff-match-patch' library
    let i = 0;
    let j = 0;

    while (i < oldLines.length || j < newLines.length) {
      const oldLine = oldLines[i];
      const newLine = newLines[j];

      if (
        i < oldLines.length &&
        j < newLines.length &&
        oldLine === newLine &&
        oldLine !== undefined
      ) {
        lines.push({
          type: 'same',
          content: oldLine,
          oldLineNumber: i + 1,
          newLineNumber: j + 1,
        });
        i++;
        j++;
      } else if (
        j < newLines.length &&
        newLine !== undefined &&
        (i >= oldLines.length || (oldLine !== undefined && !oldLines.includes(newLine, i)))
      ) {
        // Added line
        lines.push({
          type: 'added',
          content: newLine,
          newLineNumber: j + 1,
        });
        j++;
      } else if (i < oldLines.length && oldLine !== undefined) {
        // Removed line
        lines.push({
          type: 'removed',
          content: oldLine,
          oldLineNumber: i + 1,
        });
        i++;
      }
    }
    return lines;
  }, [oldText, newText]);

  const getLineStyle = (type: DiffLine['type']): React.CSSProperties => {
    const base: React.CSSProperties = {
      fontFamily: 'monospace',
      whiteSpace: 'pre-wrap',
      padding: '2px 4px',
      fontSize: theme.typography.fontSize.sm,
      display: 'flex',
    };

    switch (type) {
      case 'added':
        return { ...base, backgroundColor: `${theme.colors.success}20` };
      case 'removed':
        return { ...base, backgroundColor: `${theme.colors.error}20` };
      default:
        return base;
    }
  };

  const renderLineContent = (line: DiffLine) => (
    <>
      <span
        style={{
          width: '30px',
          display: 'inline-block',
          color: theme.colors.textSecondary,
          userSelect: 'none',
          textAlign: 'right',
          marginRight: theme.spacing.sm,
        }}
      >
        {viewMode === 'unified'
          ? line.type === 'added'
            ? '+'
            : line.type === 'removed'
              ? '-'
              : ''
          : ''}
      </span>
      <span style={{ flex: 1 }}>{line.content}</span>
    </>
  );

  return (
    <div
      className={className}
      style={{
        border: `1px solid ${theme.colors.border}`,
        borderRadius: theme.borderRadius.md,
        overflow: 'hidden',
        ...style,
      }}
    >
      <div
        style={{
          backgroundColor: theme.colors.surface,
          padding: theme.spacing.sm,
          borderBottom: `1px solid ${theme.colors.border}`,
          fontSize: theme.typography.fontSize.xs,
          color: theme.colors.textSecondary,
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <span>Diff View ({viewMode})</span>
      </div>
      <div
        style={{
          maxHeight: '400px',
          overflowY: 'auto',
          backgroundColor: theme.colors.background,
        }}
      >
        {diffLines.map((line, index) => (
          <div
            key={`${line.type}-${line.oldLineNumber ?? 'x'}-${line.newLineNumber ?? 'x'}-${index}`}
            style={getLineStyle(line.type)}
          >
            {renderLineContent(line)}
          </div>
        ))}
      </div>
    </div>
  );
};
