import { db } from '../db/connection.js';
import { logger } from '../config/logger.js';

const DISCLAIMER = 'This is a developmental pattern observation, not a clinical diagnosis.';

export async function evaluateFlags(
  patientId: string,
  sessionId: string,
): Promise<void> {
  const session = await db('sessions').where({ id: sessionId }).first();
  if (!session) return;

  const clinicId = session.clinic_id;

  // Get metrics computed for this session
  const sessionMetrics = await db('patient_metrics').where({ session_id: sessionId });

  // ========== Threshold flags (per-session) ==========
  for (const metric of sessionMetrics) {
    if (metric.percentile == null) continue;

    const percentile = Number(metric.percentile);

    if (percentile < 5) {
      await createFlagIfNotExists({
        patientId,
        clinicId,
        sessionId,
        flagType: 'below_threshold',
        severity: 'red',
        metricName: metric.metric_name,
        gameType: metric.game_type,
        currentValue: Number(metric.metric_value),
        thresholdValue: 5,
        description: `${formatMetricName(metric.metric_name)} is in the ${percentile}th percentile for age (below 5th). ${DISCLAIMER}`,
      });
    } else if (percentile < 15) {
      await createFlagIfNotExists({
        patientId,
        clinicId,
        sessionId,
        flagType: 'below_threshold',
        severity: 'amber',
        metricName: metric.metric_name,
        gameType: metric.game_type,
        currentValue: Number(metric.metric_value),
        thresholdValue: 15,
        description: `${formatMetricName(metric.metric_name)} is in the ${percentile}th percentile for age (below 15th). ${DISCLAIMER}`,
      });
    }
  }

  // ========== Trend flags (across 3+ sessions) ==========
  // Get unique metrics for this patient
  const uniqueMetrics = await db('patient_metrics')
    .where({ patient_id: patientId })
    .distinct('metric_name', 'game_type');

  for (const um of uniqueMetrics) {
    const history = await db('patient_metrics')
      .where({
        patient_id: patientId,
        metric_name: um.metric_name,
        game_type: um.game_type,
      })
      .orderBy('recorded_at', 'asc');

    if (history.length < 3) continue;

    const values = history.map((h: Record<string, unknown>) => Number(h.metric_value));
    const percentiles = history
      .map((h: Record<string, unknown>) => h.percentile != null ? Number(h.percentile) : null)
      .filter((p): p is number => p !== null);

    // Declining trend: negative slope AND latest below 30th percentile
    const slope = linearRegressionSlope(values);
    const latestPercentile = percentiles.length > 0 ? percentiles[percentiles.length - 1]! : null;

    if (slope < -0.01 && latestPercentile !== null && latestPercentile < 30) {
      await createFlagIfNotExists({
        patientId,
        clinicId,
        sessionId: null,
        flagType: 'declining_trend',
        severity: 'amber',
        metricName: um.metric_name,
        gameType: um.game_type,
        currentValue: values[values.length - 1]!,
        thresholdValue: null,
        description: `${formatMetricName(um.metric_name)} shows a declining trend across ${history.length} sessions. ${DISCLAIMER}`,
      });
    }

    // Variability flag: CV > 0.4
    if (values.length >= 3) {
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      if (mean > 0) {
        const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
        const cv = Math.sqrt(variance) / mean;
        if (cv > 0.4) {
          await createFlagIfNotExists({
            patientId,
            clinicId,
            sessionId: null,
            flagType: 'high_variability',
            severity: 'amber',
            metricName: um.metric_name,
            gameType: um.game_type,
            currentValue: values[values.length - 1]!,
            thresholdValue: null,
            description: `${formatMetricName(um.metric_name)} shows high variability across sessions (CV=${Math.round(cv * 100) / 100}). ${DISCLAIMER}`,
          });
        }
      }
    }
  }

  logger.info({ patientId, sessionId }, 'Flag evaluation completed');
}

interface CreateFlagParams {
  patientId: string;
  clinicId: string;
  sessionId: string | null;
  flagType: string;
  severity: string;
  metricName: string;
  gameType: string;
  currentValue: number;
  thresholdValue: number | null;
  description: string;
}

async function createFlagIfNotExists(params: CreateFlagParams): Promise<void> {
  // Check for existing active (non-dismissed) flag with same patient + metric + flag_type
  const existing = await db('flags')
    .where({
      patient_id: params.patientId,
      metric_name: params.metricName,
      flag_type: params.flagType,
      is_dismissed: false,
    })
    .first();

  if (existing) return; // Deduplicate

  await db('flags').insert({
    patient_id: params.patientId,
    clinic_id: params.clinicId,
    session_id: params.sessionId,
    flag_type: params.flagType,
    severity: params.severity,
    metric_name: params.metricName,
    game_type: params.gameType,
    description: params.description,
    current_value: params.currentValue,
    threshold_value: params.thresholdValue,
  });
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

function formatMetricName(name: string): string {
  return name
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
