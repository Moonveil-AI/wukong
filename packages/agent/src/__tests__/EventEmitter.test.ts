/**
 * EventEmitter tests
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WukongEventEmitter, createEventEmitter } from '../EventEmitter';
import type { StepCompletedEvent, StepStartedEvent, ToolExecutingEvent } from '../types/events';

describe('WukongEventEmitter', () => {
  let emitter: WukongEventEmitter;

  beforeEach(() => {
    emitter = new WukongEventEmitter();
  });

  afterEach(() => {
    emitter.destroy();
  });

  describe('Basic event emission', () => {
    it('should emit and receive events', () => {
      const listener = vi.fn();

      emitter.on('step:started', listener);

      const event: StepStartedEvent = {
        event: 'step:started',
        step: {
          id: 1,
          sessionId: 'test-session',
          stepNumber: 1,
          action: 'CallTool',
          status: 'running',
          discarded: false,
          isParallel: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      };

      emitter.emit(event);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(event);
    });

    it('should handle multiple listeners for the same event', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      const listener3 = vi.fn();

      emitter.on('step:started', listener1);
      emitter.on('step:started', listener2);
      emitter.on('step:started', listener3);

      const event: StepStartedEvent = {
        event: 'step:started',
        step: {
          id: 1,
          sessionId: 'test-session',
          stepNumber: 1,
          action: 'CallTool',
          status: 'running',
          discarded: false,
          isParallel: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      };

      emitter.emit(event);

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
      expect(listener3).toHaveBeenCalledTimes(1);
    });

    it('should handle different event types', () => {
      const stepListener = vi.fn();
      const toolListener = vi.fn();

      emitter.on('step:started', stepListener);
      emitter.on('tool:executing', toolListener);

      const stepEvent: StepStartedEvent = {
        event: 'step:started',
        step: {
          id: 1,
          sessionId: 'test-session',
          stepNumber: 1,
          action: 'CallTool',
          status: 'running',
          discarded: false,
          isParallel: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      };

      const toolEvent: ToolExecutingEvent = {
        event: 'tool:executing',
        sessionId: 'test-session',
        stepId: 1,
        toolName: 'test_tool',
        parameters: { test: 'value' },
        description: 'Test tool',
      };

      emitter.emit(stepEvent);
      emitter.emit(toolEvent);

      expect(stepListener).toHaveBeenCalledTimes(1);
      expect(stepListener).toHaveBeenCalledWith(stepEvent);
      expect(toolListener).toHaveBeenCalledTimes(1);
      expect(toolListener).toHaveBeenCalledWith(toolEvent);
    });
  });

  describe('Once listeners', () => {
    it('should only trigger once listener one time', () => {
      const listener = vi.fn();

      emitter.once('step:completed', listener);

      const event: StepCompletedEvent = {
        event: 'step:completed',
        step: {
          id: 1,
          sessionId: 'test-session',
          stepNumber: 1,
          action: 'CallTool',
          status: 'completed',
          discarded: false,
          isParallel: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      };

      emitter.emit(event);
      emitter.emit(event);
      emitter.emit(event);

      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe('Removing listeners', () => {
    it('should remove a specific listener', () => {
      const listener = vi.fn();

      emitter.on('step:started', listener);

      const event: StepStartedEvent = {
        event: 'step:started',
        step: {
          id: 1,
          sessionId: 'test-session',
          stepNumber: 1,
          action: 'CallTool',
          status: 'running',
          discarded: false,
          isParallel: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      };

      emitter.emit(event);
      expect(listener).toHaveBeenCalledTimes(1);

      emitter.off('step:started', listener);
      emitter.emit(event);

      // Should still be 1, not 2
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should remove all listeners for an event', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      emitter.on('step:started', listener1);
      emitter.on('step:started', listener2);

      emitter.removeAllListeners('step:started');

      const event: StepStartedEvent = {
        event: 'step:started',
        step: {
          id: 1,
          sessionId: 'test-session',
          stepNumber: 1,
          action: 'CallTool',
          status: 'running',
          discarded: false,
          isParallel: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      };

      emitter.emit(event);

      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).not.toHaveBeenCalled();
    });

    it('should remove all listeners for all events', () => {
      const stepListener = vi.fn();
      const toolListener = vi.fn();

      emitter.on('step:started', stepListener);
      emitter.on('tool:executing', toolListener);

      emitter.removeAllListeners();

      const stepEvent: StepStartedEvent = {
        event: 'step:started',
        step: {
          id: 1,
          sessionId: 'test-session',
          stepNumber: 1,
          action: 'CallTool',
          status: 'running',
          discarded: false,
          isParallel: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      };

      const toolEvent: ToolExecutingEvent = {
        event: 'tool:executing',
        sessionId: 'test-session',
        stepId: 1,
        toolName: 'test_tool',
        parameters: {},
        description: 'Test',
      };

      emitter.emit(stepEvent);
      emitter.emit(toolEvent);

      expect(stepListener).not.toHaveBeenCalled();
      expect(toolListener).not.toHaveBeenCalled();
    });
  });

  describe('Error handling', () => {
    it('should catch synchronous errors in listeners', () => {
      const errorListener = vi.fn(() => {
        throw new Error('Test error');
      });
      const normalListener = vi.fn();

      // Suppress console.error for this test
      const consoleError = console.error;
      console.error = vi.fn();

      emitter.on('step:started', errorListener);
      emitter.on('step:started', normalListener);

      const event: StepStartedEvent = {
        event: 'step:started',
        step: {
          id: 1,
          sessionId: 'test-session',
          stepNumber: 1,
          action: 'CallTool',
          status: 'running',
          discarded: false,
          isParallel: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      };

      emitter.emit(event);

      // Error listener should have been called
      expect(errorListener).toHaveBeenCalledTimes(1);

      // Normal listener should still be called (error didn't break the chain)
      expect(normalListener).toHaveBeenCalledTimes(1);

      // Error should have been logged
      expect(console.error).toHaveBeenCalled();

      console.error = consoleError;
    });

    it('should catch asynchronous errors in listeners', async () => {
      const errorListener = vi.fn(async () => {
        await Promise.resolve();
        throw new Error('Async test error');
      });
      const normalListener = vi.fn();

      const consoleError = console.error;
      console.error = vi.fn();

      emitter.on('step:started', errorListener);
      emitter.on('step:started', normalListener);

      const event: StepStartedEvent = {
        event: 'step:started',
        step: {
          id: 1,
          sessionId: 'test-session',
          stepNumber: 1,
          action: 'CallTool',
          status: 'running',
          discarded: false,
          isParallel: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      };

      emitter.emit(event);

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(errorListener).toHaveBeenCalledTimes(1);
      expect(normalListener).toHaveBeenCalledTimes(1);

      console.error = consoleError;
    });

    it('should use custom error handler', () => {
      const customErrorHandler = vi.fn();
      const customEmitter = new WukongEventEmitter({
        errorHandler: customErrorHandler,
      });

      const errorListener = vi.fn(() => {
        throw new Error('Test error');
      });

      customEmitter.on('step:started', errorListener);

      const event: StepStartedEvent = {
        event: 'step:started',
        step: {
          id: 1,
          sessionId: 'test-session',
          stepNumber: 1,
          action: 'CallTool',
          status: 'running',
          discarded: false,
          isParallel: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      };

      customEmitter.emit(event);

      expect(customErrorHandler).toHaveBeenCalledTimes(1);
      expect(customErrorHandler.mock.calls[0][0]).toBeInstanceOf(Error);
      expect(customErrorHandler.mock.calls[0][0].message).toBe('Test error');
      expect(customErrorHandler.mock.calls[0][1]).toBe('step:started');

      customEmitter.destroy();
    });
  });

  describe('Async emission', () => {
    it('should wait for all async listeners to complete', async () => {
      const results: number[] = [];

      const listener1 = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        results.push(1);
      });

      const listener2 = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        results.push(2);
      });

      emitter.on('step:started', listener1);
      emitter.on('step:started', listener2);

      const event: StepStartedEvent = {
        event: 'step:started',
        step: {
          id: 1,
          sessionId: 'test-session',
          stepNumber: 1,
          action: 'CallTool',
          status: 'running',
          discarded: false,
          isParallel: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      };

      await emitter.emitAsync(event);

      // Both listeners should have completed
      expect(results).toHaveLength(2);
      expect(results).toContain(1);
      expect(results).toContain(2);
    });

    it('should handle errors in async emission', async () => {
      const consoleError = console.error;
      console.error = vi.fn();

      const errorListener = vi.fn(() => {
        throw new Error('Async error');
      });

      const normalListener = vi.fn(async () => {
        await Promise.resolve();
      });

      emitter.on('step:started', errorListener);
      emitter.on('step:started', normalListener);

      const event: StepStartedEvent = {
        event: 'step:started',
        step: {
          id: 1,
          sessionId: 'test-session',
          stepNumber: 1,
          action: 'CallTool',
          status: 'running',
          discarded: false,
          isParallel: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      };

      await emitter.emitAsync(event);

      expect(errorListener).toHaveBeenCalledTimes(1);
      expect(normalListener).toHaveBeenCalledTimes(1);

      console.error = consoleError;
    });
  });

  describe('Utility methods', () => {
    it('should return listener count', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      expect(emitter.listenerCount('step:started')).toBe(0);

      emitter.on('step:started', listener1);
      expect(emitter.listenerCount('step:started')).toBe(1);

      emitter.on('step:started', listener2);
      expect(emitter.listenerCount('step:started')).toBe(2);

      emitter.off('step:started', listener1);
      expect(emitter.listenerCount('step:started')).toBe(1);
    });

    it('should return event names', () => {
      emitter.on('step:started', vi.fn());
      emitter.on('step:completed', vi.fn());
      emitter.on('tool:executing', vi.fn());

      const eventNames = emitter.eventNames();

      expect(eventNames).toContain('step:started');
      expect(eventNames).toContain('step:completed');
      expect(eventNames).toContain('tool:executing');
    });

    it('should return listeners for an event', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      emitter.on('step:started', listener1);
      emitter.on('step:started', listener2);

      const listeners = emitter.listeners('step:started');

      expect(listeners).toHaveLength(2);
    });
  });

  describe('Memory leak prevention', () => {
    it('should allow many listeners', () => {
      // EventEmitter3 doesn't have built-in max listeners enforcement
      // Just verify we can add many listeners without issues
      const manyEmitter = new WukongEventEmitter();

      for (let i = 0; i < 100; i++) {
        manyEmitter.on('step:started', vi.fn());
      }

      expect(manyEmitter.listenerCount('step:started')).toBe(100);

      manyEmitter.destroy();
    });
  });

  describe('Factory function', () => {
    it('should create emitter using factory function', () => {
      const factoryEmitter = createEventEmitter();

      const listener = vi.fn();
      factoryEmitter.on('step:started', listener);

      const event: StepStartedEvent = {
        event: 'step:started',
        step: {
          id: 1,
          sessionId: 'test-session',
          stepNumber: 1,
          action: 'CallTool',
          status: 'running',
          discarded: false,
          isParallel: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      };

      factoryEmitter.emit(event);

      expect(listener).toHaveBeenCalledTimes(1);

      factoryEmitter.destroy();
    });
  });

  describe('Destroy', () => {
    it('should cleanup all listeners on destroy', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      emitter.on('step:started', listener1);
      emitter.on('tool:executing', listener2);

      expect(emitter.listenerCount('step:started')).toBe(1);
      expect(emitter.listenerCount('tool:executing')).toBe(1);

      emitter.destroy();

      expect(emitter.listenerCount('step:started')).toBe(0);
      expect(emitter.listenerCount('tool:executing')).toBe(0);
    });
  });
});
