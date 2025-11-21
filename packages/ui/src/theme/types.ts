/**
 * Theme system types for Wukong UI components
 */

export interface ThemeColors {
  primary: string;
  secondary: string;
  success: string;
  warning: string;
  error: string;
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  border: string;
}

export interface ThemeSpacing {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
}

export interface ThemeBorderRadius {
  sm: number;
  md: number;
  lg: number;
  full: number;
}

export interface ThemeShadows {
  sm: string;
  md: string;
  lg: string;
}

export interface ThemeTypography {
  fontFamily: string;
  fontSize: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
  };
  fontWeight: {
    regular: number;
    medium: number;
    bold: number;
  };
}

export interface ThemeComponents {
  stopButton?: {
    position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
    style?: 'floating' | 'inline';
  };
  progressBar?: {
    height?: number;
    animated?: boolean;
  };
  todoList?: {
    groupBy?: 'status' | 'priority' | 'none';
    showProgress?: boolean;
  };
}

export interface Theme {
  colors: ThemeColors;
  spacing: ThemeSpacing;
  borderRadius: ThemeBorderRadius;
  shadows: ThemeShadows;
  typography: ThemeTypography;
  components?: ThemeComponents;
}

export type ThemeMode = 'light' | 'dark' | 'auto';
