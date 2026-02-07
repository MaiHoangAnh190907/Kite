/**
 * Normative percentile service.
 *
 * Phase 1: hardcoded lookup tables based on published developmental norms.
 * Age groups: 48-53mo, 54-59mo, 60-65mo, 66-71mo, 72-77mo, 78-83mo
 *
 * Each table maps percentile thresholds (p5, p15, p25, p50, p75, p85, p95).
 */

interface PercentileBands {
  p5: number;
  p15: number;
  p25: number;
  p50: number;
  p75: number;
  p85: number;
  p95: number;
}

type AgeGroup = '48-53' | '54-59' | '60-65' | '66-71' | '72-77' | '78-83';

function getAgeGroup(ageMonths: number): AgeGroup | null {
  if (ageMonths >= 48 && ageMonths <= 53) return '48-53';
  if (ageMonths >= 54 && ageMonths <= 59) return '54-59';
  if (ageMonths >= 60 && ageMonths <= 65) return '60-65';
  if (ageMonths >= 66 && ageMonths <= 71) return '66-71';
  if (ageMonths >= 72 && ageMonths <= 77) return '72-77';
  if (ageMonths >= 78 && ageMonths <= 83) return '78-83';
  return null;
}

// Higher is better metrics
const higherIsBetter: Record<string, Record<AgeGroup, PercentileBands>> = {
  attention_accuracy: {
    '48-53': { p5: 0.45, p15: 0.55, p25: 0.62, p50: 0.72, p75: 0.80, p85: 0.85, p95: 0.92 },
    '54-59': { p5: 0.50, p15: 0.60, p25: 0.67, p50: 0.76, p75: 0.83, p85: 0.88, p95: 0.94 },
    '60-65': { p5: 0.55, p15: 0.65, p25: 0.72, p50: 0.80, p75: 0.86, p85: 0.90, p95: 0.95 },
    '66-71': { p5: 0.58, p15: 0.68, p25: 0.75, p50: 0.83, p75: 0.88, p85: 0.92, p95: 0.96 },
    '72-77': { p5: 0.62, p15: 0.72, p25: 0.78, p50: 0.85, p75: 0.90, p85: 0.93, p95: 0.97 },
    '78-83': { p5: 0.65, p15: 0.74, p25: 0.80, p50: 0.87, p75: 0.92, p85: 0.95, p95: 0.98 },
  },
  memory_accuracy: {
    '48-53': { p5: 0.30, p15: 0.40, p25: 0.48, p50: 0.60, p75: 0.70, p85: 0.78, p95: 0.88 },
    '54-59': { p5: 0.35, p15: 0.45, p25: 0.53, p50: 0.65, p75: 0.75, p85: 0.82, p95: 0.90 },
    '60-65': { p5: 0.40, p15: 0.50, p25: 0.58, p50: 0.70, p75: 0.80, p85: 0.86, p95: 0.92 },
    '66-71': { p5: 0.45, p15: 0.55, p25: 0.63, p50: 0.74, p75: 0.83, p85: 0.88, p95: 0.94 },
    '72-77': { p5: 0.48, p15: 0.58, p25: 0.66, p50: 0.77, p75: 0.85, p85: 0.90, p95: 0.95 },
    '78-83': { p5: 0.52, p15: 0.62, p25: 0.70, p50: 0.80, p75: 0.88, p85: 0.92, p95: 0.96 },
  },
  max_sequence_length: {
    '48-53': { p5: 1, p15: 2, p25: 2, p50: 3, p75: 3, p85: 4, p95: 5 },
    '54-59': { p5: 2, p15: 2, p25: 3, p50: 3, p75: 4, p85: 4, p95: 5 },
    '60-65': { p5: 2, p15: 3, p25: 3, p50: 4, p75: 4, p85: 5, p95: 6 },
    '66-71': { p5: 2, p15: 3, p25: 3, p50: 4, p75: 5, p85: 5, p95: 6 },
    '72-77': { p5: 3, p15: 3, p25: 4, p50: 5, p75: 5, p85: 6, p95: 7 },
    '78-83': { p5: 3, p15: 4, p25: 4, p50: 5, p75: 6, p85: 6, p95: 7 },
  },
  sort_accuracy: {
    '48-53': { p5: 0.40, p15: 0.50, p25: 0.57, p50: 0.67, p75: 0.75, p85: 0.82, p95: 0.90 },
    '54-59': { p5: 0.45, p15: 0.55, p25: 0.62, p50: 0.72, p75: 0.80, p85: 0.86, p95: 0.92 },
    '60-65': { p5: 0.50, p15: 0.60, p25: 0.67, p50: 0.76, p75: 0.83, p85: 0.88, p95: 0.94 },
    '66-71': { p5: 0.55, p15: 0.65, p25: 0.72, p50: 0.80, p75: 0.86, p85: 0.90, p95: 0.95 },
    '72-77': { p5: 0.58, p15: 0.68, p25: 0.75, p50: 0.83, p75: 0.88, p85: 0.92, p95: 0.96 },
    '78-83': { p5: 0.62, p15: 0.72, p25: 0.78, p50: 0.85, p75: 0.90, p85: 0.93, p95: 0.97 },
  },
  completion_rate: {
    '48-53': { p5: 0.40, p15: 0.52, p25: 0.60, p50: 0.72, p75: 0.82, p85: 0.88, p95: 0.95 },
    '54-59': { p5: 0.48, p15: 0.58, p25: 0.66, p50: 0.77, p75: 0.85, p85: 0.90, p95: 0.96 },
    '60-65': { p5: 0.55, p15: 0.65, p25: 0.72, p50: 0.82, p75: 0.88, p85: 0.92, p95: 0.97 },
    '66-71': { p5: 0.60, p15: 0.70, p25: 0.76, p50: 0.85, p75: 0.90, p85: 0.94, p95: 0.98 },
    '72-77': { p5: 0.65, p15: 0.74, p25: 0.80, p50: 0.87, p75: 0.92, p85: 0.95, p95: 0.98 },
    '78-83': { p5: 0.70, p15: 0.78, p25: 0.84, p50: 0.90, p75: 0.94, p85: 0.96, p95: 0.99 },
  },
  processing_speed: {
    '48-53': { p5: 5, p15: 8, p25: 10, p50: 14, p75: 18, p85: 22, p95: 28 },
    '54-59': { p5: 7, p15: 10, p25: 13, p50: 17, p75: 22, p85: 26, p95: 32 },
    '60-65': { p5: 9, p15: 13, p25: 16, p50: 20, p75: 25, p85: 30, p95: 36 },
    '66-71': { p5: 11, p15: 15, p25: 18, p50: 23, p75: 28, p85: 33, p95: 40 },
    '72-77': { p5: 13, p15: 17, p25: 21, p50: 26, p75: 32, p85: 37, p95: 44 },
    '78-83': { p5: 15, p15: 20, p25: 24, p50: 30, p75: 36, p85: 42, p95: 50 },
  },
};

