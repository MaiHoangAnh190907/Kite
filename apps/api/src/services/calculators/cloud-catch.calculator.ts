import type { GameEvent, TapEvent, StimulusEvent, MissEvent } from '@kite/shared';

export interface CloudCatchMetrics {
  attention_accuracy: number;
  reaction_time_mean: number;
  reaction_time_cv: number;
  false_positive_rate: number;
  attention_decay: number;
}

export function computeCloudCatchMetrics(events: GameEvent[]): CloudCatchMetrics {
  const stimuli = events.filter((e): e is StimulusEvent => e.type === 'stimulus');
  const taps = events.filter((e): e is TapEvent => e.type === 'tap');
  const misses = events.filter((e): e is MissEvent => e.type === 'miss');

  const goldenStimuli = stimuli.filter((s) => s.stimulusType === 'golden');
  const totalGoldenSpawned = goldenStimuli.length;

  const correctTaps = taps.filter((t) => t.correct);
  const incorrectTaps = taps.filter((t) => !t.correct);

  // attention_accuracy: golden_tapped / total_golden_spawned
  const goldenTapped = correctTaps.length;
  const attention_accuracy = totalGoldenSpawned > 0 ? goldenTapped / totalGoldenSpawned : 0;

  // reaction_time_mean: mean of reactionTimeMs for correct taps
  const reactionTimes = correctTaps.map((t) => t.reactionTimeMs);
  const reaction_time_mean =
    reactionTimes.length > 0
      ? reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length
      : 0;

  // reaction_time_cv: std / mean
  let reaction_time_cv = 0;
  if (reactionTimes.length > 1 && reaction_time_mean > 0) {
    const variance =
      reactionTimes.reduce((sum, rt) => sum + (rt - reaction_time_mean) ** 2, 0) /
      reactionTimes.length;
    reaction_time_cv = Math.sqrt(variance) / reaction_time_mean;
  }

  // false_positive_rate: storm_tapped / total_taps
  const false_positive_rate = taps.length > 0 ? incorrectTaps.length / taps.length : 0;

  // attention_decay: accuracy_last_30s / accuracy_first_30s
  // Use tap timestamps to split into first and last 30s
  const allTimestamps = taps.map((t) => t.timestamp);
  let attention_decay = 1;
  if (allTimestamps.length > 0) {
    const minT = Math.min(...allTimestamps);
    const maxT = Math.max(...allTimestamps);
    const duration = maxT - minT;

    if (duration > 0) {
      const first30Taps = taps.filter((t) => t.timestamp - minT < 30000);
      const last30Taps = taps.filter((t) => maxT - t.timestamp < 30000);

      const first30Accuracy =
        first30Taps.length > 0
          ? first30Taps.filter((t) => t.correct).length / first30Taps.length
          : 0;
      const last30Accuracy =
        last30Taps.length > 0
          ? last30Taps.filter((t) => t.correct).length / last30Taps.length
          : 0;

      attention_decay = first30Accuracy > 0 ? last30Accuracy / first30Accuracy : 1;
    }
  }

  return {
    attention_accuracy: round4(attention_accuracy),
    reaction_time_mean: round4(reaction_time_mean),
    reaction_time_cv: round4(reaction_time_cv),
    false_positive_rate: round4(false_positive_rate),
    attention_decay: round4(attention_decay),
  };
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
