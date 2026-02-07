import { describe, it, expect } from 'vitest';
import { computeStarSequenceMetrics } from './star-sequence.calculator.js';
import type { GameEvent } from '@kite/shared';

describe('computeStarSequenceMetrics', () => {
  it('should return zeros for empty events', () => {
    const result = computeStarSequenceMetrics([]);
    expect(result.max_sequence_length).toBe(0);
    expect(result.memory_accuracy).toBe(0);
    expect(result.learning_rate).toBe(0);
  });

  it('should compute max sequence length', () => {
    const events: GameEvent[] = [
      { type: 'round', roundNumber: 1, sequenceLength: 2, sequenceShown: [0, 1], sequenceTapped: [0, 1], correct: true, tapTimestamps: [100, 200], interTapIntervals: [100] },
      { type: 'round', roundNumber: 2, sequenceLength: 3, sequenceShown: [0, 1, 2], sequenceTapped: [0, 1, 2], correct: true, tapTimestamps: [100, 200, 300], interTapIntervals: [100, 100] },
      { type: 'round', roundNumber: 3, sequenceLength: 4, sequenceShown: [0, 1, 2, 3], sequenceTapped: [0, 1, 3, 2], correct: false, tapTimestamps: [100, 200, 300, 400], interTapIntervals: [100, 100, 100] },
      { type: 'round', roundNumber: 4, sequenceLength: 4, sequenceShown: [0, 1, 2, 3], sequenceTapped: [0, 1, 2, 3], correct: true, tapTimestamps: [100, 200, 300, 400], interTapIntervals: [100, 100, 100] },
    ];

    const result = computeStarSequenceMetrics(events);
    expect(result.max_sequence_length).toBe(4);
    expect(result.memory_accuracy).toBe(0.75); // 3/4 correct
  });

  it('should compute spatial error pattern', () => {
    const events: GameEvent[] = [
      { type: 'round', roundNumber: 1, sequenceLength: 2, sequenceShown: [0, 1], sequenceTapped: [0, 2], correct: false, tapTimestamps: [100, 200], interTapIntervals: [100] },
      { type: 'round', roundNumber: 2, sequenceLength: 2, sequenceShown: [0, 1], sequenceTapped: [0, 2], correct: false, tapTimestamps: [100, 200], interTapIntervals: [100] },
    ];

    const result = computeStarSequenceMetrics(events);
    // Position 1 confused with position 2, twice
    expect(result.spatial_error_pattern['1->2']).toBe(2);
  });
});
