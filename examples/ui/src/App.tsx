import { AgentChat, ThemeProvider, useTheme } from '@wukong/ui';
import { useState } from 'react';
import './App.css';
import AdvancedApp from './AdvancedApp';

function SimpleApp() {
  const { mode, setMode } = useTheme();

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          padding: '10px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid #eee',
        }}
      >
        <h1>Wukong Agent - Simple Chat Interface</h1>
        <div>
          <button type="button" onClick={() => setMode(mode === 'light' ? 'dark' : 'light')}>
            Toggle Theme ({mode})
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'hidden' }}>
        <AgentChat
          config={{
            name: 'Wukong',
            capabilities: [
              {
                category: 'Reasoning',
                can: ['Multi-step planning', 'Context retention'],
                cannot: ['Real-time web browsing'],
              },
              {
                category: 'Tools',
                can: ['Calculator', 'Search'],
                cannot: ['System file access'],
              },
            ],
          }}
          theme={mode}
          showCapabilities={true}
          showProgress={true}
          enableFeedback={true}
        />
      </div>
    </div>
  );
}

function App() {
  const [mode, setMode] = useState<'simple' | 'advanced'>('simple');

  if (mode === 'advanced') {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '5px', background: '#f0f0f0', textAlign: 'center' }}>
          <button type="button" onClick={() => setMode('simple')}>
            Switch to Simple Mode
          </button>
        </div>
        <div style={{ flex: 1 }}>
          <AdvancedApp />
        </div>
      </div>
    );
  }

  return (
    <ThemeProvider defaultMode="light">
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '5px', background: '#f0f0f0', textAlign: 'center', zIndex: 100 }}>
          <button type="button" onClick={() => setMode('advanced')}>
            Switch to Advanced Mode
          </button>
        </div>
        <div style={{ flex: 1 }}>
          <SimpleApp />
        </div>
      </div>
    </ThemeProvider>
  );
}

export default App;
