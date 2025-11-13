/**
 * Tests for StopController
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { StopController } from '../StopController';

describe('StopController', () => {
  let controller: StopController;

  beforeEach(() => {
    controller = new StopController();
  });

  describe('requestStop', () => {
    it('should request a stop', () => {
      controller.requestStop();
      expect(controller.hasStopRequest()).toBe(true);
    });

    it('should default to graceful stop', () => {
      controller.requestStop();
      expect(controller.isGraceful()).toBe(true);
    });

    it('should allow immediate stop', () => {
      controller.requestStop({ graceful: false });
      expect(controller.isGraceful()).toBe(false);
    });

    it('should default to saving state', () => {
      controller.requestStop();
      expect(controller.shouldSaveState()).toBe(true);
    });

    it('should allow not saving state', () => {
      controller.requestStop({ saveState: false });
      expect(controller.shouldSaveState()).toBe(false);
    });
  });

  describe('shouldStop', () => {
    it('should return false when no stop requested', () => {
      expect(controller.shouldStop()).toBe(false);
    });

    it('should return true immediately for immediate stop', () => {
      controller.requestStop({ graceful: false });
      expect(controller.shouldStop()).toBe(true);
    });

    it('should return false for graceful stop before confirmation', () => {
      controller.requestStop({ graceful: true });
      expect(controller.shouldStop()).toBe(false);
    });

    it('should return true for graceful stop after confirmation', () => {
      controller.requestStop({ graceful: true });
      controller.confirmStop();
      expect(controller.shouldStop()).toBe(true);
    });
  });

  describe('confirmStop', () => {
    it('should confirm stop for graceful stops', () => {
      controller.requestStop({ graceful: true });
      controller.confirmStop();
      expect(controller.isStopConfirmed()).toBe(true);
    });

    it('should not affect state when no stop requested', () => {
      controller.confirmStop();
      expect(controller.isStopConfirmed()).toBe(false);
    });
  });

  describe('updateState', () => {
    it('should update execution state', () => {
      controller.updateState('session-123', 5, 10, { partial: 'result' });

      const state = controller.getStopState();
      expect(state).not.toBeNull();
      expect(state?.sessionId).toBe('session-123');
      expect(state?.completedSteps).toBe(5);
      expect(state?.lastStepId).toBe(10);
      expect(state?.partialResult).toEqual({ partial: 'result' });
    });
  });

  describe('getStopState', () => {
    it('should return null when no state has been set', () => {
      expect(controller.getStopState()).toBeNull();
    });

    it('should return stop state with correct values', () => {
      controller.requestStop({ saveState: true });
      controller.updateState('session-123', 3, 6, { test: 'data' });

      const state = controller.getStopState();
      expect(state).not.toBeNull();
      expect(state?.sessionId).toBe('session-123');
      expect(state?.completedSteps).toBe(3);
      expect(state?.lastStepId).toBe(6);
      expect(state?.partialResult).toEqual({ test: 'data' });
      expect(state?.canResume).toBe(true);
    });

    it('should indicate cannot resume when saveState is false', () => {
      controller.requestStop({ saveState: false });
      controller.updateState('session-123', 3, 6);

      const state = controller.getStopState();
      expect(state?.canResume).toBe(false);
    });
  });

  describe('reset', () => {
    it('should reset all state', () => {
      controller.requestStop({ graceful: false, saveState: false });
      controller.updateState('session-123', 5, 10, { test: 'data' });
      controller.confirmStop();

      controller.reset();

      expect(controller.hasStopRequest()).toBe(false);
      expect(controller.isStopConfirmed()).toBe(false);
      expect(controller.isGraceful()).toBe(true);
      expect(controller.shouldSaveState()).toBe(true);
      expect(controller.getStopState()).toBeNull();
    });
  });

  describe('integration scenarios', () => {
    it('should handle graceful stop workflow', () => {
      // Setup execution state
      controller.updateState('session-123', 0, 0);

      // User requests graceful stop
      controller.requestStop({ graceful: true });
      expect(controller.hasStopRequest()).toBe(true);

      // Agent checks before starting new step
      expect(controller.shouldStop()).toBe(false);

      // Agent completes current step
      controller.updateState('session-123', 1, 1, { partial: 'result' });
      controller.confirmStop();

      // Now agent should stop
      expect(controller.shouldStop()).toBe(true);
      expect(controller.isStopConfirmed()).toBe(true);

      // Get final state
      const state = controller.getStopState();
      expect(state?.completedSteps).toBe(1);
      expect(state?.canResume).toBe(true);
    });

    it('should handle immediate stop workflow', () => {
      // Setup execution state
      controller.updateState('session-123', 2, 5);

      // User requests immediate stop
      controller.requestStop({ graceful: false });
      expect(controller.hasStopRequest()).toBe(true);

      // Agent should stop immediately
      expect(controller.shouldStop()).toBe(true);

      // State is preserved
      const state = controller.getStopState();
      expect(state?.completedSteps).toBe(2);
      expect(state?.lastStepId).toBe(5);
    });

    it('should handle stop without saving state', () => {
      controller.updateState('session-123', 3, 7);
      controller.requestStop({ graceful: true, saveState: false });
      controller.confirmStop();

      const state = controller.getStopState();
      expect(state?.canResume).toBe(false);
      expect(state?.completedSteps).toBe(3); // State is still available
    });
  });
});
