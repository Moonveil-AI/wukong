/**
 * StopController
 *
 * Provides mechanisms to safely stop agent execution at any time.
 * Supports both graceful stops (complete current step) and immediate stops.
 */

import type { StopOptions, StopState } from '../types';

/**
 * StopController manages stop requests during agent execution
 */
export class StopController {
  private stopRequested = false;
  private stopConfirmed = false;
  private graceful = true;
  private saveState = true;
  private sessionId?: string;
  private completedSteps = 0;
  private lastStepId = 0;
  private partialResult?: any;

  /**
   * Request to stop the agent execution
   * @param options Stop options
   */
  public requestStop(options: StopOptions = {}): void {
    this.stopRequested = true;
    this.graceful = options.graceful !== false; // Default to true
    this.saveState = options.saveState !== false; // Default to true
  }

  /**
   * Check if a stop has been requested
   * @returns true if stop was requested
   */
  public hasStopRequest(): boolean {
    return this.stopRequested;
  }

  /**
   * Check if execution should stop now
   * For graceful stops, this returns true after current step completes
   * For immediate stops, this returns true immediately
   * @returns true if execution should stop
   */
  public shouldStop(): boolean {
    if (!this.stopRequested) {
      return false;
    }

    // For immediate stops, stop right away
    if (!this.graceful) {
      return true;
    }

    // For graceful stops, only stop after confirmation
    return this.stopConfirmed;
  }

  /**
   * Confirm that the current step has completed and it's safe to stop
   * Should be called after each step completes
   */
  public confirmStop(): void {
    if (this.stopRequested && this.graceful) {
      this.stopConfirmed = true;
    }
  }

  /**
   * Update execution state for stop tracking
   * @param sessionId Session ID
   * @param completedSteps Number of completed steps
   * @param lastStepId Last completed step ID
   * @param partialResult Partial result if available
   */
  public updateState(
    sessionId: string,
    completedSteps: number,
    lastStepId: number,
    partialResult?: any,
  ): void {
    this.sessionId = sessionId;
    this.completedSteps = completedSteps;
    this.lastStepId = lastStepId;
    this.partialResult = partialResult;
  }

  /**
   * Get the current stop state for resumption
   * @returns StopState information
   */
  public getStopState(): StopState | null {
    if (!this.sessionId) {
      return null;
    }

    return {
      sessionId: this.sessionId,
      completedSteps: this.completedSteps,
      partialResult: this.partialResult,
      canResume: this.saveState,
      lastStepId: this.lastStepId,
    };
  }

  /**
   * Reset the stop controller for new execution
   */
  public reset(): void {
    this.stopRequested = false;
    this.stopConfirmed = false;
    this.graceful = true;
    this.saveState = true;
    this.sessionId = undefined;
    this.completedSteps = 0;
    this.lastStepId = 0;
    this.partialResult = undefined;
  }

  /**
   * Check if stop was graceful
   * @returns true if graceful stop was requested
   */
  public isGraceful(): boolean {
    return this.graceful;
  }

  /**
   * Check if state should be saved
   * @returns true if state should be saved for resumption
   */
  public shouldSaveState(): boolean {
    return this.saveState;
  }

  /**
   * Check if stop has been confirmed
   * @returns true if stop was confirmed
   */
  public isStopConfirmed(): boolean {
    return this.stopConfirmed;
  }
}
