import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { useTheme } from '../theme';
import type { Theme } from '../theme/types';
import { CapabilitiesPanel } from './CapabilitiesPanel';
import { ConfirmDialog } from './ConfirmDialog';
import { CostIndicator } from './CostIndicator';
import { DecisionLog } from './DecisionLog';
import { EscalateButton } from './EscalateButton';
import { ExamplePrompts } from './ExamplePrompts';
import { ExecutionPlan } from './ExecutionPlan';
import { FeedbackButtons } from './FeedbackButtons';
import { FeedbackForm } from './FeedbackForm';
import { MemorySettings } from './MemorySettings';
import { MetricsDashboard } from './MetricsDashboard';
import { ProgressBar } from './ProgressBar';
import { RetryButton } from './RetryButton';
import { SourceIndicator } from './SourceIndicator';
import { StatusIndicator } from './StatusIndicator';
import { StopButton } from './StopButton';
import { ThinkingBox } from './ThinkingBox';
import { TodoList } from './TodoList';
import { TrustScore } from './TrustScore';
import { UndoButton } from './UndoButton';
import { UpdateBanner } from './UpdateBanner';
import { WhyButton } from './WhyButton';

export interface AgentChatProps {
  config: any;
  theme?: 'light' | 'dark' | 'auto';
  showCapabilities?: boolean;
  showProgress?: boolean;
  enableFeedback?: boolean;
  onPlanReady?: (plan: any) => void;
  onProgress?: (progress: number) => void;
  onComplete?: (result: any) => void;
  layout?: {
    mobile: 'stack';
    tablet: 'sidebar';
    desktop: 'split';
  };
  breakpoints?: {
    mobile: number;
    tablet: number;
    desktop: number;
  };
  accessibility?: {
    enableKeyboardNavigation?: boolean;
    announceProgress?: boolean;
    highContrast?: boolean;
  };
  className?: string;
  initialMessages?: Message[];
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  sources?: Array<{
    id: string;
    title: string;
    url: string;
    type: 'web' | 'document' | 'knowledge' | 'api' | 'user' | 'memory';
  }>;
  thinking?: string;
}

/**
 * AgentChat - The all-in-one agent chat interface
 *
 * Implements Task 7.7: Complete Chat Interface
 */
