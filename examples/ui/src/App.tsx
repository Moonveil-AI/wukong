import { type ThemeMode, ThemeProvider, useTheme } from '@wukong/ui';
import { useState } from 'react';
import './App.css';

function ThemeDemo() {
  const { theme, mode, setMode } = useTheme();
  const [customColor, setCustomColor] = useState(theme.colors.primary);

  const handleModeChange = (newMode: ThemeMode) => {
    setMode(newMode);
  };

  return (
    <div className="app">
      <header className="header">
        <h1>🐒 Wukong UI Example</h1>
        <p>Demonstrating @wukong/ui theme system</p>
      </header>

      <main className="main">
        {/* Theme Mode Switcher */}
        <section className="section">
          <h2>Theme Mode</h2>
          <div className="button-group">
            <button
              type="button"
              onClick={() => handleModeChange('light')}
              className={mode === 'light' ? 'active' : ''}
            >
              ☀️ Light
            </button>
            <button
              type="button"
              onClick={() => handleModeChange('dark')}
              className={mode === 'dark' ? 'active' : ''}
            >
              🌙 Dark
            </button>
            <button
              type="button"
              onClick={() => handleModeChange('auto')}
              className={mode === 'auto' ? 'active' : ''}
            >
              🔄 Auto
            </button>
          </div>
          <p className="info">
            Current mode: <strong>{mode}</strong>
          </p>
        </section>

        {/* Color Palette */}
        <section className="section">
          <h2>Color Palette</h2>
          <div className="color-grid">
            <div className="color-item">
              <div className="color-swatch" style={{ backgroundColor: theme.colors.primary }} />
              <span>Primary</span>
              <code>{theme.colors.primary}</code>
            </div>
            <div className="color-item">
              <div className="color-swatch" style={{ backgroundColor: theme.colors.secondary }} />
              <span>Secondary</span>
              <code>{theme.colors.secondary}</code>
            </div>
            <div className="color-item">
              <div className="color-swatch" style={{ backgroundColor: theme.colors.success }} />
              <span>Success</span>
              <code>{theme.colors.success}</code>
            </div>
            <div className="color-item">
              <div className="color-swatch" style={{ backgroundColor: theme.colors.warning }} />
              <span>Warning</span>
              <code>{theme.colors.warning}</code>
            </div>
            <div className="color-item">
              <div className="color-swatch" style={{ backgroundColor: theme.colors.error }} />
              <span>Error</span>
              <code>{theme.colors.error}</code>
            </div>
          </div>
        </section>

        {/* Typography */}
        <section className="section">
          <h2>Typography</h2>
          <div className="typography-demo">
            <p style={{ fontSize: theme.typography.fontSize.xs }}>
              Extra Small Text (xs: {theme.typography.fontSize.xs}px)
            </p>
            <p style={{ fontSize: theme.typography.fontSize.sm }}>
              Small Text (sm: {theme.typography.fontSize.sm}px)
            </p>
            <p style={{ fontSize: theme.typography.fontSize.md }}>
              Medium Text (md: {theme.typography.fontSize.md}px)
            </p>
            <p style={{ fontSize: theme.typography.fontSize.lg }}>
              Large Text (lg: {theme.typography.fontSize.lg}px)
            </p>
            <p style={{ fontSize: theme.typography.fontSize.xl }}>
              Extra Large Text (xl: {theme.typography.fontSize.xl}px)
            </p>
          </div>
        </section>

        {/* Spacing */}
        <section className="section">
          <h2>Spacing</h2>
          <div className="spacing-demo">
            <div style={{ padding: theme.spacing.xs }} className="spacing-box">
              xs: {theme.spacing.xs}px
            </div>
            <div style={{ padding: theme.spacing.sm }} className="spacing-box">
              sm: {theme.spacing.sm}px
            </div>
            <div style={{ padding: theme.spacing.md }} className="spacing-box">
              md: {theme.spacing.md}px
            </div>
            <div style={{ padding: theme.spacing.lg }} className="spacing-box">
              lg: {theme.spacing.lg}px
            </div>
            <div style={{ padding: theme.spacing.xl }} className="spacing-box">
              xl: {theme.spacing.xl}px
            </div>
          </div>
        </section>

        {/* Border Radius */}
        <section className="section">
          <h2>Border Radius</h2>
          <div className="radius-demo">
            <div style={{ borderRadius: theme.borderRadius.sm }} className="radius-box">
              sm: {theme.borderRadius.sm}px
            </div>
            <div style={{ borderRadius: theme.borderRadius.md }} className="radius-box">
              md: {theme.borderRadius.md}px
            </div>
            <div style={{ borderRadius: theme.borderRadius.lg }} className="radius-box">
              lg: {theme.borderRadius.lg}px
            </div>
          </div>
        </section>

        {/* Shadows */}
        <section className="section">
          <h2>Shadows</h2>
          <div className="shadow-demo">
            <div style={{ boxShadow: theme.shadows.sm }} className="shadow-box">
              Small Shadow
            </div>
            <div style={{ boxShadow: theme.shadows.md }} className="shadow-box">
              Medium Shadow
            </div>
            <div style={{ boxShadow: theme.shadows.lg }} className="shadow-box">
              Large Shadow
            </div>
          </div>
        </section>

        {/* CSS Variables */}
        <section className="section">
          <h2>CSS Variables</h2>
          <p className="info">
            The theme system automatically applies CSS variables to the document root. You can use
            them in your CSS:
          </p>
          <pre className="code-block">
            {`.my-component {
  color: var(--wukong-primary);
  background: var(--wukong-background);
  padding: var(--wukong-spacing-md);
  border-radius: var(--wukong-border-radius-md);
  box-shadow: var(--wukong-shadow-md);
}`}
          </pre>
        </section>

        {/* Interactive Demo */}
        <section className="section">
          <h2>Interactive Demo</h2>
          <div className="interactive-demo">
            <label htmlFor="color-picker">
              Change Primary Color:
              <input
                id="color-picker"
                type="color"
                value={customColor}
                onChange={(e) => setCustomColor(e.target.value)}
              />
            </label>
            <div
              className="demo-box"
              style={{
                backgroundColor: customColor,
                color: '#fff',
                padding: theme.spacing.lg,
                borderRadius: theme.borderRadius.md,
                boxShadow: theme.shadows.md,
              }}
            >
              Custom styled box using theme values
            </div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <p>
          Built with <strong>@wukong/ui</strong> - A React UI component library for Wukong Agent
        </p>
      </footer>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider defaultMode="light">
      <ThemeDemo />
    </ThemeProvider>
  );
}

export default App;
