/**
 * Type definitions for Wukong Client
 */

export interface SessionInfo {
  id: string;
  userId: string;
  createdAt: string;
  lastActivityAt: string;
  metadata?: Record<string, any>;
}

export interface ExecuteRequest {
  goal: string;
  maxSteps?: number;
  mode?: 'auto' | 'confirm' | 'manual';
}

export interface ExecuteResponse {
  success: boolean;
  sessionId: string;
  status: 'started' | 'running' | 'completed' | 'failed';
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export interface Capability {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  category?: string;
}

export interface HistoryResponse {
  sessionId: string;
  goal?: string;
  initialGoal?: string;
  history: any[];
}

/**
 * Event types from WebSocket/SSE
 */
export type AgentEvent =
  | { type: 'session:created'; session: SessionInfo }
  | { type: 'llm:started'; stepId: number; model: string }
  | { type: 'llm:streaming'; text: string; fullText?: string; index: number; isFinal: boolean }
  | { type: 'llm:complete'; stepId: number; response: any }
  | { type: 'step:started'; step: any }
  | { type: 'step:completed'; step: any }
  | { type: 'tool:executing'; sessionId: string; toolName: string; parameters: any }
  | { type: 'tool:completed'; sessionId: string; toolName: string; result: any }
  | { type: 'agent:progress'; sessionId: string; progress: any }
  | { type: 'agent:complete'; sessionId: string; result: any }
  | { type: 'agent:error'; sessionId: string; error: string };

export type EventHandler = (event: AgentEvent) => void;
