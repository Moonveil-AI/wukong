import '@testing-library/jest-dom';
import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ThemeProvider, useTheme } from '../ThemeContext';
import { darkTheme, lightTheme } from '../defaultTheme';
import { generateCSSVariables, mergeTheme } from '../utils';

// Mock component to test hook
const TestComponent = () => {
  const { theme, mode, setMode } = useTheme();
  return (
    <div>
      <div data-testid="theme-bg" style={{ backgroundColor: theme.colors.background }}>
        {mode}
      </div>
      <button type="button" onClick={() => setMode('dark')}>
        Set Dark
      </button>
      <button type="button" onClick={() => setMode('light')}>
        Set Light
      </button>
    </div>
  );
};

describe('Theme System', () => {
  describe('utils', () => {
    it('mergeTheme should merge partial theme correctly', () => {
      const customTheme = {
        colors: {
          primary: '#ff0000',
        },
      };
      // @ts-ignore - partial theme for testing
      const merged = mergeTheme(lightTheme, customTheme);
      expect(merged.colors.primary).toBe('#ff0000');
      expect(merged.colors.secondary).toBe(lightTheme.colors.secondary);
    });

    it('generateCSSVariables should generate correct CSS variables', () => {
      const css = generateCSSVariables(lightTheme);
      expect(css).toContain('--wukong-primary: #0070f3');
      expect(css).toContain('--wukong-spacing-md: 16px');
      expect(css).toContain(':root {');
    });
  });

  describe('ThemeProvider', () => {
    it('should provide default light theme', () => {
      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>,
      );

      const element = screen.getByTestId('theme-bg');
      expect(element).toHaveTextContent('light');
      // Note: style prop might not reflect hex exactly if normalized, checking if it rendered
      expect(element).toBeInTheDocument();
    });

    it('should allow switching modes', async () => {
      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>,
      );

      const element = screen.getByTestId('theme-bg');
      expect(element).toHaveTextContent('light');

      act(() => {
        screen.getByText('Set Dark').click();
      });

      expect(element).toHaveTextContent('dark');
    });

    it('should apply CSS variables to document root', () => {
      // Mock document.documentElement.style.setProperty
      const setPropertySpy = vi.spyOn(document.documentElement.style, 'setProperty');

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>,
      );

      expect(setPropertySpy).toHaveBeenCalledWith('--wukong-primary', lightTheme.colors.primary);

      act(() => {
        screen.getByText('Set Dark').click();
      });

      expect(setPropertySpy).toHaveBeenCalledWith('--wukong-primary', darkTheme.colors.primary);

      setPropertySpy.mockRestore();
    });
  });
});
