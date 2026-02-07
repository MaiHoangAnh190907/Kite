import type { GameEvent, TraceEvent, PathCompleteEvent } from '@kite/shared';

export interface WindTrailsMetrics {
  motor_precision: number;
  motor_smoothness: number;
  completion_rate: number;
  speed_accuracy_ratio: number;
}

export function computeWindTrailsMetrics(events: GameEvent[]): WindTrailsMetrics {
  const traces = events.filter((e): e is TraceEvent => e.type === 'trace');
  const pathCompletes = events.filter((e): e is PathCompleteEvent => e.type === 'path_complete');

  if (pathCompletes.length === 0) {
    return {
      motor_precision: 0,
      motor_smoothness: 0,
      completion_rate: 0,
      speed_accuracy_ratio: 0,
    };
  }

  // motor_precision: mean deviation, normalized to path width (use raw mean deviation)
  const motor_precision =
    pathCompletes.reduce((sum, p) => sum + p.meanDeviation, 0) / pathCompletes.length;

  // motor_smoothness: compute jerk (change in acceleration) from trace events
  // Group traces by path index
  const pathTraces = new Map<number, TraceEvent[]>();
  for (const t of traces) {
    if (!pathTraces.has(t.pathIndex)) pathTraces.set(t.pathIndex, []);
    pathTraces.get(t.pathIndex)!.push(t);
  }

  let totalJerk = 0;
  let jerkCount = 0;
  for (const [, pathTrace] of pathTraces) {
    if (pathTrace.length < 4) continue;

    // Calculate jerk: third derivative of position
    const speeds: number[] = [];
    for (let i = 1; i < pathTrace.length; i++) {
      const dt = pathTrace[i]!.timestamp - pathTrace[i - 1]!.timestamp;
      if (dt <= 0) continue;
      const dx = pathTrace[i]!.fingerPosition.x - pathTrace[i - 1]!.fingerPosition.x;
      const dy = pathTrace[i]!.fingerPosition.y - pathTrace[i - 1]!.fingerPosition.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      speeds.push(dist / dt);
    }

    // Acceleration from speeds
    const accelerations: number[] = [];
    for (let i = 1; i < speeds.length; i++) {
      const dt = (pathTrace[i + 1]?.timestamp ?? pathTrace[i]!.timestamp) - pathTrace[i]!.timestamp;
      if (dt <= 0) continue;
      accelerations.push((speeds[i]! - speeds[i - 1]!) / dt);
    }

    // Jerk from accelerations
    for (let i = 1; i < accelerations.length; i++) {
      totalJerk += Math.abs(accelerations[i]! - accelerations[i - 1]!);
      jerkCount++;
    }
  }

  const motor_smoothness = jerkCount > 0 ? totalJerk / jerkCount : 0;

  // completion_rate: mean completion percent across paths
  const completion_rate =
    pathCompletes.reduce((sum, p) => sum + p.completionPercent, 0) / pathCompletes.length;

  // speed_accuracy_ratio: average speed / average precision (higher = faster but less accurate)
  const avgSpeed = traces.length > 0
    ? traces.reduce((sum, t) => sum + t.speed, 0) / traces.length
    : 0;
  const speed_accuracy_ratio = motor_precision > 0 ? avgSpeed / motor_precision : 0;

  return {
    motor_precision: round4(motor_precision),
    motor_smoothness: round4(motor_smoothness),
    completion_rate: round4(completion_rate),
    speed_accuracy_ratio: round4(speed_accuracy_ratio),
  };
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
