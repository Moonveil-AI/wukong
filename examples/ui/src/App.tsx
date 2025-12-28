import { formatAllAgentOutputs, parseAgentOutput } from '@wukong/agent';
import {
  CapabilitiesPanel,
  ExamplePrompts,
  ThemeProvider,
  ThinkingBox,
  defaultExamplePrompts,
  useTheme,
  useWukongClient,
} from '@wukong/ui';
import type { FormEvent } from 'react';
import { useState } from 'react';
import './App.css';

function AgentUI() {
  const { theme, mode, setMode } = useTheme();
  const [inputValue, setInputValue] = useState('');
  const {
    messages,
    sendMessage,
    isExecuting,
    status,
    error,
    currentThinking,
    toolExecutions,
    sessionId,
  } = useWukongClient({
    apiUrl: (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001',
    restoreSession: true,
    transport: 'sse',
  });

  if (status === 'error') {
    return (
      <div className="error-screen">
        ❌ Failed to connect: {error}
        <p>Make sure the backend is running on port 3001</p>
      </div>
    );
  }

  if (status === 'initializing') {
    return <div className="loading-screen">🔄 Connecting...</div>;
  }

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (inputValue.trim()) {
      sendMessage(inputValue.trim());
      setInputValue('');
    }
  };

  const handlePromptSelect = (prompt: string) => {
    setInputValue(prompt);
  };

  return (
    <div className="agent-app" style={{ backgroundColor: theme.colors.background }}>
      <header
        className="agent-header"
        style={{
          backgroundColor: theme.colors.surface,
          borderBottom: `1px solid ${theme.colors.border}`,
        }}
      >
        <h1 style={{ color: theme.colors.text }}>🐒 Wukong Agent</h1>
        <div className="header-actions">
          <span style={{ color: theme.colors.textSecondary }}>Session: {sessionId}</span>
          <div className="theme-switcher">
            <button
              type="button"
              onClick={() => setMode('light')}
              className={mode === 'light' ? 'active' : ''}
            >
              ☀️
            </button>
            <button
              type="button"
              onClick={() => setMode('dark')}
              className={mode === 'dark' ? 'active' : ''}
            >
              🌙
            </button>
            <button
              type="button"
              onClick={() => setMode('auto')}
              className={mode === 'auto' ? 'active' : ''}
            >
              🔄
            </button>
          </div>
        </div>
      </header>

      <div className="agent-main">
        <aside
          className="agent-sidebar"
          style={{
            backgroundColor: theme.colors.surface,
            borderRight: `1px solid ${theme.colors.border}`,
          }}
        >
          <div className="sidebar-section">
            <CapabilitiesPanel
              capabilities={[
                {
                  category: 'Reasoning',
                  can: ['Multi-step planning', 'Context retention'],
                  cannot: ['Real-time web browsing'],
                },
                {
                  category: 'Tools',
                  can: ['Calculator operations'],
                  cannot: ['File system modifications'],
                },
              ]}
              style="list"
            />
          </div>

          <div className="sidebar-section">
            <ExamplePrompts
              examples={defaultExamplePrompts}
              onSelect={handlePromptSelect}
              layout="compact"
            />
          </div>
        </aside>

        <main className="agent-chat">
          {currentThinking && (
            <ThinkingBox thinking={currentThinking} streaming={isExecuting} autoScroll />
          )}

          <div className="messages-container">
            {messages.map((message) => {
              // Parse all assistant messages, passing streaming flag to handle incomplete blocks
              const parsed =
                message.role === 'assistant'
                  ? parseAgentOutput(message.content, message.streaming)
                  : null;
              const displayContent = parsed ? formatAllAgentOutputs(parsed) : message.content;

              return (
                <div
                  key={message.id}
                  className={`message message-${message.role}`}
                  style={{
                    backgroundColor:
                      message.role === 'user'
                        ? `${theme.colors.primary}15`
                        : message.role === 'system'
                          ? `${theme.colors.warning}15`
                          : 'transparent',
                  }}
                >
                  <div className="message-header">
                    <span style={{ color: theme.colors.textSecondary }}>
                      {message.role === 'user'
                        ? '👤 You'
                        : message.role === 'assistant'
                          ? '🐒 Agent'
                          : '💡 System'}
                    </span>
                    <span style={{ color: theme.colors.textSecondary }}>
                      {message.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="message-content" style={{ color: theme.colors.text }}>
                    {displayContent}
                    {message.streaming && <span className="cursor-blink">▊</span>}
                  </div>
                </div>
              );
            })}

            {toolExecutions.length > 0 && (
              <div
                className="tool-executions"
                style={{
                  backgroundColor: theme.colors.surface,
                  border: `1px solid ${theme.colors.border}`,
                }}
              >
                <h3>🔧 Tool Executions</h3>
                {toolExecutions.map((tool) => (
                  <div key={tool.id}>
                    <strong>{tool.name}</strong>: {tool.status}
                    {tool.result && <div>Result: {JSON.stringify(tool.result)}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div
            className="input-container"
            style={{
              backgroundColor: theme.colors.surface,
              borderTop: `1px solid ${theme.colors.border}`,
            }}
          >
            <form onSubmit={handleSubmit} className="input-form">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={isExecuting ? 'Agent is thinking...' : 'Type your message...'}
                disabled={isExecuting}
                className="message-input"
                style={{
                  backgroundColor: theme.colors.background,
                  color: theme.colors.text,
                  border: `1px solid ${theme.colors.border}`,
                }}
              />
              <button
                type="submit"
                disabled={!inputValue.trim() || isExecuting}
                className="send-button"
                style={{ backgroundColor: theme.colors.primary }}
              >
                {isExecuting ? '⏳' : '📤'} Send
              </button>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider defaultMode="light">
      <AgentUI />
    </ThemeProvider>
  );
}

export default App;
