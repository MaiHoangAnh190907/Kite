import * as SecureStore from 'expo-secure-store';

import { uploadEvents, completeSession } from './api';

const QUEUE_KEY = 'kite_upload_queue';
const MAX_RETRIES = 10;
const BACKOFF_SCHEDULE_MS = [5_000, 15_000, 60_000, 300_000]; // 5s, 15s, 1min, 5min

interface QueuedUpload {
  id: string;
  sessionId: string;
  gameType: string;
  events: unknown[];
  startedAt: string;
  completedAt: string;
  durationMs: number;
  retryCount: number;
  createdAt: string;
}

interface QueuedComplete {
  id: string;
  sessionId: string;
  gamesCompleted: number;
  totalDurationMs: number;
  retryCount: number;
  createdAt: string;
}

interface UploadQueue {
  uploads: QueuedUpload[];
  completions: QueuedComplete[];
}

async function getQueue(): Promise<UploadQueue> {
  const raw = await SecureStore.getItemAsync(QUEUE_KEY);
  if (!raw) return { uploads: [], completions: [] };
  try {
    return JSON.parse(raw) as UploadQueue;
  } catch {
    return { uploads: [], completions: [] };
  }
}

async function saveQueue(queue: UploadQueue): Promise<void> {
  await SecureStore.setItemAsync(QUEUE_KEY, JSON.stringify(queue));
}

export async function queueUpload(
  sessionId: string,
  gameType: string,
  events: unknown[],
  startedAt: string,
  completedAt: string,
  durationMs: number,
): Promise<void> {
  const queue = await getQueue();
  queue.uploads.push({
    id: `${sessionId}-${gameType}-${Date.now()}`,
    sessionId,
    gameType,
    events,
    startedAt,
    completedAt,
    durationMs,
    retryCount: 0,
    createdAt: new Date().toISOString(),
  });
  await saveQueue(queue);
}

export async function queueCompletion(
  sessionId: string,
  gamesCompleted: number,
  totalDurationMs: number,
): Promise<void> {
  const queue = await getQueue();
  queue.completions.push({
    id: `${sessionId}-complete-${Date.now()}`,
    sessionId,
    gamesCompleted,
    totalDurationMs,
    retryCount: 0,
    createdAt: new Date().toISOString(),
  });
  await saveQueue(queue);
}

export async function getPendingCount(): Promise<number> {
  const queue = await getQueue();
  return queue.uploads.length + queue.completions.length;
}

export async function flushQueue(): Promise<{ succeeded: number; failed: number }> {
  const queue = await getQueue();
  let succeeded = 0;
  let failed = 0;

  // Process uploads
  const remainingUploads: QueuedUpload[] = [];
  for (const item of queue.uploads) {
    try {
      await uploadEvents(
        item.sessionId,
        item.gameType,
        item.events,
        item.startedAt,
        item.completedAt,
        item.durationMs,
      );
      succeeded++;
    } catch {
      item.retryCount++;
      if (item.retryCount < MAX_RETRIES) {
        remainingUploads.push(item);
      }
      failed++;
    }
  }

  // Process completions
  const remainingCompletions: QueuedComplete[] = [];
  for (const item of queue.completions) {
    try {
      await completeSession(
        item.sessionId,
        item.gamesCompleted,
        item.totalDurationMs,
      );
      succeeded++;
    } catch {
      item.retryCount++;
      if (item.retryCount < MAX_RETRIES) {
        remainingCompletions.push(item);
      }
      failed++;
    }
  }

  await saveQueue({ uploads: remainingUploads, completions: remainingCompletions });
  return { succeeded, failed };
}

// Start background retry with exponential backoff
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryAttempt = 0;

export function startBackgroundRetry(): void {
  if (retryTimer) return;

  const tryFlush = async () => {
    const count = await getPendingCount();
    if (count === 0) {
      retryTimer = null;
      retryAttempt = 0;
      return;
    }

    const { succeeded } = await flushQueue();
    if (succeeded > 0) {
      retryAttempt = 0; // Reset backoff on success
    } else {
      retryAttempt++;
    }

    const remaining = await getPendingCount();
    if (remaining > 0) {
      const delay = BACKOFF_SCHEDULE_MS[Math.min(retryAttempt, BACKOFF_SCHEDULE_MS.length - 1)];
      retryTimer = setTimeout(tryFlush, delay);
    } else {
      retryTimer = null;
      retryAttempt = 0;
    }
  };

  retryTimer = setTimeout(tryFlush, BACKOFF_SCHEDULE_MS[0]);
}

export function stopBackgroundRetry(): void {
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
  retryAttempt = 0;
}
