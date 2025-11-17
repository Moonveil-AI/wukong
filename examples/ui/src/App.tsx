import type { WukongAgent } from '@wukong/agent';
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

// Agent capabilities - these would come from the actual agent configuration
const agentCapabilities: Capability[] = [
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
];

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

// Calculator tool implementation
const _calculatorTool = {
  metadata: {
    name: 'calculator',
    description: 'Perform basic mathematical calculations (add, subtract, multiply, divide)',
    version: '1.0.0',
    category: 'data' as const,
    riskLevel: 'low' as const,
    timeout: 30,
    requiresConfirmation: false,
    async: false,
    estimatedTime: 1,
  },
  schema: {
    type: 'object' as const,
    properties: {
      operation: {
        type: 'string',
        enum: ['add', 'subtract', 'multiply', 'divide'],
        description: 'The mathematical operation to perform',
      },
      a: {
        type: 'number',
        description: 'First number',
      },
      b: {
        type: 'number',
        description: 'Second number',
      },
    },
    required: ['operation', 'a', 'b'],
  },
  handler: (params: any) => {
    const { operation, a, b } = params;

    let result: number;
    switch (operation) {
      case 'add':
        result = a + b;
        break;
      case 'subtract':
        result = a - b;
        break;
      case 'multiply':
        result = a * b;
        break;
      case 'divide':
        if (b === 0) {
          return {
            success: false,
            error: 'Cannot divide by zero',
          };
        }
        result = a / b;
        break;
      default:
        return {
          success: false,
          error: `Unknown operation: ${operation}`,
        };
    }

    return {
      success: true,
      result,
      output: `${a} ${operation} ${b} = ${result}`,
    };
  },
};

