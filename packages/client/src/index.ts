/**
 * @wukong/client - Official JavaScript/TypeScript client for Wukong server
 */

import { WukongClient as Client } from './WukongClient';

export { WukongClient } from './WukongClient';
export type {
  SessionInfo,
  ExecuteRequest,
  ExecuteResponse,
  ApiResponse,
  Capability,
  HistoryResponse,
  AgentEvent,
  EventHandler,
} from './types';

/**
 * Create a new Wukong client instance
 * @param baseUrl - The base URL of the Wukong server
 * @returns New WukongClient instance
 */
export function createWukongClient(baseUrl?: string) {
  return new Client(baseUrl);
}

export const version = '0.1.0';

export default {
  WukongClient: Client,
  createWukongClient,
  version,
};

