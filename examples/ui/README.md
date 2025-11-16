# Wukong UI Example

This example demonstrates how to use the `@wukong/ui` React component library, showcasing the theme system and UI components.

## Features Demonstrated

- **ThemeProvider**: Context provider for theme management
- **useTheme Hook**: Access and modify theme dynamically
- **Theme Modes**: Light, Dark, and Auto (system preference)
- **CSS Variables**: Automatic CSS variable injection
- **Color Palette**: Primary, Secondary, Success, Warning, Error colors
- **Typography System**: Font sizes and weights
- **Spacing System**: Consistent spacing values
- **Border Radius**: Different border radius sizes
- **Shadow System**: Small, medium, and large shadows
- **Interactive Theming**: Real-time theme customization

## Getting Started

### Prerequisites

Make sure you're in the Wukong monorepo root and have installed all dependencies:

```bash
# From the monorepo root
pnpm install
```

### Building Dependencies

Build the UI package first:

```bash
# From the monorepo root
cd packages/ui
pnpm build

# Or build all packages
cd ../..
pnpm build
```

### Running the Example

```bash
# From the monorepo root
cd examples/ui

# Install dependencies (if not already installed)
pnpm install

# Start the development server
pnpm dev
```

The application will be available at `http://localhost:3000`.

## Project Structure

```
examples/ui/
├── src/
│   ├── App.tsx          # Main component with theme demos
│   ├── App.css          # Component styles using CSS variables
│   ├── main.tsx         # React entry point
│   └── index.css        # Global styles
├── index.html           # HTML template
├── package.json         # Dependencies
├── tsconfig.json        # TypeScript config
├── vite.config.ts       # Vite config
└── README.md            # This file
```

## Usage Examples

### Basic Theme Provider

```tsx
import { ThemeProvider } from '@wukong/ui';

function App() {
  return (
    <ThemeProvider defaultMode="light">
      <YourApp />
    </ThemeProvider>
  );
}
```

### Using the Theme Hook

```tsx
import { useTheme } from '@wukong/ui';

function MyComponent() {
  const { theme, mode, setMode } = useTheme();

  return (
    <div style={{ color: theme.colors.primary }}>
      <button onClick={() => setMode('dark')}>
        Switch to Dark Mode
      </button>
    </div>
  );
}
```

### Using CSS Variables

```css
.my-component {
  color: var(--wukong-primary);
  background: var(--wukong-background);
  padding: var(--wukong-spacing-md);
  border-radius: var(--wukong-border-radius-md);
  box-shadow: var(--wukong-shadow-md);
}
```

### Custom Theme

```tsx
import { ThemeProvider, type Theme } from '@wukong/ui';

const customTheme: Theme = {
  colors: {
    primary: '#ff6b6b',
    secondary: '#4ecdc4',
    // ... other colors
  },
  // ... other theme properties
};

function App() {
  return (
    <ThemeProvider theme={customTheme}>
      <YourApp />
    </ThemeProvider>
  );
}
```

## Available Scripts

- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm preview` - Preview production build

## Learn More

- [@wukong/ui Documentation](../../packages/ui/README.md)
- [Wukong Implementation Plan](../../docs/implementation/plan.md)
- [UI Components Design](../../docs/design/appendix-ui-components.md)

## License

MIT

