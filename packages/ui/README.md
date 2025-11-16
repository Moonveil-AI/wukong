# @wukong/ui

React UI components for Wukong Agent interfaces.

## Installation

```bash
npm install @wukong/ui react react-dom
# or
pnpm add @wukong/ui react react-dom
```

## Quick Start

```tsx
import { ThemeProvider } from '@wukong/ui';
import '@wukong/ui/styles.css';

function App() {
  return (
    <ThemeProvider theme="light">
      {/* Your app components */}
    </ThemeProvider>
  );
}
```

## Features

- 🎨 **Theme System**: Built-in light/dark themes with full customization
- 📱 **Responsive**: Mobile-first design with responsive breakpoints
- ♿ **Accessible**: WCAG 2.1 AA compliant
- 🌍 **i18n Ready**: Built-in internationalization support
- 🎯 **TypeScript**: Full type safety and IntelliSense
- 🚀 **Performance**: Optimized for production

## Theme System

### Using Preset Themes

```tsx
import { ThemeProvider } from '@wukong/ui';

<ThemeProvider theme="light">
  <App />
</ThemeProvider>

// Or dark theme
<ThemeProvider theme="dark">
  <App />
</ThemeProvider>

// Or auto (follows system preference)
<ThemeProvider theme="auto">
  <App />
</ThemeProvider>
```

### Custom Theme

```tsx
import { ThemeProvider } from '@wukong/ui';

<ThemeProvider
  theme={{
    colors: {
      primary: '#0070f3',
      secondary: '#7928ca',
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444',
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
    // ... more customization
  }}
>
  <App />
</ThemeProvider>
```

### Using CSS Variables

All theme values are available as CSS variables:

```css
:root {
  --wukong-primary: #0070f3;
  --wukong-success: #10b981;
  --wukong-error: #ef4444;
  --wukong-border-radius-md: 8px;
  --wukong-spacing-md: 16px;
  /* ... and more */
}
```

## useTheme Hook

Access theme values in your components:

```tsx
import { useTheme } from '@wukong/ui';

function MyComponent() {
  const { theme, mode, setMode } = useTheme();

  return (
    <div style={{ color: theme.colors.primary }}>
      Current mode: {mode}
      <button onClick={() => setMode('dark')}>Switch to Dark</button>
    </div>
  );
}
```

## Documentation

For more detailed documentation, see:
- [UI Component Design](../../docs/design/appendix-ui-components.md)
- [Trustworthiness Principles](../../docs/design/appendix-trustworthiness.md)

## License

MIT

