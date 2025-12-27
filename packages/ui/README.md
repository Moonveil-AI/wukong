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
- 💬 **Client Integration**: Built-in `useWukongClient` hook for easy server connection
- 📝 **Default Prompts**: Pre-configured example prompts for quick start

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

## useWukongClient Hook

Connect to a Wukong server with real-time communication:

```tsx
import { useWukongClient, defaultExamplePrompts } from '@wukong/ui';

function App() {
  const { messages, sendMessage, isExecuting, status } = useWukongClient({
    apiUrl: 'http://localhost:3001',
    restoreSession: true,
    transport: 'sse'
  });

  if (status === 'error') return <div>Connection failed</div>;
  if (status === 'initializing') return <div>Connecting...</div>;

  return (
    <div>
      {messages.map(msg => (
        <div key={msg.id}>{msg.content}</div>
      ))}
      <button onClick={() => sendMessage('Hello!')}>Send</button>
    </div>
  );
}
```

## Default Example Prompts

Use pre-configured example prompts:

```tsx
import { ExamplePrompts, defaultExamplePrompts, calculatorPrompts } from '@wukong/ui';

function Sidebar() {
  return (
    <>
      {/* Use default prompts */}
      <ExamplePrompts 
        examples={defaultExamplePrompts}
        onSelect={(prompt) => console.log(prompt)}
      />
      
      {/* Or use calculator-specific prompts */}
      <ExamplePrompts 
        examples={calculatorPrompts}
        onSelect={(prompt) => console.log(prompt)}
      />
    </>
  );
}
```

## Documentation

For more detailed documentation, see:
- [UI Component Design](../../docs/design/appendix-ui-components.md)
- [Trustworthiness Principles](../../docs/design/appendix-trustworthiness.md)

## License

MIT

