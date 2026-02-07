import { describe, it, expect } from 'vitest';
import { getPercentile } from './normative.service.js';

describe('normative service', () => {
  describe('getPercentile', () => {
    it('should return null for age outside supported range', () => {
      expect(getPercentile('attention_accuracy', 36, 0.8)).toBeNull();
      expect(getPercentile('attention_accuracy', 90, 0.8)).toBeNull();
    });

    it('should return null for unknown metric', () => {
      expect(getPercentile('unknown_metric', 60, 0.5)).toBeNull();
    });

    it('should return high percentile for high attention_accuracy at age 60mo', () => {
      // 60-65 age group: p95 = 0.95
      const percentile = getPercentile('attention_accuracy', 62, 0.96);
      expect(percentile).toBe(97);
    });

    it('should return low percentile for low attention_accuracy', () => {
      // 60-65 age group: p5 = 0.55
      const percentile = getPercentile('attention_accuracy', 62, 0.50);
      expect(percentile).toBe(3);
    });

    it('should return mid percentile for average attention_accuracy', () => {
      // 60-65 age group: p50 = 0.80
      const percentile = getPercentile('attention_accuracy', 62, 0.78);
      expect(percentile).toBe(37);
    });

    it('should handle lower-is-better metrics (reaction time)', () => {
      // 60-65 age group: p5 = 380 (best, fastest)
      // Very fast reaction time should get high percentile
      const percentile = getPercentile('reaction_time_mean', 62, 350);
      expect(percentile).toBe(97);
    });

    it('should handle slow reaction time as low percentile', () => {
      // 60-65 age group: p95 = 1000 (worst)
      const percentile = getPercentile('reaction_time_mean', 62, 1100);
      expect(percentile).toBe(3);
    });

    it('should handle max_sequence_length for 5yo', () => {
      // 60-65: p50 = 4
      const percentile = getPercentile('max_sequence_length', 62, 4);
      expect(percentile).toBe(37);
    });
  });
});
