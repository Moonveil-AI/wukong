/**
 * useWukongClient hook for React applications
 *
 * Provides a high-level React hook for connecting to and interacting with a Wukong server.
 * Handles session management, real-time communication via SSE/WebSocket, and state management.
 *
 * @example
 * ```typescript
 * function App() {
 *   const { messages, sendMessage, isExecuting, status } = useWukongClient({
 *     apiUrl: 'http://localhost:3001',
 *     restoreSession: true
 *   });
 *
 *   return <Chat messages={messages} onSend={sendMessage} />;
 * }
 * ```
 */

import type { AgentEvent } from '@wukong/client';
import { WukongClient } from '@wukong/client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSessionPersistence } from './useSessionPersistence';

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  streaming?: boolean;
}

export interface ToolExecution {
  id: string;
  name: string;
  status: 'executing' | 'completed' | 'failed';
  parameters?: any;
  result?: any;
  error?: string;
  timestamp: Date;
}

export interface UseWukongClientOptions {
  /** API server URL */
  apiUrl: string;

  /** User ID for session creation */
  userId?: string;

  /** Auto-connect on mount (default: true) */
  autoConnect?: boolean;

  /** Restore previous session from URL/localStorage (default: false) */
  restoreSession?: boolean;

  /** Session persistence strategy */
  persistenceStrategy?: 'url' | 'localStorage' | 'both';

  /** Transport method */
  transport?: 'sse' | 'websocket';
}

export interface UseWukongClientResult {
  /** Client instance */
  client: WukongClient | null;

  /** Current session ID */
  sessionId: string | null;

  /** Connection status */
  status: 'initializing' | 'ready' | 'error' | 'disconnected';

  /** Error if any */
  error: string | null;

  /** Chat messages */
  messages: Message[];

  /** Whether agent is currently executing */
  isExecuting: boolean;

  /** Send a message */
  sendMessage: (content: string) => Promise<void>;

  /** Stop current execution */
  stopExecution: () => Promise<void>;

  /** Disconnect and cleanup */
  disconnect: () => void;

  /** Current thinking/reasoning text */
  currentThinking: string | null;

  /** Tool executions */
  toolExecutions: ToolExecution[];
}

