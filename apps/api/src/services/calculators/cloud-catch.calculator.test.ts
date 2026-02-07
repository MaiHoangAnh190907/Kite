import { describe, it, expect } from 'vitest';
import { computeCloudCatchMetrics } from './cloud-catch.calculator.js';
import type { GameEvent } from '@kite/shared';

describe('computeCloudCatchMetrics', () => {
  it('should return zeros for empty events', () => {
    const result = computeCloudCatchMetrics([]);
    expect(result.attention_accuracy).toBe(0);
    expect(result.reaction_time_mean).toBe(0);
    expect(result.reaction_time_cv).toBe(0);
    expect(result.false_positive_rate).toBe(0);
    expect(result.attention_decay).toBe(1);
  });

  it('should compute attention accuracy correctly', () => {
    const events: GameEvent[] = [
      { type: 'stimulus', stimulusId: 'g1', stimulusType: 'golden', spawnTimestamp: 1000, spawnPosition: { x: 0.5, y: 0.1 }, speed: 0.3 },
      { type: 'stimulus', stimulusId: 'g2', stimulusType: 'golden', spawnTimestamp: 2000, spawnPosition: { x: 0.3, y: 0.1 }, speed: 0.3 },
      { type: 'stimulus', stimulusId: 's1', stimulusType: 'storm', spawnTimestamp: 3000, spawnPosition: { x: 0.7, y: 0.1 }, speed: 0.3 },
      { type: 'tap', timestamp: 1500, position: { x: 0.5, y: 0.3 }, targetId: 'g1', correct: true, reactionTimeMs: 500 },
      { type: 'tap', timestamp: 2500, position: { x: 0.3, y: 0.3 }, targetId: 'g2', correct: true, reactionTimeMs: 500 },
      { type: 'miss', stimulusId: 's1', stimulusType: 'storm', timeOnScreen: 3000 },
    ];

    const result = computeCloudCatchMetrics(events);
    // 2 golden tapped out of 2 golden spawned = 1.0
    expect(result.attention_accuracy).toBe(1);
  });

  it('should compute reaction time mean and CV', () => {
    const events: GameEvent[] = [
      { type: 'stimulus', stimulusId: 'g1', stimulusType: 'golden', spawnTimestamp: 1000, spawnPosition: { x: 0.5, y: 0.1 }, speed: 0.3 },
      { type: 'stimulus', stimulusId: 'g2', stimulusType: 'golden', spawnTimestamp: 2000, spawnPosition: { x: 0.3, y: 0.1 }, speed: 0.3 },
      { type: 'tap', timestamp: 1400, position: { x: 0.5, y: 0.3 }, targetId: 'g1', correct: true, reactionTimeMs: 400 },
      { type: 'tap', timestamp: 2600, position: { x: 0.3, y: 0.3 }, targetId: 'g2', correct: true, reactionTimeMs: 600 },
    ];

    const result = computeCloudCatchMetrics(events);
    expect(result.reaction_time_mean).toBe(500);
    // CV = std / mean = 100 / 500 = 0.2
    expect(result.reaction_time_cv).toBe(0.2);
  });

  it('should compute false positive rate', () => {
    const events: GameEvent[] = [
      { type: 'tap', timestamp: 1000, position: { x: 0.5, y: 0.3 }, targetId: 'g1', correct: true, reactionTimeMs: 400 },
      { type: 'tap', timestamp: 2000, position: { x: 0.3, y: 0.3 }, targetId: 's1', correct: false, reactionTimeMs: 500 },
      { type: 'tap', timestamp: 3000, position: { x: 0.7, y: 0.3 }, targetId: 'g2', correct: true, reactionTimeMs: 450 },
      { type: 'tap', timestamp: 4000, position: { x: 0.2, y: 0.3 }, targetId: 's2', correct: false, reactionTimeMs: 550 },
    ];

    const result = computeCloudCatchMetrics(events);
    // 2 incorrect out of 4 total = 0.5
    expect(result.false_positive_rate).toBe(0.5);
  });
});