export const AgentChat: React.FC<AgentChatProps> = ({
  config,
  theme: initialThemeMode = 'light',
  showCapabilities = true,
  showProgress = true,
  enableFeedback = true,
  onPlanReady,
  onProgress,
  onComplete,
  layout = {
    mobile: 'stack',
    tablet: 'sidebar',
    desktop: 'split',
  },
  breakpoints = {
    mobile: 640,
    tablet: 1024,
    desktop: 1280,
  },
  accessibility = {
    enableKeyboardNavigation: true,
    announceProgress: false,
    highContrast: false,
  },
  className = '',
  initialMessages = [],
}) => {
  // Handle theme initialization
  const { theme, setMode } = useTheme();

  useEffect(() => {
    if (initialThemeMode) {
      setMode(initialThemeMode);
    }
  }, [initialThemeMode, setMode]);

  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [isThinking, setIsThinking] = useState(false);
  const [thinkingContent, setThinkingContent] = useState('');
  const [progress, setProgress] = useState(0);
  const [currentLayout, setCurrentLayout] = useState<'stack' | 'sidebar' | 'split'>('split');
  const [isRunning, setIsRunning] = useState(false);
  const [announcement, setAnnouncement] = useState('');

  // UI State
  const [showSettings, setShowSettings] = useState(false);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Handle responsive layout
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width < breakpoints.mobile) {
        setCurrentLayout(layout.mobile);
      } else if (width < breakpoints.tablet) {
        setCurrentLayout(layout.tablet);
      } else {
        setCurrentLayout(layout.desktop);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [breakpoints, layout]);

  // Scroll to bottom of messages
  // biome-ignore lint/correctness/useExhaustiveDependencies: Scroll when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking, thinkingContent]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsRunning(true);
    setIsThinking(true);
    setThinkingContent('Analyzing request...');

    if (accessibility.announceProgress) {
      setAnnouncement('Agent is analyzing your request...');
    }

    // Simulate agent processing
    setTimeout(() => {
      setThinkingContent('Generating plan...');
      onProgress?.(20);
      setProgress(20);

      const plan = { title: 'Execution Plan', steps: [] };
      onPlanReady?.(plan);

      setTimeout(() => {
        setThinkingContent('Executing steps...\n\n1. analyzing_input\n2. fetching_data');
        onProgress?.(60);
        setProgress(60);

        setTimeout(() => {
          setThinkingContent('');
          setIsThinking(false);
          onProgress?.(100);
          setProgress(100);
          setIsRunning(false);

          const assistantMessage: Message = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: `I have processed your request: "${userMessage.content}". This is a simulated response.`,
            timestamp: Date.now(),
            sources: [
              { id: 'doc-1', title: 'Documentation', url: 'https://example.com/docs', type: 'web' },
              { id: 'kb-1', title: 'Knowledge Base', url: 'internal://kb/123', type: 'knowledge' },
            ],
            thinking: 'Analyzed input -> Found keywords -> Searched KB -> Generated response',
          };

          setMessages((prev) => [...prev, assistantMessage]);
          onComplete?.(assistantMessage);

          if (accessibility.announceProgress) {
            setAnnouncement('Agent execution completed. New message available.');
          }
        }, 1500);
      }, 1500);
    }, 1000);
  };

  const handleStop = () => {
    setConfirmAction({
      title: 'Stop Execution?',
      message: 'Are you sure you want to stop the current task? Partial progress may be lost.',
      onConfirm: () => {
        setIsRunning(false);
        setIsThinking(false);
        setThinkingContent('Stopped by user.');
        setShowConfirmDialog(false);
      },
    });
    setShowConfirmDialog(true);
  };

  const styles = getStyles(theme, currentLayout, accessibility.highContrast);

  return (
    <div className={`wukong-agent-chat ${className}`} style={styles.container}>
      <UpdateBanner
        update={{
          version: '1.1.0',
          title: 'New Features',
          description: 'We have improved the reasoning engine.',
          features: ['New chat interface', 'Improved reasoning engine'],
          type: 'minor',
        }}
        onDismiss={() => undefined}
      />

      {/* Left Sidebar (Desktop/Tablet) */}
      {(currentLayout === 'split' || currentLayout === 'sidebar') && (
        <div style={styles.sidebar}>
          <div style={styles.sidebarHeader}>
            <h3 style={{ margin: 0 }}>Agent Control</h3>
            <button
              type="button"
              onClick={() => setShowSettings(!showSettings)}
              style={styles.iconButton}
              aria-label="Settings"
            >
              ⚙️
            </button>
          </div>

          {showSettings && (
            <div style={styles.sidebarSection}>
              <MemorySettings
                retentionDays={30}
                onRetentionChange={() => undefined}
                rememberContext={true}
                onRememberContextChange={() => undefined}
                rememberUserPreferences={true}
                onRememberUserPreferencesChange={() => undefined}
                onClearMemory={() => undefined}
              />
            </div>
          )}

          {showCapabilities && (
            <CapabilitiesPanel
              capabilities={
                config.capabilities || [
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
                ]
              }
            />
          )}

          {showProgress && (
            <div style={styles.sidebarSection}>
              <StatusIndicator status={isRunning ? 'executing' : 'idle'} />
              {isRunning && <ProgressBar progress={progress} currentStep={2} totalSteps={5} />}
            </div>
          )}

          <div style={styles.sidebarSection}>
            <TrustScore
              score={92}
              factors={[
                {
                  label: 'Accuracy',
                  score: 95,
                  description: 'High accuracy in recent tasks',
                  impact: 'positive',
                },
                {
                  label: 'Safety',
                  score: 98,
                  description: 'No safety violations',
                  impact: 'positive',
                },
                {
                  label: 'Efficiency',
                  score: 85,
                  description: 'Room for token optimization',
                  impact: 'neutral',
                },
              ]}
            />
          </div>

          <div style={styles.sidebarSection}>
            <CostIndicator
              totalTokens={messages.length * 150}
              cost={messages.length * 0.002}
              currency="$"
            />
          </div>

          <div style={styles.sidebarSection}>
            <MetricsDashboard
              metrics={[
                {
                  label: 'Tasks Completed',
                  value: messages.filter((m) => m.role === 'assistant').length,
                },
                { label: 'Avg Response', value: '1.2s' },
              ]}
            />
          </div>
        </div>
      )}

      {/* Main Chat Area */}
      <div style={styles.mainContent}>
        <div style={styles.messagesContainer}>
          {messages.length === 0 ? (
            <div style={styles.welcomeContainer}>
              <h2 style={styles.welcomeTitle}>How can I help you today?</h2>
              <ExamplePrompts
                examples={[
                  {
                    id: '1',
                    title: 'Analysis',
                    prompt: 'Analyze this document',
                    category: 'Analysis',
                  },
                  {
                    id: '2',
                    title: 'Search',
                    prompt: 'Search for latest news',
                    category: 'Search',
                  },
                  { id: '3', title: 'Writing', prompt: 'Write a blog post', category: 'Writing' },
                ]}
                onSelect={(prompt) => setInput(prompt)}
              />
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                style={{
                  ...styles.message,
                  ...(msg.role === 'user' ? styles.userMessage : styles.assistantMessage),
                }}
              >
                <div style={styles.messageHeader}>
                  <strong>{msg.role === 'user' ? 'You' : 'Agent'}</strong>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={styles.timestamp}>
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </span>
                    {msg.role === 'user' && (
                      <UndoButton
                        onUndo={() => {
                          setMessages((prev) => prev.filter((m) => m.id !== msg.id));
                        }}
                      />
                    )}
                  </div>
                </div>

                <div style={styles.messageContent}>{msg.content}</div>

                {msg.sources && msg.sources.length > 0 && (
                  <div style={{ marginTop: '12px' }}>
                    <SourceIndicator sources={msg.sources} />
                  </div>
                )}

                {msg.role === 'assistant' && (
                  <div style={styles.messageActions}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {msg.thinking && <WhyButton explanation={msg.thinking} />}
                      <EscalateButton onEscalate={(option) => console.log('Escalate:', option)} />
                    </div>
                    {enableFeedback && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <RetryButton onRetry={() => console.log('Retry message', msg.id)} />
                        <FeedbackButtons
                          onFeedback={(type) => {
                            console.log('Feedback:', type);
                            if (type === 'thumbs-down') setShowFeedbackForm(true);
                          }}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}

          {isThinking && (
            <div style={styles.thinkingContainer}>
              <ThinkingBox thinking={thinkingContent} streaming autoScroll />
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <div style={styles.inputArea}>
          <form onSubmit={handleSubmit} style={styles.form}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message..."
              style={styles.input}
              disabled={isRunning}
              aria-label="Message input"
            />
            {isRunning ? (
              <StopButton onStop={handleStop} variant="default" />
            ) : (
              <button type="submit" style={styles.sendButton} disabled={!input.trim()}>
                Send
              </button>
            )}
          </form>
        </div>
      </div>

      {/* Right Sidebar (Split view only) */}
      {currentLayout === 'split' && (
        <div style={styles.rightSidebar}>
          <h3>Execution Details</h3>
          <ExecutionPlan
            steps={[
              {
                id: '1',
                title: 'Analyze Request',
                description: 'Analyzing user input',
                risk: { level: 'low', description: 'None' },
              },
              {
                id: '2',
                title: 'Execute Action',
                description: 'Running tools',
                risk: { level: 'medium', description: 'External API call' },
              },
              {
                id: '3',
                title: 'Finalize',
                description: 'Formatting response',
                risk: { level: 'low', description: 'None' },
              },
            ]}
            showRisks
          />

          <div style={{ marginTop: '20px' }}>
            <h3>Decisions</h3>
            <DecisionLog
              decisions={[
                {
                  id: '1',
                  timestamp: Date.now(),
                  title: 'Search vs Database',
                  description: 'Selected search tool over database',
                  reasoning: 'Query requires recent information',
                },
              ]}
            />
          </div>

          <div style={{ marginTop: '20px' }}>
            <h3>Tasks</h3>
            <TodoList
              todos={[
                { id: '1', title: 'Initialize context', status: 'completed' },
                {
                  id: '2',
                  title: 'Process input',
                  status: progress > 20 ? 'completed' : 'pending',
                },
                {
                  id: '3',
                  title: 'Generate response',
                  status: progress > 80 ? 'completed' : 'pending',
                },
              ]}
            />
          </div>
        </div>
      )}

      {/* Dialogs */}
      <ConfirmDialog
        open={showConfirmDialog}
        title={confirmAction?.title || ''}
        message={confirmAction?.message || ''}
        risks={['Progress will be lost', 'Context may need to be rebuilt']}
        onConfirm={() => confirmAction?.onConfirm()}
        onCancel={() => setShowConfirmDialog(false)}
      />

      {showFeedbackForm && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <FeedbackForm
              onSubmit={(data) => {
                console.log('Detailed feedback:', data);
                setShowFeedbackForm(false);
              }}
              onCancel={() => setShowFeedbackForm(false)}
            />
          </div>
        </div>
      )}

      {/* Accessibility Live Region */}
      <output
        aria-live="polite"
        aria-atomic="true"
        style={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          padding: 0,
          margin: '-1px',
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          border: 0,
        }}
      >
        {announcement}
      </output>
    </div>
  );
};

function getStyles(theme: Theme, layout: 'stack' | 'sidebar' | 'split', highContrast = false) {
  const isStack = layout === 'stack';

  // Helper for high contrast values
  const hc = <T,>(normal: T, contrast: T): T => (highContrast ? contrast : normal);
  const border = hc(theme.colors.border, '#000000');

  return {
    container: {
      display: 'flex',
      flexDirection: (isStack ? 'column' : 'row') as 'column' | 'row',
      height: '100%',
      minHeight: '600px',
      backgroundColor: hc(theme.colors.background, '#ffffff'),
      color: hc(theme.colors.text, '#000000'),
      fontFamily: theme.typography.fontFamily,
      overflow: 'hidden',
      position: 'relative' as const,
    },
    sidebar: {
      width: isStack ? '100%' : '280px',
      borderRight: isStack ? 'none' : `1px solid ${border}`,
      borderBottom: isStack ? `1px solid ${border}` : 'none',
      padding: `${theme.spacing.md}px`,
      backgroundColor: hc(theme.colors.surface, '#ffffff'),
      overflowY: 'auto' as const,
      display: 'flex',
      flexDirection: 'column' as const,
      gap: `${theme.spacing.md}px`,
      zIndex: 10,
    },
    sidebarHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '10px',
    },
    iconButton: {
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      fontSize: '1.2em',
      padding: '4px',
      color: hc('inherit', '#000000'),
    },
    sidebarSection: {
      marginBottom: `${theme.spacing.md}px`,
      paddingBottom: `${theme.spacing.md}px`,
      borderBottom: `1px solid ${highContrast ? '#000000' : `${theme.colors.border}33`}`,
    },
    mainContent: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column' as const,
      height: '100%',
      position: 'relative' as const,
    },
    messagesContainer: {
      flex: 1,
      padding: `${theme.spacing.md}px`,
      overflowY: 'auto' as const,
      display: 'flex',
      flexDirection: 'column' as const,
      gap: `${theme.spacing.md}px`,
      backgroundColor: hc('transparent', '#ffffff'),
    },
    welcomeContainer: {
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      gap: `${theme.spacing.lg}px`,
    },
    welcomeTitle: {
      fontSize: `${theme.typography.fontSize.xl}px`,
      fontWeight: theme.typography.fontWeight.bold,
      color: hc(theme.colors.text, '#000000'),
    },
    message: {
      padding: `${theme.spacing.md}px`,
      borderRadius: `${theme.borderRadius.md}px`,
      maxWidth: isStack ? '95%' : '85%',
      position: 'relative' as const,
      border: highContrast ? '1px solid #000000' : 'none',
    },
    userMessage: {
      alignSelf: 'flex-end',
      backgroundColor: hc(theme.colors.primary, '#000000'),
      color: '#ffffff',
    },
    assistantMessage: {
      alignSelf: 'flex-start',
      backgroundColor: hc(theme.colors.surface, '#ffffff'),
      border: `1px solid ${border}`,
      width: '100%',
      color: hc(theme.colors.text, '#000000'),
    },
    messageHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: `${theme.spacing.xs}px`,
      fontSize: `${theme.typography.fontSize.xs}px`,
      opacity: highContrast ? 1 : 0.8,
      color: hc('inherit', '#000000'),
    },
    timestamp: {
      marginLeft: `${theme.spacing.sm}px`,
    },
    messageContent: {
      fontSize: `${theme.typography.fontSize.md}px`,
      lineHeight: 1.5,
      whiteSpace: 'pre-wrap' as const,
      color: hc('inherit', '#000000'),
    },
    messageActions: {
      marginTop: `${theme.spacing.md}px`,
      paddingTop: `${theme.spacing.sm}px`,
      borderTop: `1px solid ${highContrast ? '#000000' : `${theme.colors.border}33`}`,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexWrap: 'wrap' as const,
      gap: '8px',
    },
    thinkingContainer: {
      margin: `${theme.spacing.sm}px 0`,
      borderLeft: `3px solid ${hc(theme.colors.primary, '#000000')}`,
      paddingLeft: `${theme.spacing.sm}px`,
    },
    inputArea: {
      padding: `${theme.spacing.md}px`,
      borderTop: `1px solid ${border}`,
      backgroundColor: hc(theme.colors.surface, '#ffffff'),
    },
    form: {
      display: 'flex',
      gap: `${theme.spacing.sm}px`,
    },
    input: {
      flex: 1,
      padding: isStack ? `${theme.spacing.md}px` : `${theme.spacing.sm}px ${theme.spacing.md}px`,
      borderRadius: `${theme.borderRadius.md}px`,
      border: `1px solid ${border}`,
      fontSize: `${theme.typography.fontSize.md}px`,
      outline: 'none',
      backgroundColor: hc(theme.colors.background, '#ffffff'),
      color: hc(theme.colors.text, '#000000'),
    },
    sendButton: {
      padding: isStack
        ? `${theme.spacing.md}px ${theme.spacing.xl}px`
        : `${theme.spacing.sm}px ${theme.spacing.lg}px`,
      borderRadius: `${theme.borderRadius.md}px`,
      backgroundColor: hc(theme.colors.primary, '#000000'),
      color: '#ffffff',
      border: 'none',
      cursor: 'pointer',
      fontWeight: theme.typography.fontWeight.medium,
    },
    rightSidebar: {
      width: '320px',
      borderLeft: `1px solid ${border}`,
      padding: `${theme.spacing.md}px`,
      backgroundColor: hc(theme.colors.surface, '#ffffff'),
      overflowY: 'auto' as const,
      display: 'flex',
      flexDirection: 'column' as const,
      gap: `${theme.spacing.lg}px`,
      color: hc(theme.colors.text, '#000000'),
    },
    modalOverlay: {
      position: 'absolute' as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000,
    },
    modalContent: {
      backgroundColor: hc(theme.colors.surface, '#ffffff'),
      padding: `${theme.spacing.lg}px`,
      borderRadius: `${theme.borderRadius.md}px`,
      boxShadow: theme.shadows.lg,
      width: '90%',
      maxWidth: '500px',
      display: 'flex',
      flexDirection: 'column' as const,
      border: highContrast ? '2px solid #000000' : 'none',
    },
  };
}
