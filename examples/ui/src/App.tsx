import {
  CapabilitiesPanel,
  type Capability,
  type ExamplePrompt,
  ExamplePrompts,
  ExecutionPlan,
  type ExecutionStep,
  PlanPreview,
  type ThemeMode,
  ThemeProvider,
  ThinkingBox,
  type Todo,
  TodoList,
  useTheme,
} from '@wukong/ui';
import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import './App.css';
import { type AgentEvent, type WukongClient, getClient } from './api/client';

// Message types for the chat interface
interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  streaming?: boolean;
  sessionId?: string;
  stepNumber?: number;
}

interface ToolExecution {
  id: string;
  name: string;
  status: 'executing' | 'completed' | 'failed';
  parameters?: any;
  result?: any;
  error?: string;
  timestamp: Date;
}

// Example prompts to help users get started
const examplePrompts: ExamplePrompt[] = [
  {
    id: 'calc-example',
    title: 'Perform calculations',
    prompt: 'Calculate the result of 15 multiplied by 8, then add 42 to it',
    category: 'tools',
    tags: ['math', 'tools'],
  },
  {
    id: 'multi-step',
    title: 'Multi-step reasoning',
    prompt: 'What is the square root of 144, then multiply it by 5, and finally subtract 10?',
    category: 'reasoning',
    tags: ['math', 'reasoning'],
  },
  {
    id: 'explain',
    title: 'Explain capabilities',
    prompt: 'What can you help me with? What are your capabilities?',
    category: 'general',
    tags: ['help'],
  },
];

