/**
 * WukongEventEmitter - Type-safe event emitter for the Wukong Agent system
 *
 * This class extends EventEmitter3 to provide:
 * - Type-safe event emission and listening
 * - Error handling for listeners (errors in one listener don't affect others)
 * - Memory leak prevention
 * - Async listener support
 */

import EventEmitter3 from 'eventemitter3';
import type { EventListener, WukongEvent } from './types/events';

/**
 * WukongEventEmitter class
 *
 * Provides a type-safe event system for the agent with proper error handling.
 */

type ListenerFunction = (...args: any[]) => void | Promise<void>;
type ErrorHandler = (error: Error, event: string, listener: ListenerFunction) => void;

export class WukongEventEmitter {
  private emitter: EventEmitter3;
  private errorHandler?: ErrorHandler;
  // Map to track original listeners to their wrapped versions for proper removal
  private listenerMap: WeakMap<ListenerFunction, ListenerFunction>;

  constructor(options?: {
    /** Max listeners per event (default: 10, 0 = unlimited) */
    maxListeners?: number;
    /** Custom error handler for listener errors */
    errorHandler?: ErrorHandler;
  }) {
    this.emitter = new EventEmitter3();
    this.listenerMap = new WeakMap();

    // Note: EventEmitter3 doesn't have setMaxListeners like Node's EventEmitter
    // Max listeners tracking would need to be implemented manually if needed
    // For now, we store the option but don't enforce it

    this.errorHandler = options?.errorHandler;
  }

  /**
   * Register an event listener
   * @param event - Event name to listen for
   * @param listener - Listener function
   */
  on<T extends WukongEvent['event']>(
    event: T,
    listener: EventListener<Extract<WukongEvent, { event: T }>>,
  ): void {
    const wrappedListener = this.wrapListener(event, listener);
    this.listenerMap.set(listener, wrappedListener);
    this.emitter.on(event, wrappedListener);
  }

  /**
   * Alias for on() - register an event listener
   * @param event - Event name to listen for
   * @param listener - Listener function
   */
  addListener<T extends WukongEvent['event']>(
    event: T,
    listener: EventListener<Extract<WukongEvent, { event: T }>>,
  ): void {
    this.on(event, listener);
  }

  /**
   * Register a one-time event listener
   * @param event - Event name to listen for
   * @param listener - Listener function
   */
  once<T extends WukongEvent['event']>(
    event: T,
    listener: EventListener<Extract<WukongEvent, { event: T }>>,
  ): void {
    const wrappedListener = this.wrapListener(event, listener);
    this.listenerMap.set(listener, wrappedListener);
    this.emitter.once(event, wrappedListener);
  }

  /**
   * Remove an event listener
   * @param event - Event name
   * @param listener - Listener function to remove
   */
  off<T extends WukongEvent['event']>(
    event: T,
    listener: EventListener<Extract<WukongEvent, { event: T }>>,
  ): void {
    const wrappedListener = this.listenerMap.get(listener);
    if (wrappedListener) {
      this.emitter.off(event, wrappedListener as any);
    }
  }

  /**
   * Alias for off() - remove an event listener
   * @param event - Event name
   * @param listener - Listener function to remove
   */
  removeListener<T extends WukongEvent['event']>(
    event: T,
    listener: EventListener<Extract<WukongEvent, { event: T }>>,
  ): void {
    this.off(event, listener);
  }

  /**
   * Emit an event to all listeners (type-safe version)
   * @param eventData - Event object containing event type and data
   */
  emit<T extends WukongEvent>(eventData: T): void;

  /**
   * Emit an event to all listeners (EventEmitter3-compatible version)
   * @param event - Event name
   * @param eventData - Event data
   */
  emit<T extends WukongEvent['event']>(
    event: T,
    eventData: Extract<WukongEvent, { event: T }>,
  ): void;

  /**
   * Implementation
   */
  emit<T extends WukongEvent | WukongEvent['event']>(eventOrData: T, eventData?: any): void {
    if (typeof eventOrData === 'string') {
      // Called with (event, eventData)
      this.emitter.emit(eventOrData, eventData);
    } else {
      // Called with (eventData)
      this.emitter.emit((eventOrData as WukongEvent).event, eventOrData);
    }
  }

  /**
   * Emit an event asynchronously (all listeners complete before returning)
   * @param eventData - Event object containing event type and data
   */
  async emitAsync<T extends WukongEvent>(eventData: T): Promise<void> {
    const listeners = this.emitter.listeners(eventData.event);

    // Execute all listeners and wait for any promises
    const promises = listeners.map(async (listener: any) => {
      try {
        const result = listener(eventData);
        if (result instanceof Promise) {
          await result;
        }
      } catch (error) {
        this.handleListenerError(error as Error, eventData.event, listener);
      }
    });

    await Promise.all(promises);
  }

  /**
   * Remove all listeners for an event (or all events if no event specified)
   * @param event - Event name (optional)
   */
  removeAllListeners(event?: WukongEvent['event']): void {
    if (event) {
      this.emitter.removeAllListeners(event);
    } else {
      this.emitter.removeAllListeners();
    }
  }

  /**
   * Get listener count for an event
   * @param event - Event name
   * @returns Number of listeners
   */
  listenerCount(event: WukongEvent['event']): number {
    return this.emitter.listenerCount(event);
  }

  /**
   * Get all event names that have listeners
   * @returns Array of event names
   */
  eventNames(): WukongEvent['event'][] {
    return this.emitter.eventNames() as WukongEvent['event'][];
  }

  /**
   * Get all listeners for an event
   * @param event - Event name
   * @returns Array of listener functions
   */
  listeners<T extends WukongEvent['event']>(
    event: T,
  ): EventListener<Extract<WukongEvent, { event: T }>>[] {
    return this.emitter.listeners(event) as EventListener<Extract<WukongEvent, { event: T }>>[];
  }

  /**
   * Wrap a listener with error handling
   * Returns a function that can be sync or async depending on the listener
   */
  private wrapListener<T extends WukongEvent['event']>(
    event: T,
    listener: EventListener<Extract<WukongEvent, { event: T }>>,
  ): (data: Extract<WukongEvent, { event: T }>) => void | Promise<void> {
    return (data: Extract<WukongEvent, { event: T }>) => {
      try {
        const result = listener(data);

        // Handle async listeners - return the promise so emitAsync can await it
        if (result instanceof Promise) {
          return result.catch((error) => {
            this.handleListenerError(error, event, listener);
          });
        }

        return result;
      } catch (error) {
        this.handleListenerError(error as Error, event, listener);
      }
    };
  }

  /**
   * Handle errors in listeners
   */
  private handleListenerError(error: Error, event: string, listener: ListenerFunction): void {
    if (this.errorHandler) {
      try {
        this.errorHandler(error, event, listener);
      } catch (handlerError) {
        // If error handler itself throws, log to console
        console.error('[WukongEventEmitter] Error in error handler:', handlerError);
        console.error('[WukongEventEmitter] Original error:', error);
      }
    } else {
      // Default error handling: log to console but don't throw
      console.error(`[WukongEventEmitter] Error in listener for event '${event}':`, error);
    }
  }

  /**
   * Cleanup all listeners and resources
   * Call this when disposing of the event emitter
   */
  destroy(): void {
    this.removeAllListeners();
    this.errorHandler = undefined;
  }
}

/**
 * Create a new WukongEventEmitter instance
 */
export function createEventEmitter(options?: {
  maxListeners?: number;
  errorHandler?: ErrorHandler;
}): WukongEventEmitter {
  return new WukongEventEmitter(options);
}