// Lower is better metrics (e.g., reaction time — lower = faster)
const lowerIsBetter: Record<string, Record<AgeGroup, PercentileBands>> = {
  reaction_time_mean: {
    '48-53': { p5: 450, p15: 520, p25: 580, p50: 700, p75: 850, p85: 950, p95: 1200 },
    '54-59': { p5: 420, p15: 490, p25: 540, p50: 650, p75: 790, p85: 880, p95: 1100 },
    '60-65': { p5: 380, p15: 450, p25: 500, p50: 600, p75: 720, p85: 810, p95: 1000 },
    '66-71': { p5: 350, p15: 410, p25: 460, p50: 550, p75: 660, p85: 750, p95: 920 },
    '72-77': { p5: 320, p15: 380, p25: 420, p50: 510, p75: 620, p85: 700, p95: 860 },
    '78-83': { p5: 300, p15: 350, p25: 400, p50: 480, p75: 580, p85: 660, p95: 810 },
  },
  reaction_time_cv: {
    '48-53': { p5: 0.12, p15: 0.18, p25: 0.22, p50: 0.30, p75: 0.40, p85: 0.48, p95: 0.60 },
    '54-59': { p5: 0.10, p15: 0.16, p25: 0.20, p50: 0.27, p75: 0.36, p85: 0.44, p95: 0.55 },
    '60-65': { p5: 0.09, p15: 0.14, p25: 0.18, p50: 0.25, p75: 0.33, p85: 0.40, p95: 0.50 },
    '66-71': { p5: 0.08, p15: 0.12, p25: 0.16, p50: 0.22, p75: 0.30, p85: 0.36, p95: 0.46 },
    '72-77': { p5: 0.07, p15: 0.11, p25: 0.15, p50: 0.20, p75: 0.28, p85: 0.34, p95: 0.42 },
    '78-83': { p5: 0.06, p15: 0.10, p25: 0.14, p50: 0.19, p75: 0.26, p85: 0.32, p95: 0.40 },
  },
  false_positive_rate: {
    '48-53': { p5: 0.02, p15: 0.05, p25: 0.08, p50: 0.15, p75: 0.23, p85: 0.30, p95: 0.42 },
    '54-59': { p5: 0.02, p15: 0.04, p25: 0.07, p50: 0.13, p75: 0.20, p85: 0.27, p95: 0.38 },
    '60-65': { p5: 0.01, p15: 0.03, p25: 0.06, p50: 0.11, p75: 0.18, p85: 0.24, p95: 0.34 },
    '66-71': { p5: 0.01, p15: 0.03, p25: 0.05, p50: 0.10, p75: 0.16, p85: 0.21, p95: 0.30 },
    '72-77': { p5: 0.01, p15: 0.02, p25: 0.04, p50: 0.08, p75: 0.14, p85: 0.19, p95: 0.27 },
    '78-83': { p5: 0.01, p15: 0.02, p25: 0.04, p50: 0.07, p75: 0.12, p85: 0.17, p95: 0.24 },
  },
  motor_precision: {
    '48-53': { p5: 2, p15: 5, p25: 8, p50: 14, p75: 22, p85: 30, p95: 42 },
    '54-59': { p5: 2, p15: 4, p25: 7, p50: 12, p75: 19, p85: 26, p95: 38 },
    '60-65': { p5: 1, p15: 3, p25: 6, p50: 10, p75: 16, p85: 22, p95: 34 },
    '66-71': { p5: 1, p15: 3, p25: 5, p50: 9, p75: 14, p85: 20, p95: 30 },
    '72-77': { p5: 1, p15: 2, p25: 4, p50: 8, p75: 12, p85: 18, p95: 26 },
    '78-83': { p5: 1, p15: 2, p25: 4, p50: 7, p75: 11, p85: 16, p95: 24 },
  },
};