function AgentUI() {
  const { theme, mode, setMode } = useTheme();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [toolExecutions, setToolExecutions] = useState<ToolExecution[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [agentStatus, setAgentStatus] = useState<'initializing' | 'ready' | 'error'>(
    'initializing',
  );
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const clientRef = useRef<WukongClient | null>(null);
  const currentMessageIdRef = useRef<string | null>(null);

  // New component states
  const [showPlan, setShowPlan] = useState(false);
  const [showExecutionPlan, setShowExecutionPlan] = useState(false);
  const [currentThinking, setCurrentThinking] = useState('');
  const [showThinking, setShowThinking] = useState(false);
  const [todos, setTodos] = useState<Todo[]>([]);

  // Initialize client and session
  useEffect(() => {
    let isActive = true; // Flag to prevent state updates after cleanup

    const initClient = async () => {
      try {
        // Get client instance
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
        const client = getClient(apiUrl);

        if (!isActive) return;
        clientRef.current = client;

        // Check health
        await client.healthCheck();
        if (!isActive) return;

        // Get capabilities
        const caps = await client.getCapabilities();
        if (!isActive) return;
        setCapabilities(caps);

        // Create a session
        const session = await client.createSession('ui-user');
        console.log('Session response:', session);
        console.log('Session ID:', session.id);
        if (!isActive) return;
        setCurrentSessionId(session.id);

        // Connect to SSE for streaming events (check isActive first)
        if (!isActive) return;
        client.connectSSE(session.id);

        // Set up event handler
        const eventHandler = (event: AgentEvent) => {
          handleAgentEvent(event);
        };
        client.on(eventHandler);

        setAgentStatus('ready');
        setMessages([
          {
            id: 'welcome',
            role: 'system',
            content: `🐒 Welcome to Wukong Agent! Connected to backend server. Session ID: ${session.id}`,
            timestamp: new Date(),
          },
        ]);
      } catch (error) {
        console.error('Failed to initialize client:', error);
        setAgentStatus('error');
        setErrorMessage(error instanceof Error ? error.message : 'Failed to connect to server');
        setMessages([
          {
            id: 'error',
            role: 'system',
            content: `❌ Failed to connect to server. Make sure the backend is running on port 3001. Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            timestamp: new Date(),
          },
        ]);
      }
    };

    initClient();

    // Cleanup on unmount
    return () => {
      isActive = false; // Prevent any pending async operations from updating state
      if (clientRef.current) {
        clientRef.current.disconnect();
      }
    };
  }, []);

  // Auto-scroll to bottom when new messages arrive
  // biome-ignore lint/correctness/useExhaustiveDependencies: We want to scroll when messages changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle agent events
  const handleAgentEvent = useCallback((event: AgentEvent) => {
    console.log('Agent event:', event);

    switch (event.type) {
      case 'llm:started':
        setShowThinking(true);
        setCurrentThinking('🤖 LLM is thinking...');
        break;

      case 'llm:streaming':
        if (event.text && currentMessageIdRef.current) {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === currentMessageIdRef.current
                ? { ...msg, content: msg.content + event.text }
                : msg,
            ),
          );
        }
        break;

      case 'llm:complete':
        setShowThinking(false);
        if (currentMessageIdRef.current) {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === currentMessageIdRef.current ? { ...msg, streaming: false } : msg,
            ),
          );
        }
        break;

      case 'step:started':
        console.log('Step started:', event.step);
        // Update thinking box with step info
        if (event.step.reasoning) {
          setCurrentThinking(event.step.reasoning);
          setShowThinking(true);
        }
        break;

      case 'step:completed':
        console.log('Step completed:', event.step);
        break;

      case 'tool:executing': {
        const executingTool: ToolExecution = {
          id: `${event.sessionId}-${event.toolName}-${Date.now()}`,
          name: event.toolName,
          status: 'executing',
          parameters: event.parameters,
          timestamp: new Date(),
        };
        setToolExecutions((prev) => [...prev, executingTool]);
        break;
      }

      case 'tool:completed':
        setToolExecutions((prev) =>
          prev.map((tool) =>
            tool.name === event.toolName && tool.status === 'executing'
              ? { ...tool, status: 'completed', result: event.result }
              : tool,
          ),
        );
        break;

      case 'agent:complete':
        setIsExecuting(false);
        setShowThinking(false);

        // Add final result message if needed
        if (event.result && currentMessageIdRef.current) {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === currentMessageIdRef.current ? { ...msg, streaming: false } : msg,
            ),
          );
        }
        currentMessageIdRef.current = null;
        break;

      case 'agent:error':
        setIsExecuting(false);
        setShowThinking(false);
        setMessages((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            role: 'system',
            content: `❌ Error: ${event.error}`,
            timestamp: new Date(),
          },
        ]);
        currentMessageIdRef.current = null;
        break;
    }
  }, []);

  // Handle example prompt selection
  const handlePromptSelect = useCallback((prompt: ExamplePrompt) => {
    setInputValue(prompt.prompt);
  }, []);

  // Handle message submission
  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!inputValue.trim() || isExecuting || !currentSessionId || !clientRef.current) {
        return;
      }

      const userMessage: Message = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: inputValue.trim(),
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setInputValue('');
      setIsExecuting(true);
      setToolExecutions([]);

      try {
        // Add a streaming message placeholder
        const assistantMessageId = `assistant-${Date.now()}`;
        currentMessageIdRef.current = assistantMessageId;

        setMessages((prev) => [
          ...prev,
          {
            id: assistantMessageId,
            role: 'assistant',
            content: '',
            timestamp: new Date(),
            streaming: true,
          },
        ]);

        // Execute task via REST API (events will come via SSE)
        await clientRef.current.execute(currentSessionId, {
          goal: userMessage.content,
          maxSteps: 10,
          mode: 'auto',
        });

        // Note: The execution happens asynchronously, and we receive updates via SSE
        // The agent:complete or agent:error event will set isExecuting to false
      } catch (error) {
        console.error('Error executing task:', error);
        setIsExecuting(false);
        setMessages((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            role: 'system',
            content: `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`,
            timestamp: new Date(),
          },
        ]);
        currentMessageIdRef.current = null;
      }
    },
    [inputValue, isExecuting, currentSessionId],
  );

  const handleModeChange = (newMode: ThemeMode) => {
    setMode(newMode);
  };

  return (
    <div className="agent-app" style={{ backgroundColor: theme.colors.background }}>
      {/* Header */}
      <header
        className="agent-header"
        style={{
          backgroundColor: theme.colors.surface,
          borderBottom: `1px solid ${theme.colors.border}`,
        }}
      >
        <div className="header-content">
          <h1 style={{ color: theme.colors.text }}>🐒 Wukong Agent</h1>
          <div className="header-actions">
            <div
              className="status-indicator"
              style={{
                color:
                  agentStatus === 'ready'
                    ? '#10b981'
                    : agentStatus === 'error'
                      ? '#ef4444'
                      : '#f59e0b',
              }}
            >
              <span className="status-dot" />
              {agentStatus === 'ready'
                ? 'Connected'
                : agentStatus === 'error'
                  ? `Error: ${errorMessage}`
                  : 'Connecting...'}
            </div>
            <div className="theme-switcher">
              <button
                type="button"
                onClick={() => handleModeChange('light')}
                className={mode === 'light' ? 'active' : ''}
                title="Light mode"
              >
                ☀️
              </button>
              <button
                type="button"
                onClick={() => handleModeChange('dark')}
                className={mode === 'dark' ? 'active' : ''}
                title="Dark mode"
              >
                🌙
              </button>
              <button
                type="button"
                onClick={() => handleModeChange('auto')}
                className={mode === 'auto' ? 'active' : ''}
                title="Auto mode"
              >
                🔄
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="agent-main">
        {/* Sidebar */}
        <aside
          className="agent-sidebar"
          style={{
            backgroundColor: theme.colors.surface,
            borderRight: `1px solid ${theme.colors.border}`,
          }}
        >
          <div className="sidebar-section">
            <h2 style={{ color: theme.colors.text }}>Capabilities</h2>
            <CapabilitiesPanel
              capabilities={
                capabilities.length > 0
                  ? capabilities
                  : [
                      {
                        id: 'reasoning',
                        name: 'Multi-Step Reasoning',
                        description: 'Break down complex tasks into logical steps',
                        enabled: true,
                        category: 'core',
                      },
                      {
                        id: 'memory',
                        name: 'Conversation Memory',
                        description: 'Remember context from previous messages',
                        enabled: true,
                        category: 'core',
                      },
                      {
                        id: 'tools',
                        name: 'Tool Execution',
                        description: 'Execute custom tools and functions',
                        enabled: true,
                        category: 'tools',
                      },
                      {
                        id: 'streaming',
                        name: 'Real-time Streaming',
                        description: 'Stream responses as they are generated',
                        enabled: true,
                        category: 'core',
                      },
                    ]
              }
              compact={true}
            />
          </div>

          <div className="sidebar-section">
            <h2 style={{ color: theme.colors.text }}>Example Prompts</h2>
            <ExamplePrompts
              examples={examplePrompts}
              onSelect={handlePromptSelect}
              compact={true}
            />
          </div>

          {todos.length > 0 && (
            <div className="sidebar-section">
              <h2 style={{ color: theme.colors.text }}>Current Tasks</h2>
              <TodoList
                todos={todos}
                groupBy="status"
                showProgress={true}
                showDependencies={true}
                onUpdate={(todoId, updates) => {
                  setTodos((prev) => prev.map((t) => (t.id === todoId ? { ...t, ...updates } : t)));
                }}
              />
            </div>
          )}
        </aside>

        {/* Main chat area */}
        <main className="agent-chat">
          {/* Before Execution Components */}
          {showPlan && (
            <PlanPreview
              plan={{
                title: 'Calculation Task Plan',
                description: 'Perform mathematical operations step by step',
                steps: [
                  {
                    id: 'step-1',
                    description: 'Parse the mathematical expression from user input',
                    type: 'query',
                  },
                  {
                    id: 'step-2',
                    description: 'Execute multiplication: 15 × 8',
                    type: 'action',
                    dependencies: ['step-1'],
                  },
                  {
                    id: 'step-3',
                    description: 'Add 42 to the result',
                    type: 'action',
                    dependencies: ['step-2'],
                  },
                  {
                    id: 'step-4',
                    description: 'Format and return the final result',
                    type: 'query',
                    dependencies: ['step-3'],
                  },
                ],
                estimatedTime: 3,
                estimatedCost: 0.002,
              }}
              onAccept={() => setShowPlan(false)}
              onCancel={() => {
                setShowPlan(false);
                setIsExecuting(false);
              }}
            />
          )}

          {showExecutionPlan && (
            <ExecutionPlan
              steps={
                [
                  {
                    id: 'exec-1',
                    title: 'Parse Expression',
                    description: 'Extract numbers and operations from the user request',
                    estimatedTime: 1,
                  },
                  {
                    id: 'exec-2',
                    title: 'Execute Multiplication',
                    description: 'Calculate 15 × 8 using the calculator tool',
                    risk: {
                      level: 'low',
                      description: 'Simple arithmetic operation with no side effects',
                    },
                    estimatedTime: 1,
                  },
                  {
                    id: 'exec-3',
                    title: 'Add Result',
                    description: 'Add 42 to the multiplication result',
                    risk: {
                      level: 'low',
                      description: 'Simple arithmetic operation with no side effects',
                    },
                    estimatedTime: 1,
                  },
                ] as ExecutionStep[]
              }
              showRisks={true}
              showEstimates={true}
              onAccept={() => setShowExecutionPlan(false)}
              onCancel={() => {
                setShowExecutionPlan(false);
                setIsExecuting(false);
              }}
            />
          )}

          {showThinking && currentThinking && (
            <ThinkingBox
              thinking={currentThinking}
              streaming={isExecuting}
              autoScroll={true}
              collapsible={true}
              showTimestamp={true}
              onClose={() => setShowThinking(false)}
            />
          )}

          {/* Messages */}
          <div className="messages-container">
            {messages.map((message) => (
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
                  <span className="message-role" style={{ color: theme.colors.textSecondary }}>
                    {message.role === 'user'
                      ? '👤 You'
                      : message.role === 'assistant'
                        ? '🐒 Agent'
                        : '💡 System'}
                  </span>
                  <span className="message-time" style={{ color: theme.colors.textSecondary }}>
                    {message.timestamp.toLocaleTimeString()}
                  </span>
                </div>
                <div className="message-content" style={{ color: theme.colors.text }}>
                  {message.content}
                  {message.streaming && <span className="cursor-blink">▊</span>}
                </div>
              </div>
            ))}

            {/* Tool executions */}
            {toolExecutions.length > 0 && (
              <div
                className="tool-executions"
                style={{
                  backgroundColor: theme.colors.surface,
                  border: `1px solid ${theme.colors.border}`,
                }}
              >
                <h3 style={{ color: theme.colors.text }}>🔧 Tool Executions</h3>
                {toolExecutions.map((tool) => (
                  <div key={tool.id} className="tool-execution">
                    <div className="tool-header">
                      <span style={{ color: theme.colors.text }}>{tool.name}</span>
                      <span
                        className={`tool-status tool-status-${tool.status}`}
                        style={{
                          color:
                            tool.status === 'completed'
                              ? '#10b981'
                              : tool.status === 'failed'
                                ? '#ef4444'
                                : '#f59e0b',
                        }}
                      >
                        {tool.status}
                      </span>
                    </div>
                    {tool.parameters && (
                      <div className="tool-details" style={{ color: theme.colors.textSecondary }}>
                        <strong>Parameters:</strong> {JSON.stringify(tool.parameters)}
                      </div>
                    )}
                    {tool.result && (
                      <div className="tool-details" style={{ color: theme.colors.textSecondary }}>
                        <strong>Result:</strong> {JSON.stringify(tool.result)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
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
                disabled={isExecuting || agentStatus !== 'ready'}
                className="message-input"
                style={{
                  backgroundColor: theme.colors.background,
                  color: theme.colors.text,
                  border: `1px solid ${theme.colors.border}`,
                }}
              />
              <button
                type="submit"
                disabled={!inputValue.trim() || isExecuting || agentStatus !== 'ready'}
                className="send-button"
                style={{
                  backgroundColor: theme.colors.primary,
                  color: '#ffffff',
                }}
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
    <ThemeProvider defaultMode="auto">
      <AgentUI />
    </ThemeProvider>
  );
}

export default App;
