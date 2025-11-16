/**
 * Default theme presets for Wukong UI
 */

import type { Theme } from './types';

export const lightTheme: Theme = {
  colors: {
    primary: '#0070f3',
    secondary: '#7928ca',
    success: '#0070f3',
    warning: '#f5a623',
    error: '#ff0080',
    background: '#ffffff',
    surface: '#f5f5f5',
    text: '#000000',
    textSecondary: '#666666',
    border: '#e5e5e5',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  borderRadius: {
    sm: 4,
    md: 8,
    lg: 12,
  },
  shadows: {
    sm: '0 1px 3px rgba(0, 0, 0, 0.1)',
    md: '0 4px 6px rgba(0, 0, 0, 0.1)',
    lg: '0 10px 20px rgba(0, 0, 0, 0.1)',
  },
  typography: {
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    fontSize: {
      xs: 12,
      sm: 14,
      md: 16,
      lg: 18,
      xl: 24,
    },
    fontWeight: {
      regular: 400,
      medium: 500,
      bold: 700,
    },
  },
  components: {
    stopButton: {
      position: 'top-right',
      style: 'floating',
    },
    progressBar: {
      height: 8,
      animated: true,
    },
    todoList: {
      groupBy: 'status',
      showProgress: true,
    },
  },
};

export const darkTheme: Theme = {
  colors: {
    primary: '#3291ff',
    secondary: '#a855f7',
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    background: '#000000',
    surface: '#1a1a1a',
    text: '#ffffff',
    textSecondary: '#a0a0a0',
    border: '#333333',
  },
  spacing: lightTheme.spacing,
  borderRadius: lightTheme.borderRadius,
  shadows: {
    sm: '0 1px 3px rgba(0, 0, 0, 0.3)',
    md: '0 4px 6px rgba(0, 0, 0, 0.3)',
    lg: '0 10px 20px rgba(0, 0, 0, 0.3)',
  },
  typography: lightTheme.typography,
  components: lightTheme.components,
};

export const defaultTheme = lightTheme;
