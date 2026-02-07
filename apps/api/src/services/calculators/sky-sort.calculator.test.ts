import { describe, it, expect } from 'vitest';
import { computeSkySortMetrics } from './sky-sort.calculator.js';
import type { GameEvent } from '@kite/shared';

describe('computeSkySortMetrics', () => {
  it('should return zeros for empty events', () => {
    const result = computeSkySortMetrics([]);
    expect(result.processing_speed).toBe(0);
    expect(result.sort_accuracy).toBe(0);
    expect(result.switch_cost).toBe(0);
    expect(result.error_recovery_time).toBe(0);
  });

  it('should compute sort accuracy', () => {
    const events: GameEvent[] = [
      { type: 'sort', objectId: 'o1', objectType: 'bird', objectColor: 'red', objectSize: 'small', currentRule: 'type', spawnTimestamp: 1000, sortTimestamp: 1500, direction: 'left', correct: true, reactionTimeMs: 500 },
      { type: 'sort', objectId: 'o2', objectType: 'butterfly', objectColor: 'blue', objectSize: 'large', currentRule: 'type', spawnTimestamp: 2000, sortTimestamp: 2600, direction: 'right', correct: true, reactionTimeMs: 600 },
      { type: 'sort', objectId: 'o3', objectType: 'bird', objectColor: 'green', objectSize: 'small', currentRule: 'type', spawnTimestamp: 3000, sortTimestamp: 3800, direction: 'right', correct: false, reactionTimeMs: 800 },
    ];

    const result = computeSkySortMetrics(events);
    expect(result.sort_accuracy).toBeCloseTo(0.6667, 3); // 2/3
  });

  it('should compute switch cost', () => {
    const events: GameEvent[] = [
      // Before switch: all correct
      { type: 'sort', objectId: 'o1', objectType: 'bird', objectColor: 'red', objectSize: 'small', currentRule: 'type', spawnTimestamp: 1000, sortTimestamp: 1500, direction: 'left', correct: true, reactionTimeMs: 500 },
      { type: 'sort', objectId: 'o2', objectType: 'bird', objectColor: 'blue', objectSize: 'large', currentRule: 'type', spawnTimestamp: 2000, sortTimestamp: 2500, direction: 'left', correct: true, reactionTimeMs: 500 },
      // Rule switch
      { type: 'rule_switch', fromRule: 'type', toRule: 'color', timestamp: 3000, firstSortAfterSwitch: { reactionTimeMs: 900, correct: false } },
      // After switch: some incorrect
      { type: 'sort', objectId: 'o3', objectType: 'bird', objectColor: 'red', objectSize: 'small', currentRule: 'color', spawnTimestamp: 3000, sortTimestamp: 3900, direction: 'left', correct: false, reactionTimeMs: 900 },
      { type: 'sort', objectId: 'o4', objectType: 'butterfly', objectColor: 'red', objectSize: 'large', currentRule: 'color', spawnTimestamp: 4000, sortTimestamp: 4800, direction: 'left', correct: true, reactionTimeMs: 800 },
    ];

    const result = computeSkySortMetrics(events);
    // before switch accuracy = 2/2 = 1.0, after switch accuracy = 1/2 = 0.5
    // switch cost = 1.0 - 0.5 = 0.5
    expect(result.switch_cost).toBe(0.5);
  });

  it('should compute error recovery time', () => {
    const events: GameEvent[] = [
      { type: 'sort', objectId: 'o1', objectType: 'bird', objectColor: 'red', objectSize: 'small', currentRule: 'type', spawnTimestamp: 1000, sortTimestamp: 1500, direction: 'left', correct: false, reactionTimeMs: 500 },
      { type: 'sort', objectId: 'o2', objectType: 'bird', objectColor: 'blue', objectSize: 'large', currentRule: 'type', spawnTimestamp: 2000, sortTimestamp: 2500, direction: 'left', correct: true, reactionTimeMs: 500 },
    ];

    const result = computeSkySortMetrics(events);
    // Recovery: 2500 - 1500 = 1000ms
    expect(result.error_recovery_time).toBe(1000);
  });
});
