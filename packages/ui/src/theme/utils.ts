/**
 * Theme utility functions
 */

import type { Theme } from './types';

/**
 * Merge custom theme with base theme
 */
export function mergeTheme(base: Theme, custom: Partial<Theme>): Theme {
  return {
    colors: { ...base.colors, ...custom.colors },
    spacing: { ...base.spacing, ...custom.spacing },
    borderRadius: { ...base.borderRadius, ...custom.borderRadius },
    shadows: { ...base.shadows, ...custom.shadows },
    typography: {
      ...base.typography,
      ...custom.typography,
      fontSize: {
        ...base.typography.fontSize,
        ...custom.typography?.fontSize,
      },
      fontWeight: {
        ...base.typography.fontWeight,
        ...custom.typography?.fontWeight,
      },
    },
    components: {
      ...base.components,
      ...custom.components,
    },
  };
}

/**
 * Generate CSS variables string from theme
 */
export function generateCSSVariables(theme: Theme): string {
  const vars: string[] = [];

  // Colors
  for (const [key, value] of Object.entries(theme.colors)) {
    vars.push(`  --wukong-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${value};`);
  }

  // Spacing
  for (const [key, value] of Object.entries(theme.spacing)) {
    vars.push(`  --wukong-spacing-${key}: ${value}px;`);
  }

  // Border radius
  for (const [key, value] of Object.entries(theme.borderRadius)) {
    vars.push(`  --wukong-border-radius-${key}: ${value}px;`);
  }

  // Shadows
  for (const [key, value] of Object.entries(theme.shadows)) {
    vars.push(`  --wukong-shadow-${key}: ${value};`);
  }

  // Typography
  vars.push(`  --wukong-font-family: ${theme.typography.fontFamily};`);
  for (const [key, value] of Object.entries(theme.typography.fontSize)) {
    vars.push(`  --wukong-font-size-${key}: ${value}px;`);
  }
  for (const [key, value] of Object.entries(theme.typography.fontWeight)) {
    vars.push(`  --wukong-font-weight-${key}: ${value};`);
  }

  return `:root {\n${vars.join('\n')}\n}`;
}