export function useWukongClient(options: UseWukongClientOptions): UseWukongClientResult {
  const {
    apiUrl,
    userId = 'default-user',
    autoConnect = true,
    restoreSession = false,
    persistenceStrategy = 'url',
    transport = 'sse',
  } = options;

  const [client, setClient] = useState<WukongClient | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [status, setStatus] = useState<'initializing' | 'ready' | 'error' | 'disconnected'>(
    'initializing',
  );
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [currentThinking, setCurrentThinking] = useState<string | null>(null);
  const [toolExecutions, setToolExecutions] = useState<ToolExecution[]>([]);

  const currentMessageIdRef = useRef<string | null>(null);
  const clientRef = useRef<WukongClient | null>(null);
  const initializingRef = useRef(false);

  const { getPersistedSessionId, persistSessionId } = useSessionPersistence({
    strategy: persistenceStrategy,
    queryParam: 'sessionId',
  });

  // Initialize client and session
  useEffect(() => {
    if (!autoConnect) return;

    let isActive = true;
    let currentClient: WukongClient | null = null;

    // Handle agent events - defined inside useEffect to avoid stale closures
    const handleEvent = (event: AgentEvent) => {
      if (!isActive) return;

      switch (event.type) {
        case 'llm:started':
          console.log(
            '[useWukongClient] llm:started, currentMessageIdRef:',
            currentMessageIdRef.current,
          );
          setCurrentThinking('🤖 LLM is thinking...');
          // Create a new message for this step if one doesn't exist
          if (!currentMessageIdRef.current) {
            const newMessage: Message = {
              id: `assistant-${Date.now()}`,
              role: 'assistant',
              content: '',
              timestamp: new Date(),
              streaming: true,
            };
            console.log('[useWukongClient] Creating new message:', newMessage.id);
            setMessages((prev) => [...prev, newMessage]);
            currentMessageIdRef.current = newMessage.id;
          }
          break;

        case 'llm:streaming':
          if (event.text && currentMessageIdRef.current) {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === currentMessageIdRef.current
                  ? {
                      ...msg,
                      // Use fullText if available (complete text), otherwise append delta
                      content:
                        event.fullText !== undefined ? event.fullText : msg.content + event.text,
                      streaming: true,
                    }
                  : msg,
              ),
            );
          }
          break;

        case 'llm:complete':
          console.log(
            '[useWukongClient] llm:complete, currentMessageIdRef:',
            currentMessageIdRef.current,
          );
          setCurrentThinking(null);
          if (currentMessageIdRef.current) {
            setMessages((prev) => {
              const updated = prev.map((msg) =>
                msg.id === currentMessageIdRef.current ? { ...msg, streaming: false } : msg,
              );
              console.log(
                '[useWukongClient] After llm:complete, streaming status:',
                updated.map((m) => ({ id: m.id.substring(0, 20), streaming: m.streaming })),
              );
              return updated;
            });
            // Don't clear ref here - wait for agent:progress
          }
          break;

        case 'agent:progress':
        case 'step:completed': {
          // Mark the current message as no longer streaming
          console.log(
            '[useWukongClient] agent:progress received, currentMessageIdRef:',
            currentMessageIdRef.current,
          );
          if (currentMessageIdRef.current) {
            setMessages((prev) => {
              const updated = prev.map((msg) =>
                msg.id === currentMessageIdRef.current ? { ...msg, streaming: false } : msg,
              );
              console.log(
                '[useWukongClient] After agent:progress, streaming status:',
                updated.map((m) => ({ id: m.id.substring(0, 20), streaming: m.streaming })),
              );
              return updated;
            });
            // Clear the ref so the next llm:started will create a new message
            console.log('[useWukongClient] Clearing currentMessageIdRef');
            currentMessageIdRef.current = null;
          }
          break;
        }

        case 'tool:executing': {
          const exec: ToolExecution = {
            id: `${event.sessionId}-${event.toolName}-${Date.now()}`,
            name: event.toolName,
            status: 'executing',
            parameters: event.parameters,
            timestamp: new Date(),
          };
          setToolExecutions((prev) => [...prev, exec]);
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
          setCurrentThinking(null);
          if (currentMessageIdRef.current) {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === currentMessageIdRef.current ? { ...msg, streaming: false } : msg,
              ),
            );
            currentMessageIdRef.current = null;
          }
          break;

        case 'agent:error':
          setIsExecuting(false);
          setCurrentThinking(null);
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
    };

    const init = async () => {
      // Prevent duplicate initialization (especially in React StrictMode)
      if (initializingRef.current) {
        console.log('[useWukongClient] Already initializing, skipping...');
        return;
      }

      initializingRef.current = true;

      try {
        const newClient = new WukongClient(apiUrl);
        currentClient = newClient;
        clientRef.current = newClient;
        if (!isActive) return;

        setClient(newClient);

        // Check health
        await newClient.healthCheck();
        if (!isActive) return;

        // Try to restore session or create new one
        let session: { id: string };
        let isRestoredSession = false;

        if (restoreSession) {
          const existingSessionId = getPersistedSessionId();
          if (existingSessionId) {
            try {
              session = await newClient.getSession(existingSessionId);
              isRestoredSession = true;
            } catch {
              session = await newClient.createSession(userId);
            }
          } else {
            session = await newClient.createSession(userId);
          }
        } else {
          session = await newClient.createSession(userId);
        }

        if (!isActive) return;
        setSessionId(session.id);
        persistSessionId(session.id);

        // Connect transport
        if (transport === 'sse') {
          newClient.connectSSE(session.id);
        } else {
          await newClient.connectWebSocket(session.id);
        }

        // Setup event handler
        newClient.on(handleEvent);

        // Load history if restored
        if (isRestoredSession) {
          const historyData = await newClient.getHistory(session.id);
          if (isActive && historyData.history.length > 0) {
            const restoredMessages: Message[] = [];

            // Helper function to extract goal from llmPrompt
            const extractGoalFromPrompt = (llmPrompt: string | undefined): string | null => {
              if (!llmPrompt) return null;
              const match = llmPrompt.match(
                /<goal_description>\s*([\s\S]*?)\s*<\/goal_description>/,
              );
              return match?.[1]?.trim() || null;
            };

            // Helper function to extract reasoning and action from llmResponse
            const extractStepInfo = (
              llmResponse: string | undefined,
            ): { reasoning?: string; action?: string; messageToUser?: string } | null => {
              if (!llmResponse) return null;
              try {
                const responseMatch = llmResponse.match(
                  /<final_output>\s*([\s\S]*?)\s*<\/final_output>/,
                );
                if (responseMatch?.[1]) {
                  const parsed = JSON.parse(responseMatch[1]);
                  return {
                    reasoning: parsed.reasoning,
                    action: parsed.action,
                    messageToUser: parsed.message_to_user,
                  };
                }
              } catch (error) {
                console.error('Failed to parse llmResponse:', error);
              }
              return null;
            };

            // Track goals and build message history
            let lastGoal: string | null = null;

            for (const step of historyData.history) {
              // Skip failed or discarded steps
              if (step.status !== 'completed' || step.discarded) continue;

              // Extract current goal from llmPrompt
              const currentGoal = extractGoalFromPrompt(step.llmPrompt);

              // If goal changed, add a new user message
              if (currentGoal && currentGoal !== lastGoal) {
                restoredMessages.push({
                  id: `user-goal-${step.id}`,
                  role: 'user',
                  content: currentGoal,
                  timestamp: new Date(step.createdAt),
                  streaming: false,
                });
                lastGoal = currentGoal;
              }

              // Extract step information
              const stepInfo = extractStepInfo(step.llmResponse);
              if (stepInfo) {
                // For Finish steps, show the final message
                if (step.action === 'Finish' && stepInfo.messageToUser) {
                  restoredMessages.push({
                    id: `assistant-${step.id}`,
                    role: 'assistant',
                    content: stepInfo.messageToUser,
                    timestamp: new Date(step.completedAt || step.createdAt),
                    streaming: false,
                  });
                } else {
                  // For other steps, show reasoning and action
                  const parts: string[] = [];
                  if (stepInfo.reasoning) {
                    parts.push(`💭 ${stepInfo.reasoning}`);
                  }
                  if (step.action) {
                    parts.push(`🔧 Action: ${step.action}`);
                  }
                  if (step.selectedTool) {
                    parts.push(`🛠️ Tool: ${step.selectedTool}`);
                  }
                  if (step.stepResult && step.stepResult !== '{}') {
                    try {
                      const result =
                        typeof step.stepResult === 'string'
                          ? JSON.parse(step.stepResult)
                          : step.stepResult;
                      if (typeof result === 'string') {
                        parts.push(`✅ Result: ${result}`);
                      }
                    } catch {
                      // Ignore parse errors
                    }
                  }

                  if (parts.length > 0) {
                    restoredMessages.push({
                      id: `assistant-step-${step.id}`,
                      role: 'assistant',
                      content: parts.join('\n\n'),
                      timestamp: new Date(step.completedAt || step.createdAt),
                      streaming: false,
                    });
                  }
                }
              }
            }

            if (restoredMessages.length > 0) {
              setMessages(restoredMessages);
            }
          }
        }

        if (!isActive) return;
        setStatus('ready');
        if (!isRestoredSession) {
          setMessages([
            {
              id: 'welcome',
              role: 'system',
              content: `🐒 Welcome to Wukong Agent! Session ID: ${session.id}`,
              timestamp: new Date(),
              streaming: false,
            },
          ]);
        }
      } catch (err) {
        console.error('Failed to initialize client:', err);
        if (!isActive) return;
        setStatus('error');
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        initializingRef.current = false;
      }
    };

    init();

    return () => {
      isActive = false;
      initializingRef.current = false;
      if (currentClient) {
        currentClient.off(handleEvent);
        currentClient.disconnect();
      }
      // Clear client ref on cleanup
      clientRef.current = null;
    };
  }, [
    apiUrl,
    userId,
    autoConnect,
    restoreSession,
    transport,
    getPersistedSessionId,
    persistSessionId,
  ]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!(client && sessionId) || isExecuting) return;

      const userMessage: Message = {
        id: `user-${Date.now()}`,
        role: 'user',
        content,
        timestamp: new Date(),
        streaming: false,
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsExecuting(true);
      setToolExecutions([]);

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

      try {
        await client.execute(sessionId, {
          goal: content,
          maxSteps: 10,
          mode: 'auto',
        });
      } catch (err) {
        console.error('Error executing task:', err);
        setIsExecuting(false);
        setMessages((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            role: 'system',
            content: `Error: ${err instanceof Error ? err.message : 'Unknown error'}`,
            timestamp: new Date(),
          },
        ]);
        currentMessageIdRef.current = null;
      }
    },
    [client, sessionId, isExecuting],
  );

  const stopExecution = useCallback(async () => {
    if (client && sessionId) {
      await client.stopExecution(sessionId);
      setIsExecuting(false);
    }
  }, [client, sessionId]);

  const disconnect = useCallback(() => {
    if (client) {
      client.disconnect();
      setStatus('disconnected');
    }
  }, [client]);

  return {
    client,
    sessionId,
    status,
    error,
    messages,
    isExecuting,
    sendMessage,
    stopExecution,
    disconnect,
    currentThinking,
    toolExecutions,
  };
}