export function getPercentile(
  metricName: string,
  ageMonths: number,
  value: number,
): number | null {
  const ageGroup = getAgeGroup(ageMonths);
  if (!ageGroup) return null;

  // Check higher-is-better tables
  const higherTable = higherIsBetter[metricName];
  if (higherTable) {
    const bands = higherTable[ageGroup];
    if (!bands) return null;
    return interpolateHigherIsBetter(value, bands);
  }

  // Check lower-is-better tables
  const lowerTable = lowerIsBetter[metricName];
  if (lowerTable) {
    const bands = lowerTable[ageGroup];
    if (!bands) return null;
    return interpolateLowerIsBetter(value, bands);
  }

  // No normative data for this metric
  return null;
}

function interpolateHigherIsBetter(value: number, bands: PercentileBands): number {
  if (value <= bands.p5) return 3;
  if (value <= bands.p15) return 10;
  if (value <= bands.p25) return 20;
  if (value <= bands.p50) return 37;
  if (value <= bands.p75) return 62;
  if (value <= bands.p85) return 80;
  if (value <= bands.p95) return 90;
  return 97;
}

function interpolateLowerIsBetter(value: number, bands: PercentileBands): number {
  // For lower-is-better: value <= p5 means 97th percentile (best)
  if (value <= bands.p5) return 97;
  if (value <= bands.p15) return 90;
  if (value <= bands.p25) return 80;
  if (value <= bands.p50) return 62;
  if (value <= bands.p75) return 37;
  if (value <= bands.p85) return 20;
  if (value <= bands.p95) return 10;
  return 3;
}
