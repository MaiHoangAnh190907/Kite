import { describe, it, expect } from 'vitest';
import { computeSkyBalanceMetrics } from './sky-balance.calculator.js';
import type { GameEvent } from '@kite/shared';

describe('computeSkyBalanceMetrics', () => {
  it('should return zeros for empty events', () => {
    const result = computeSkyBalanceMetrics([]);
    expect(result.balance_stability).toBe(0);
    expect(result.tilt_variability).toBe(0);
    expect(result.correction_smoothness).toBe(0);
    expect(result.max_balls_balanced).toBe(0);
    expect(result.avg_balls_balanced).toBe(0);
    expect(result.drop_rate).toBe(0);
    expect(result.avg_time_on_plank).toBe(0);
  });

  it('should compute balance_stability as RMS of tilt angles', () => {
    const events: GameEvent[] = [
      { type: 'tilt_sample', timestamp: 1000, tiltAngle: 0.1, angularVelocity: 0, ballCount: 1 },
      { type: 'tilt_sample', timestamp: 1100, tiltAngle: -0.1, angularVelocity: 0, ballCount: 1 },
      { type: 'tilt_sample', timestamp: 1200, tiltAngle: 0.1, angularVelocity: 0, ballCount: 1 },
    ];

    const result = computeSkyBalanceMetrics(events);
    // RMS of [0.1, -0.1, 0.1] = sqrt((0.01+0.01+0.01)/3) = sqrt(0.01) = 0.1
    expect(result.balance_stability).toBe(0.1);
  });

  it('should compute tilt_variability as std deviation', () => {
    const events: GameEvent[] = [
      { type: 'tilt_sample', timestamp: 1000, tiltAngle: 0.2, angularVelocity: 0, ballCount: 1 },
      { type: 'tilt_sample', timestamp: 1100, tiltAngle: 0.0, angularVelocity: 0, ballCount: 1 },
    ];

    const result = computeSkyBalanceMetrics(events);
    // mean = 0.1, variance = ((0.1)^2 + (-0.1)^2)/2 = 0.01, std = 0.1
    expect(result.tilt_variability).toBe(0.1);
  });

  it('should compute correction_smoothness as mean |angularVelocity|', () => {
    const events: GameEvent[] = [
      { type: 'tilt_sample', timestamp: 1000, tiltAngle: 0, angularVelocity: 0.5, ballCount: 1 },
      { type: 'tilt_sample', timestamp: 1100, tiltAngle: 0, angularVelocity: -0.3, ballCount: 1 },
    ];

    const result = computeSkyBalanceMetrics(events);
    // mean(|0.5|, |-0.3|) = (0.5+0.3)/2 = 0.4
    expect(result.correction_smoothness).toBe(0.4);
  });

  it('should track max and avg balls balanced', () => {
    const events: GameEvent[] = [
      { type: 'tilt_sample', timestamp: 1000, tiltAngle: 0, angularVelocity: 0, ballCount: 2 },
      { type: 'tilt_sample', timestamp: 1100, tiltAngle: 0, angularVelocity: 0, ballCount: 5 },
      { type: 'tilt_sample', timestamp: 1200, tiltAngle: 0, angularVelocity: 0, ballCount: 3 },
    ];

    const result = computeSkyBalanceMetrics(events);
    expect(result.max_balls_balanced).toBe(5);
    // avg = (2+5+3)/3 = 10/3 ≈ 3.3333
    expect(result.avg_balls_balanced).toBeCloseTo(3.3333, 3);
  });

  it('should compute drop_rate as drops per minute', () => {
    const events: GameEvent[] = [
      // 2 tilt samples spanning 60 seconds
      { type: 'tilt_sample', timestamp: 0, tiltAngle: 0, angularVelocity: 0, ballCount: 1 },
      { type: 'tilt_sample', timestamp: 60000, tiltAngle: 0, angularVelocity: 0, ballCount: 1 },
      // 3 ball drops in that minute
      { type: 'ball_drop', ballId: 'b1', side: 'left', tiltAngle: 0.1, ballsRemaining: 0, timeOnPlankMs: 5000, timestamp: 10000 },
      { type: 'ball_drop', ballId: 'b2', side: 'right', tiltAngle: -0.1, ballsRemaining: 0, timeOnPlankMs: 8000, timestamp: 30000 },
      { type: 'ball_drop', ballId: 'b3', side: 'left', tiltAngle: 0.05, ballsRemaining: 1, timeOnPlankMs: 12000, timestamp: 50000 },
    ];

    const result = computeSkyBalanceMetrics(events);
    // 3 drops in 1 minute = 3.0 drops/min
    expect(result.drop_rate).toBe(3);
  });

  it('should compute avg_time_on_plank from ball drops', () => {
    const events: GameEvent[] = [
      { type: 'ball_drop', ballId: 'b1', side: 'left', tiltAngle: 0.1, ballsRemaining: 0, timeOnPlankMs: 5000, timestamp: 10000 },
      { type: 'ball_drop', ballId: 'b2', side: 'right', tiltAngle: -0.1, ballsRemaining: 0, timeOnPlankMs: 15000, timestamp: 30000 },
    ];

    const result = computeSkyBalanceMetrics(events);
    // avg = (5000+15000)/2 = 10000
    expect(result.avg_time_on_plank).toBe(10000);
  });

  it('should handle mixed event types correctly', () => {
    const events: GameEvent[] = [
      { type: 'ball_spawn', ballId: 'b1', timestamp: 0 },
      { type: 'tilt_sample', timestamp: 100, tiltAngle: 0.05, angularVelocity: 0.5, ballCount: 1 },
      { type: 'ball_spawn', ballId: 'b2', timestamp: 3500 },
      { type: 'tilt_sample', timestamp: 3600, tiltAngle: -0.1, angularVelocity: -1.5, ballCount: 2 },
      { type: 'ball_drop', ballId: 'b1', side: 'right', tiltAngle: 0.2, ballsRemaining: 1, timeOnPlankMs: 7000, timestamp: 7000 },
      { type: 'tilt_sample', timestamp: 7100, tiltAngle: 0.02, angularVelocity: 0.2, ballCount: 1 },
    ];

    const result = computeSkyBalanceMetrics(events);
    expect(result.max_balls_balanced).toBe(2);
    expect(result.avg_time_on_plank).toBe(7000);
    expect(result.balance_stability).toBeGreaterThan(0);
    expect(result.correction_smoothness).toBeGreaterThan(0);
  });
});
