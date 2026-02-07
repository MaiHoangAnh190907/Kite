import type { GameEvent, SortEvent, RuleSwitchEvent } from '@kite/shared';

export interface SkySortMetrics {
  processing_speed: number;
  sort_accuracy: number;
  switch_cost: number;
  error_recovery_time: number;
}

export function computeSkySortMetrics(events: GameEvent[]): SkySortMetrics {
  const sorts = events.filter((e): e is SortEvent => e.type === 'sort');
  const switches = events.filter((e): e is RuleSwitchEvent => e.type === 'rule_switch');

  if (sorts.length === 0) {
    return {
      processing_speed: 0,
      sort_accuracy: 0,
      switch_cost: 0,
      error_recovery_time: 0,
    };
  }

  // processing_speed: correct_sorts / total_time_minutes
  const correctSorts = sorts.filter((s) => s.correct);
  const timestamps = sorts.map((s) => s.sortTimestamp);
  const totalTimeMs = timestamps.length > 1
    ? Math.max(...timestamps) - Math.min(...timestamps)
    : 1;
  const totalTimeMinutes = totalTimeMs / 60000;
  const processing_speed = totalTimeMinutes > 0 ? correctSorts.length / totalTimeMinutes : 0;

  // sort_accuracy: correct_sorts / total_sorts
  const sort_accuracy = sorts.length > 0 ? correctSorts.length / sorts.length : 0;

  // switch_cost: accuracy_after_switch (first 5) - accuracy_before_switch (last 5)
  let switch_cost = 0;
  if (switches.length > 0) {
    const switchTimestamps = switches.map((s) => s.timestamp);
    let totalCost = 0;
    let costCount = 0;

    for (const switchTs of switchTimestamps) {
      const beforeSorts = sorts
        .filter((s) => s.sortTimestamp < switchTs)
        .slice(-5);
      const afterSorts = sorts
        .filter((s) => s.sortTimestamp >= switchTs)
        .slice(0, 5);

      if (beforeSorts.length > 0 && afterSorts.length > 0) {
        const beforeAcc = beforeSorts.filter((s) => s.correct).length / beforeSorts.length;
        const afterAcc = afterSorts.filter((s) => s.correct).length / afterSorts.length;
        totalCost += beforeAcc - afterAcc;
        costCount++;
      }
    }

    switch_cost = costCount > 0 ? totalCost / costCount : 0;
  }

  // error_recovery_time: mean time from error to next correct sort
  let totalRecovery = 0;
  let recoveryCount = 0;
  for (let i = 0; i < sorts.length - 1; i++) {
    if (!sorts[i]!.correct) {
      // Find next correct sort
      for (let j = i + 1; j < sorts.length; j++) {
        if (sorts[j]!.correct) {
          totalRecovery += sorts[j]!.sortTimestamp - sorts[i]!.sortTimestamp;
          recoveryCount++;
          break;
        }
      }
    }
  }
  const error_recovery_time = recoveryCount > 0 ? totalRecovery / recoveryCount : 0;

  return {
    processing_speed: round4(processing_speed),
    sort_accuracy: round4(sort_accuracy),
    switch_cost: round4(switch_cost),
    error_recovery_time: round4(error_recovery_time),
  };
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
