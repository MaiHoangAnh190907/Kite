import type { GameEvent, RoundEvent } from '@kite/shared';

export interface ColorSequenceMetrics {
  max_sequence_length: number;
  memory_accuracy: number;
  learning_rate: number;
  spatial_error_pattern: Record<string, number>;
}

export function computeColorSequenceMetrics(events: GameEvent[]): ColorSequenceMetrics {
  const rounds = events.filter((e): e is RoundEvent => e.type === 'round');

  if (rounds.length === 0) {
    return {
      max_sequence_length: 0,
      memory_accuracy: 0,
      learning_rate: 0,
      spatial_error_pattern: {},
    };
  }

  // max_sequence_length: longest correct sequence
  const correctRounds = rounds.filter((r) => r.correct);
  const max_sequence_length =
    correctRounds.length > 0
      ? Math.max(...correctRounds.map((r) => r.sequenceLength))
      : 0;

  // memory_accuracy: correct_rounds / total_rounds
  const memory_accuracy = rounds.length > 0 ? correctRounds.length / rounds.length : 0;

  // learning_rate: linear regression slope of accuracy over rounds
  // Use a rolling accuracy (1 for correct, 0 for incorrect)
  const accuracyValues = rounds.map((r) => (r.correct ? 1 : 0));
  const learning_rate = linearRegressionSlope(accuracyValues);

  // spatial_error_pattern: frequency map of position confusions
  const errorMap: Record<string, number> = {};
  for (const round of rounds) {
    if (!round.correct) {
      for (let i = 0; i < Math.min(round.sequenceShown.length, round.sequenceTapped.length); i++) {
        if (round.sequenceShown[i] !== round.sequenceTapped[i]) {
          const key = `${round.sequenceShown[i]}->${round.sequenceTapped[i]}`;
          errorMap[key] = (errorMap[key] ?? 0) + 1;
        }
      }
    }
  }

  return {
    max_sequence_length,
    memory_accuracy: round4(memory_accuracy),
    learning_rate: round4(learning_rate),
    spatial_error_pattern: errorMap,
  };
}

function linearRegressionSlope(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;

  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i]!;
    sumXY += i * values[i]!;
    sumXX += i * i;
  }
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return 0;
  return (n * sumXY - sumX * sumY) / denom;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
