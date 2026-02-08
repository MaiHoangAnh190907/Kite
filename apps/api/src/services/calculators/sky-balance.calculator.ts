import type { GameEvent } from '@kite/shared';

export interface SkyBalanceMetrics {
  balance_stability: number;
  tilt_variability: number;
  correction_smoothness: number;
  max_balls_balanced: number;
  avg_balls_balanced: number;
  drop_rate: number;
  avg_time_on_plank: number;
}

interface TiltSample {
  type: 'tilt_sample';
  timestamp: number;
  tiltAngle: number;
  angularVelocity: number;
  ballCount: number;
}

interface BallDrop {
  type: 'ball_drop';
  ballId: string;
  side: string;
  tiltAngle: number;
  ballsRemaining: number;
  timeOnPlankMs: number;
  timestamp: number;
}

export function computeSkyBalanceMetrics(events: GameEvent[]): SkyBalanceMetrics {
  const tiltSamples = events.filter(
    (e): e is TiltSample & GameEvent => e.type === 'tilt_sample',
  );
  const ballDrops = events.filter(
    (e): e is BallDrop & GameEvent => e.type === 'ball_drop',
  );

  // balance_stability: RMS of tilt angle (lower = better)
  let balance_stability = 0;
  if (tiltSamples.length > 0) {
    const sumSquares = tiltSamples.reduce(
      (sum, s) => sum + (s.tiltAngle as number) ** 2,
      0,
    );
    balance_stability = Math.sqrt(sumSquares / tiltSamples.length);
  }

  // tilt_variability: std deviation of tilt angle
  let tilt_variability = 0;
  if (tiltSamples.length > 1) {
    const angles = tiltSamples.map((s) => s.tiltAngle as number);
    const mean = angles.reduce((a, b) => a + b, 0) / angles.length;
    const variance =
      angles.reduce((sum, a) => sum + (a - mean) ** 2, 0) / angles.length;
    tilt_variability = Math.sqrt(variance);
  }

  // correction_smoothness: mean |angularVelocity| (lower = smoother)
  let correction_smoothness = 0;
  if (tiltSamples.length > 0) {
    const totalAbsVelocity = tiltSamples.reduce(
      (sum, s) => sum + Math.abs(s.angularVelocity as number),
      0,
    );
    correction_smoothness = totalAbsVelocity / tiltSamples.length;
  }

  // max_balls_balanced: peak concurrent balls
  let max_balls_balanced = 0;
  for (const s of tiltSamples) {
    const count = s.ballCount as number;
    if (count > max_balls_balanced) {
      max_balls_balanced = count;
    }
  }

  // avg_balls_balanced: mean ball count across tilt samples
  let avg_balls_balanced = 0;
  if (tiltSamples.length > 0) {
    const totalBalls = tiltSamples.reduce(
      (sum, s) => sum + (s.ballCount as number),
      0,
    );
    avg_balls_balanced = totalBalls / tiltSamples.length;
  }

  // drop_rate: balls dropped per minute
  let drop_rate = 0;
  if (tiltSamples.length > 0) {
    const timestamps = tiltSamples.map((s) => s.timestamp as number);
    const durationMs = Math.max(...timestamps) - Math.min(...timestamps);
    const durationMin = durationMs / 60_000;
    drop_rate = durationMin > 0 ? ballDrops.length / durationMin : 0;
  }

  // avg_time_on_plank: mean time each ball survived before falling (ms)
  let avg_time_on_plank = 0;
  if (ballDrops.length > 0) {
    const totalTime = ballDrops.reduce(
      (sum, d) => sum + (d.timeOnPlankMs as number),
      0,
    );
    avg_time_on_plank = totalTime / ballDrops.length;
  }

  return {
    balance_stability: round4(balance_stability),
    tilt_variability: round4(tilt_variability),
    correction_smoothness: round4(correction_smoothness),
    max_balls_balanced,
    avg_balls_balanced: round4(avg_balls_balanced),
    drop_rate: round4(drop_rate),
    avg_time_on_plank: round4(avg_time_on_plank),
  };
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
