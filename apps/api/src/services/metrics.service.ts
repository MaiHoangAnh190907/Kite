import { db } from '../db/connection.js';
import { logger } from '../config/logger.js';
import { computeCloudCatchMetrics } from './calculators/cloud-catch.calculator.js';
import { computeStarSequenceMetrics } from './calculators/star-sequence.calculator.js';
import { computeWindTrailsMetrics } from './calculators/wind-trails.calculator.js';
import { computeSkySortMetrics } from './calculators/sky-sort.calculator.js';
import { getPercentile } from './normative.service.js';
import type { GameEvent } from '@kite/shared';

export async function computeSessionMetrics(sessionId: string): Promise<void> {
  const session = await db('sessions').where({ id: sessionId }).first();
  if (!session) {
    logger.warn({ sessionId }, 'Session not found for metrics computation');
    return;
  }

  const gameResults = await db('game_results').where({ session_id: sessionId });

  for (const result of gameResults) {
    const events: GameEvent[] = result.raw_events as GameEvent[];
    let metrics: Record<string, number>;

    switch (result.game_type) {
      case 'cloud_catch':
        metrics = flattenMetrics(computeCloudCatchMetrics(events));
        break;
      case 'star_sequence':
        metrics = flattenMetrics(computeStarSequenceMetrics(events));
        break;
      case 'wind_trails':
        metrics = flattenMetrics(computeWindTrailsMetrics(events));
        break;
      case 'sky_sort':
        metrics = flattenMetrics(computeSkySortMetrics(events));
        break;
      default:
        logger.warn({ gameType: result.game_type }, 'Unknown game type for metrics');
        continue;
    }

    // Store each metric as a row in patient_metrics
    for (const [metricName, metricValue] of Object.entries(metrics)) {
      if (typeof metricValue !== 'number') continue;

      const percentile = getPercentile(metricName, session.patient_age_months, metricValue);

      await db('patient_metrics').insert({
        patient_id: session.patient_id,
        session_id: sessionId,
        game_type: result.game_type,
        metric_name: metricName,
        metric_value: metricValue,
        age_months: session.patient_age_months,
        percentile,
        recorded_at: result.started_at,
      });
    }

    // Update computed_metrics on game_results
    await db('game_results')
      .where({ id: result.id })
      .update({ computed_metrics: JSON.stringify(metrics) });
  }

  logger.info({ sessionId }, 'Metrics computed successfully');
}

function flattenMetrics(obj: object): Record<string, number> {
  const flat: Record<string, number> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'number') {
      flat[key] = value;
    }
    // Skip non-numeric values (e.g., spatial_error_pattern object)
  }
  return flat;
}
