import { describe, it, expect } from 'vitest';
import { computeWindTrailsMetrics } from './wind-trails.calculator.js';
import type { GameEvent } from '@kite/shared';

describe('computeWindTrailsMetrics', () => {
  it('should return zeros for empty events', () => {
    const result = computeWindTrailsMetrics([]);
    expect(result.motor_precision).toBe(0);
    expect(result.motor_smoothness).toBe(0);
    expect(result.completion_rate).toBe(0);
    expect(result.speed_accuracy_ratio).toBe(0);
  });

  it('should compute motor precision from path complete events', () => {
    const events: GameEvent[] = [
      { type: 'path_complete', pathIndex: 0, duration: 5000, meanDeviation: 10, maxDeviation: 25, completionPercent: 0.9, smoothnessScore: 0.8 },
      { type: 'path_complete', pathIndex: 1, duration: 6000, meanDeviation: 8, maxDeviation: 20, completionPercent: 0.95, smoothnessScore: 0.85 },
    ];

    const result = computeWindTrailsMetrics(events);
    expect(result.motor_precision).toBe(9); // (10 + 8) / 2
    expect(result.completion_rate).toBe(0.925); // (0.9 + 0.95) / 2
  });

  it('should compute with trace events for smoothness', () => {
    const events: GameEvent[] = [
      { type: 'trace', pathIndex: 0, timestamp: 100, fingerPosition: { x: 0.1, y: 0.1 }, idealPosition: { x: 0.1, y: 0.1 }, deviation: 0, pressure: null, speed: 0.5 },
      { type: 'trace', pathIndex: 0, timestamp: 200, fingerPosition: { x: 0.2, y: 0.2 }, idealPosition: { x: 0.2, y: 0.2 }, deviation: 0.01, pressure: null, speed: 0.6 },
      { type: 'trace', pathIndex: 0, timestamp: 300, fingerPosition: { x: 0.3, y: 0.3 }, idealPosition: { x: 0.3, y: 0.3 }, deviation: 0.02, pressure: null, speed: 0.7 },
      { type: 'trace', pathIndex: 0, timestamp: 400, fingerPosition: { x: 0.4, y: 0.4 }, idealPosition: { x: 0.4, y: 0.4 }, deviation: 0.01, pressure: null, speed: 0.8 },
      { type: 'path_complete', pathIndex: 0, duration: 400, meanDeviation: 0.01, maxDeviation: 0.02, completionPercent: 1.0, smoothnessScore: 0.9 },
    ];

    const result = computeWindTrailsMetrics(events);
    expect(result.motor_precision).toBe(0.01);
    expect(result.completion_rate).toBe(1);
    expect(result.motor_smoothness).toBeGreaterThanOrEqual(0);
  });
});
