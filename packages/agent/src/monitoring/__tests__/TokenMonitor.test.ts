/**
 * Tests for Token Monitor
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WukongEventEmitter } from '../../EventEmitter';
import {
  CostCalculator,
  TokenMonitor,
  countTokens,
  countTokensForJSON,
  estimateTokens,
} from '../TokenMonitor';

describe('Token Counter Functions', () => {
  describe('estimateTokens', () => {
    it('should estimate tokens for empty string', () => {
      expect(estimateTokens('')).toBe(0);
    });

    it('should estimate tokens for short text', () => {
      const text = 'Hello world';
      const estimated = estimateTokens(text);
      expect(estimated).toBeGreaterThan(0);
      expect(estimated).toBeLessThan(10);
    });

    it('should estimate tokens for longer text', () => {
      const text = 'This is a longer piece of text that should have more tokens';
      const estimated = estimateTokens(text);
      expect(estimated).toBeGreaterThan(10);
    });
  });

  describe('countTokens', () => {
    it('should count tokens for empty string', () => {
      expect(countTokens('')).toBe(0);
    });

    it('should count tokens for simple text', () => {
      const text = 'The quick brown fox';
      const count = countTokens(text);
      expect(count).toBeGreaterThan(0);
      expect(count).toBeLessThan(10);
    });

    it('should count tokens for longer text', () => {
      const text = 'This is a longer piece of text with many words and tokens';
      const count = countTokens(text);
      expect(count).toBeGreaterThan(10);
    });

    it('should count tokens for JSON', () => {
      const obj = { name: 'test', value: 123, nested: { key: 'value' } };
      const count = countTokensForJSON(obj);
      expect(count).toBeGreaterThan(0);
    });
  });
});

describe('CostCalculator', () => {
  let calculator: CostCalculator;
  let consoleWarnSpy: any;

  beforeEach(() => {
    calculator = new CostCalculator();
    // Suppress console.warn for tests
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  describe('calculateCost', () => {
    it('should calculate cost for GPT-4', () => {
      const cost = calculator.calculateCost(1000, 500, 'gpt-4');

      // Expected: (1000/1M * 30) + (500/1M * 60)
      // = 0.03 + 0.03 = 0.06
      expect(cost).toBeCloseTo(0.06, 4);
    });

    it('should calculate cost for GPT-4o', () => {
      const cost = calculator.calculateCost(1000, 500, 'gpt-4o');

      // Expected: (1000/1M * 5) + (500/1M * 15)
      // = 0.005 + 0.0075 = 0.0125
      expect(cost).toBeCloseTo(0.0125, 4);
    });

    it('should calculate cost for Claude', () => {
      const cost = calculator.calculateCost(1000, 500, 'claude-3-sonnet');

      // Expected: (1000/1M * 3) + (500/1M * 15)
      // = 0.003 + 0.0075 = 0.0105
      expect(cost).toBeCloseTo(0.0105, 4);
    });

    it('should handle unknown model with fallback', () => {
      const cost = calculator.calculateCost(1000, 500, 'unknown-model');

      // Should fall back to GPT-4 pricing
      expect(cost).toBeCloseTo(0.06, 4);
    });

    it('should handle zero tokens', () => {
      const cost = calculator.calculateCost(0, 0, 'gpt-4');
      expect(cost).toBe(0);
    });
  });

  describe('calculateSavingsCost', () => {
    it('should calculate savings cost for input tokens', () => {
      const cost = calculator.calculateSavingsCost(1000, 'gpt-4', true);

      // Expected: 1000/1M * 30 = 0.03
      expect(cost).toBeCloseTo(0.03, 4);
    });

    it('should calculate savings cost for output tokens', () => {
      const cost = calculator.calculateSavingsCost(1000, 'gpt-4', false);

      // Expected: 1000/1M * 60 = 0.06
      expect(cost).toBeCloseTo(0.06, 4);
    });
  });

  describe('setModelPricing', () => {
    it('should allow setting custom model pricing', () => {
      calculator.setModelPricing({
        model: 'custom-model',
        inputCostPer1M: 10,
        outputCostPer1M: 20,
      });

      const cost = calculator.calculateCost(1000, 500, 'custom-model');

      // Expected: (1000/1M * 10) + (500/1M * 20)
      // = 0.01 + 0.01 = 0.02
      expect(cost).toBeCloseTo(0.02, 4);
    });
  });
});

describe('TokenMonitor', () => {
  let monitor: TokenMonitor;
  let emitter: WukongEventEmitter;
  let emitSpy: any;

  beforeEach(() => {
    emitter = new WukongEventEmitter();
    emitSpy = vi.spyOn(emitter, 'emit');
    monitor = new TokenMonitor({ eventEmitter: emitter });
  });

  describe('recordUsage', () => {
    it('should record token usage', () => {
      const usage = monitor.recordUsage('session-1', 1, 1000, 500, 'gpt-4');

      expect(usage).toMatchObject({
        sessionId: 'session-1',
        stepId: 1,
        promptTokens: 1000,
        completionTokens: 500,
        totalTokens: 1500,
      });
      expect(usage.estimatedCost).toBeGreaterThan(0);
    });

    it('should emit tokens:used event', () => {
      monitor.recordUsage('session-1', 1, 1000, 500, 'gpt-4');

      expect(emitSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'tokens:used',
          usage: expect.any(Object),
        }),
      );
    });

    it('should track cumulative stats', () => {
      monitor.recordUsage('session-1', 1, 1000, 500, 'gpt-4');
      monitor.recordUsage('session-1', 2, 2000, 1000, 'gpt-4');

      const stats = monitor.getSessionStats('session-1');
      expect(stats.totalPromptTokens).toBe(3000);
      expect(stats.totalCompletionTokens).toBe(1500);
      expect(stats.stepCount).toBe(2);
      expect(stats.totalCost).toBeGreaterThan(0);
    });

    it('should track savings', () => {
      const usage = monitor.recordUsage('session-1', 1, 1000, 500, 'gpt-4', {
        mcpSavings: 100,
        skillsSavings: 200,
        discardSavings: 50,
      });

      expect(usage.savings).toEqual({
        mcpSavings: 100,
        skillsSavings: 200,
        discardSavings: 50,
        total: 350,
      });

      const stats = monitor.getSessionStats('session-1');
      expect(stats.totalSavings).toBe(350);
    });

    it('should handle multiple sessions', () => {
      monitor.recordUsage('session-1', 1, 1000, 500, 'gpt-4');
      monitor.recordUsage('session-2', 1, 2000, 1000, 'gpt-4');

      const stats1 = monitor.getSessionStats('session-1');
      const stats2 = monitor.getSessionStats('session-2');

      expect(stats1.totalPromptTokens).toBe(1000);
      expect(stats2.totalPromptTokens).toBe(2000);
    });
  });

  describe('recordSavings', () => {
    it('should record savings', () => {
      monitor.recordSavings('session-1', 1, 'mcp', 1000);

      expect(emitSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'tokens:saved',
          sessionId: 'session-1',
          stepId: 1,
          savedBy: 'mcp',
          amount: 1000,
        }),
      );
    });

    it('should update session stats', () => {
      monitor.recordUsage('session-1', 1, 1000, 500, 'gpt-4');
      monitor.recordSavings('session-1', 1, 'mcp', 500);

      const stats = monitor.getSessionStats('session-1');
      expect(stats.totalSavings).toBe(500);
    });
  });

  describe('getSessionStats', () => {
    it('should return empty stats for unknown session', () => {
      const stats = monitor.getSessionStats('unknown');
      expect(stats).toEqual({
        totalPromptTokens: 0,
        totalCompletionTokens: 0,
        totalCost: 0,
        totalSavings: 0,
        stepCount: 0,
      });
    });

    it('should return stats for known session', () => {
      monitor.recordUsage('session-1', 1, 1000, 500, 'gpt-4');

      const stats = monitor.getSessionStats('session-1');
      expect(stats.totalPromptTokens).toBe(1000);
      expect(stats.totalCompletionTokens).toBe(500);
      expect(stats.stepCount).toBe(1);
    });
  });

  describe('getAllStats', () => {
    it('should return all session stats', () => {
      monitor.recordUsage('session-1', 1, 1000, 500, 'gpt-4');
      monitor.recordUsage('session-2', 1, 2000, 1000, 'gpt-4');

      const allStats = monitor.getAllStats();
      expect(allStats).toHaveLength(2);
      expect(allStats[0].sessionId).toBe('session-1');
      expect(allStats[1].sessionId).toBe('session-2');
    });

    it('should return empty array when no stats', () => {
      const allStats = monitor.getAllStats();
      expect(allStats).toEqual([]);
    });
  });

  describe('clearSession', () => {
    it('should clear session stats', () => {
      monitor.recordUsage('session-1', 1, 1000, 500, 'gpt-4');
      monitor.clearSession('session-1');

      const stats = monitor.getSessionStats('session-1');
      expect(stats.stepCount).toBe(0);
    });
  });

  describe('clearAll', () => {
    it('should clear all stats', () => {
      monitor.recordUsage('session-1', 1, 1000, 500, 'gpt-4');
      monitor.recordUsage('session-2', 1, 2000, 1000, 'gpt-4');

      monitor.clearAll();

      const allStats = monitor.getAllStats();
      expect(allStats).toEqual([]);
    });
  });

  describe('getCostCalculator', () => {
    it('should return cost calculator', () => {
      const calculator = monitor.getCostCalculator();
      expect(calculator).toBeInstanceOf(CostCalculator);
    });
  });
});

describe('Integration: Full usage tracking', () => {
  it('should track full agent execution flow', () => {
    const emitter = new WukongEventEmitter();
    const monitor = new TokenMonitor({ eventEmitter: emitter });

    const events: any[] = [];
    emitter.on('tokens:used', (e) => events.push(e));
    emitter.on('tokens:saved', (e) => events.push(e));

    // Step 1: Initial call with MCP savings
    monitor.recordUsage('session-1', 1, 1000, 500, 'gpt-4', {
      mcpSavings: 500, // MCP saved 500 tokens
    });

    // Step 2: Another call with skills savings
    monitor.recordUsage('session-1', 2, 800, 400, 'gpt-4', {
      skillsSavings: 300, // Skills saved 300 tokens
    });

    // Step 3: Discard old steps
    monitor.recordSavings('session-1', 3, 'discard', 200);

    // Verify events
    expect(events).toHaveLength(3);
    expect(events[0].event).toBe('tokens:used');
    expect(events[1].event).toBe('tokens:used');
    expect(events[2].event).toBe('tokens:saved');

    // Verify stats
    const stats = monitor.getSessionStats('session-1');
    expect(stats.totalPromptTokens).toBe(1800); // 1000 + 800
    expect(stats.totalCompletionTokens).toBe(900); // 500 + 400
    expect(stats.stepCount).toBe(2);
    expect(stats.totalSavings).toBe(1000); // 500 + 300 + 200
    expect(stats.totalCost).toBeGreaterThan(0);
  });
});
