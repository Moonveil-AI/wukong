/**
 * @wukong/agent - Core Wukong Agent Library
 * @description Main entry point for the Wukong agent framework
 */

// Export all types
export type * from './types/index';
export type * from './types/adapters';
export type * from './types/events';

// Export core classes
export { WukongEventEmitter, createEventEmitter } from './EventEmitter';

// Version
export const version = '0.1.0';

export default {
  version,
};