function AgentUI() {
  const { theme, mode, setMode } = useTheme();
  const [_agent, _setAgent] = useState<WukongAgent | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [toolExecutions, setToolExecutions] = useState<ToolExecution[]>([]);
  const [_currentSessionId, _setCurrentSessionId] = useState<string | null>(null);
  const [agentStatus, setAgentStatus] = useState<'initializing' | 'ready' | 'error'>(
    'initializing',
  );
  const [_errorMessage, setErrorMessage] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const _streamingMessageRef = useRef<string>('');

  // New component states
  const [showPlan, setShowPlan] = useState(false);
  const [showExecutionPlan, setShowExecutionPlan] = useState(false);
  const [currentThinking, setCurrentThinking] = useState('');
  const [showThinking, setShowThinking] = useState(false);
  const [todos, setTodos] = useState<Todo[]>([]);

  // Initialize agent
  useEffect(() => {
    const initAgent = () => {
      try {
        // Note: In a real browser environment, we can't use the LocalAdapter directly
        // This is a placeholder that demonstrates the UI structure
        // In production, you'd communicate with a backend server that runs the agent

        setAgentStatus('ready');
        setMessages([
          {
            id: 'welcome',
            role: 'system',
            content:
              '🐒 Welcome to Wukong Agent! This is a demo UI showing the agent interface. To use the full agent capabilities, connect to a backend server running the Wukong agent.',
            timestamp: new Date(),
          },
        ]);

        // Initialize demo todos
        setTodos([
          {
            id: 'todo-1',
            title: 'Parse user request',
            status: 'completed',
            progress: 100,
          },
          {
            id: 'todo-2',
            title: 'Break down into steps',
            status: 'completed',
            progress: 100,
          },
          {
            id: 'todo-3',
            title: 'Execute calculations',
            status: 'in_progress',
            progress: 60,
            dependencies: ['todo-2'],
          },
          {
            id: 'todo-4',
            title: 'Format and return result',
            status: 'pending',
            dependencies: ['todo-3'],
          },
        ]);
      } catch (error) {
        console.error('Failed to initialize agent:', error);
        setAgentStatus('error');
        setErrorMessage(error instanceof Error ? error.message : 'Failed to initialize agent');
      }
    };

    initAgent();
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  });

  // Handle example prompt selection
  const handlePromptSelect = useCallback((prompt: ExamplePrompt) => {
    setInputValue(prompt.prompt);
  }, []);

  // Handle message submission
  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!inputValue.trim() || isExecuting) return;

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

      // Simulate agent response (in production, this would call the actual agent)
      try {
        // Show plan and thinking for demo
        if (
          userMessage.content.toLowerCase().includes('calculate') ||
          userMessage.content.toLowerCase().includes('multiply')
        ) {
          setShowPlan(true);
          setShowExecutionPlan(true);
          setShowThinking(true);
          setCurrentThinking(
            '# Analyzing Request\n\nUser wants to perform a calculation...\n\n## Breaking Down Steps\n\n1. Identify the operations needed\n2. Execute in correct order\n3. Format the result\n\n**Current Step:** Parsing mathematical expression...',
          );
        }

        // Add a streaming message placeholder
        const assistantMessageId = `assistant-${Date.now()}`;
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

        // Simulate streaming response
        const response = simulateAgentResponse(userMessage.content);

        for (const chunk of response.chunks) {
          await new Promise((resolve) => setTimeout(resolve, 30));
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId ? { ...msg, content: msg.content + chunk } : msg,
            ),
          );
        }

        // Mark streaming as complete
        setMessages((prev) =>
          prev.map((msg) => (msg.id === assistantMessageId ? { ...msg, streaming: false } : msg)),
        );

        // Simulate tool execution if the response involved tools
        if (response.usedTool) {
          const toolExec: ToolExecution = {
            id: `tool-${Date.now()}`,
            name: 'calculator',
            status: 'executing',
            parameters: response.toolParams,
            timestamp: new Date(),
          };
          setToolExecutions([toolExec]);

          await new Promise((resolve) => setTimeout(resolve, 500));

          setToolExecutions((prev) =>
            prev.map((t) =>
              t.id === toolExec.id ? { ...t, status: 'completed', result: response.toolResult } : t,
            ),
          );
        }
      } catch (error) {
        console.error('Error executing task:', error);
        setMessages((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            role: 'system',
            content: `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`,
            timestamp: new Date(),
          },
        ]);
      } finally {
        setIsExecuting(false);
      }
    },
    [inputValue, isExecuting],
  );

  // Simulate agent response (this would be replaced with actual agent execution)
  const simulateAgentResponse = (input: string) => {
    const lowerInput = input.toLowerCase();

    if (
      lowerInput.includes('multiply') ||
      lowerInput.includes('add') ||
      lowerInput.includes('calculate')
    ) {
      return {
        chunks: [
          "I'll help you with that calculation. ",
          'Let me break this down into steps:\n\n',
          "1. First, I'll multiply 15 by 8\n",
          '2. Then add 42 to the result\n\n',
          'Using the calculator tool...\n\n',
          '15 × 8 = 120\n',
          '120 + 42 = 162\n\n',
          'The final result is **162**.',
        ],
        usedTool: true,
        toolParams: { operation: 'multiply', a: 15, b: 8 },
        toolResult: { result: 120, output: '15 multiply 8 = 120' },
      };
    }

    if (lowerInput.includes('capabilities') || lowerInput.includes('can you')) {
      return {
        chunks: [
          "I'm Wukong, an AI agent with several capabilities:\n\n",
          '**Core Features:**\n',
          '• Multi-step reasoning to break down complex tasks\n',
          '• Conversation memory to maintain context\n',
          '• Real-time streaming responses\n\n',
          '**Tools:**\n',
          '• Calculator for mathematical operations\n',
          '• Custom tools can be added as needed\n\n',
          'I can help you with problem-solving, calculations, and general assistance. ',
          'Try asking me to perform a calculation or explain something!',
        ],
        usedTool: false,
      };
    }

    return {
      chunks: [
        'I understand your request. ',
        'As this is a demo UI, I can show you the interface, but full agent capabilities require a backend connection. ',
        'Try one of the example prompts to see how the interaction would work!',
      ],
      usedTool: false,
    };
  };

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
                ? 'Ready'
                : agentStatus === 'error'
                  ? 'Error'
                  : 'Initializing...'}
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
            <CapabilitiesPanel capabilities={agentCapabilities} compact={true} />
          </div>

          <div className="sidebar-section">
            <h2 style={{ color: theme.colors.text }}>Example Prompts</h2>
            <ExamplePrompts
              examples={examplePrompts}
              onSelect={handlePromptSelect}
              compact={true}
            />
          </div>

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
