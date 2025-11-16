/**
 * Theme context for Wukong UI components
 */

import type React from 'react';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { darkTheme, defaultTheme, lightTheme } from './defaultTheme';
import type { Theme, ThemeMode } from './types';

interface ThemeContextValue {
  theme: Theme;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export interface ThemeProviderProps {
  children: React.ReactNode;
  theme?: Theme | ThemeMode;
  defaultMode?: ThemeMode;
}

export function ThemeProvider({ children, theme, defaultMode = 'light' }: ThemeProviderProps) {
  const [mode, setMode] = useState<ThemeMode>(defaultMode);

  // Determine actual theme to use
  const actualTheme = useMemo(() => {
    // If theme is a Theme object, use it directly
    if (theme && typeof theme === 'object' && 'colors' in theme) {
      return theme;
    }

    // If theme is a string (ThemeMode) or if mode is set
    const themeMode = typeof theme === 'string' ? theme : mode;

    if (themeMode === 'auto') {
      // Detect system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      return prefersDark ? darkTheme : lightTheme;
    }

    return themeMode === 'dark' ? darkTheme : lightTheme;
  }, [theme, mode]);

  // Apply CSS variables when theme changes
  useEffect(() => {
    const root = document.documentElement;

    // Colors
    root.style.setProperty('--wukong-primary', actualTheme.colors.primary);
    root.style.setProperty('--wukong-secondary', actualTheme.colors.secondary);
    root.style.setProperty('--wukong-success', actualTheme.colors.success);
    root.style.setProperty('--wukong-warning', actualTheme.colors.warning);
    root.style.setProperty('--wukong-error', actualTheme.colors.error);
    root.style.setProperty('--wukong-background', actualTheme.colors.background);
    root.style.setProperty('--wukong-surface', actualTheme.colors.surface);
    root.style.setProperty('--wukong-text', actualTheme.colors.text);
    root.style.setProperty('--wukong-text-secondary', actualTheme.colors.textSecondary);
    root.style.setProperty('--wukong-border', actualTheme.colors.border);

    // Spacing
    root.style.setProperty('--wukong-spacing-xs', `${actualTheme.spacing.xs}px`);
    root.style.setProperty('--wukong-spacing-sm', `${actualTheme.spacing.sm}px`);
    root.style.setProperty('--wukong-spacing-md', `${actualTheme.spacing.md}px`);
    root.style.setProperty('--wukong-spacing-lg', `${actualTheme.spacing.lg}px`);
    root.style.setProperty('--wukong-spacing-xl', `${actualTheme.spacing.xl}px`);

    // Border radius
    root.style.setProperty('--wukong-border-radius-sm', `${actualTheme.borderRadius.sm}px`);
    root.style.setProperty('--wukong-border-radius-md', `${actualTheme.borderRadius.md}px`);
    root.style.setProperty('--wukong-border-radius-lg', `${actualTheme.borderRadius.lg}px`);

    // Shadows
    root.style.setProperty('--wukong-shadow-sm', actualTheme.shadows.sm);
    root.style.setProperty('--wukong-shadow-md', actualTheme.shadows.md);
    root.style.setProperty('--wukong-shadow-lg', actualTheme.shadows.lg);

    // Typography
    root.style.setProperty('--wukong-font-family', actualTheme.typography.fontFamily);
    root.style.setProperty('--wukong-font-size-xs', `${actualTheme.typography.fontSize.xs}px`);
    root.style.setProperty('--wukong-font-size-sm', `${actualTheme.typography.fontSize.sm}px`);
    root.style.setProperty('--wukong-font-size-md', `${actualTheme.typography.fontSize.md}px`);
    root.style.setProperty('--wukong-font-size-lg', `${actualTheme.typography.fontSize.lg}px`);
    root.style.setProperty('--wukong-font-size-xl', `${actualTheme.typography.fontSize.xl}px`);
    root.style.setProperty(
      '--wukong-font-weight-regular',
      `${actualTheme.typography.fontWeight.regular}`,
    );
    root.style.setProperty(
      '--wukong-font-weight-medium',
      `${actualTheme.typography.fontWeight.medium}`,
    );
    root.style.setProperty(
      '--wukong-font-weight-bold',
      `${actualTheme.typography.fontWeight.bold}`,
    );
  }, [actualTheme]);

  // Listen for system theme changes when mode is 'auto'
  useEffect(() => {
    if (mode !== 'auto') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      // Force re-render by updating mode state
      setMode('auto');
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [mode]);

  const value = useMemo(
    () => ({
      theme: actualTheme,
      mode,
      setMode,
    }),
    [actualTheme, mode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    // Return default theme if used outside provider
    return {
      theme: defaultTheme,
      mode: 'light',
      setMode: () => {
        // No-op when used outside provider
      },
    };
  }
  return context;
}
