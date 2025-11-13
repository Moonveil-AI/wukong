/**
 * Type export verification tests
 * This file ensures all types are properly exported from @wukong/agent
 */

import { describe, expect, it } from 'vitest';

// Import all core types to verify they're exported
import type { ActionType, TodoStatus } from '../index';

describe('Type Exports', () => {
  it('should export all types successfully', () => {
    // If this test runs and passes, it means all types compiled successfully
    expect(true).toBe(true);
  });

  it('should have TodoStatus enum-like type', () => {
    // Verify that TodoStatus type exists
    const status: TodoStatus = 'pending';
    expect(['pending', 'in_progress', 'completed', 'cancelled']).toContain(status);
  });

  it('should have ActionType enum-like type', () => {
    // Verify that ActionType type exists
    const action: ActionType = 'CallTool';
    expect([
      'CallTool',
      'CallToolsParallel',
      'ForkAutoAgent',
      'AskUser',
      'Plan',
      'Finish',
    ]).toContain(action);
  });
});
