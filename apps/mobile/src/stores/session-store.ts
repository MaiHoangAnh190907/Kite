import { create } from 'zustand';

import type { GameType, PatientListItem } from '../types';
import { uploadEvents, completeSession } from '../services/api';
import { queueUpload, queueCompletion, startBackgroundRetry } from '../services/upload-queue';

interface GameTiming {
  startedAt: string;
  completedAt: string | null;
  durationMs: number;
}

interface SessionState {
  // Session data
  sessionId: string | null;
  selectedPatient: PatientListItem | null;
  currentGameIndex: number;
  gameOrder: GameType[];
  eventsByGame: Partial<Record<GameType, unknown[]>>;
  gameTimings: Partial<Record<GameType, GameTiming>>;
  stickersEarned: string[];
  sessionStartedAt: string | null;
  isUploading: boolean;
  uploadError: string | null;

  // Actions
  selectPatient: (patient: PatientListItem) => void;
  startSession: (sessionId: string, games: GameType[]) => void;
  startGame: (game: GameType) => void;
  recordEvent: (game: GameType, event: unknown) => void;
  recordEvents: (game: GameType, events: unknown[]) => void;
  endGame: (game: GameType) => void;
  advanceGame: () => void;
  earnSticker: (sticker: string) => void;
  uploadSessionData: () => Promise<void>;
  resetSession: () => void;

  // Derived
  currentGame: () => GameType | null;
  isLastGame: () => boolean;
  gamesCompleted: () => number;
}

const STICKER_MAP: Record<GameType, string> = {
  cloud_catch: 'sun',
  star_sequence: 'constellation',
  sky_sigils: 'rainbow',
  wind_trails: 'feather',
};

export const useSessionStore = create<SessionState>((set, get) => ({
  sessionId: null,
  selectedPatient: null,
  currentGameIndex: 0,
  gameOrder: [],
  eventsByGame: {},
  gameTimings: {},
  stickersEarned: [],
  sessionStartedAt: null,
  isUploading: false,
  uploadError: null,

  selectPatient: (patient) => set({ selectedPatient: patient }),

  startSession: (sessionId, games) =>
    set({
      sessionId,
      gameOrder: games,
      currentGameIndex: 0,
      eventsByGame: {},
      gameTimings: {},
      stickersEarned: [],
      sessionStartedAt: new Date().toISOString(),
      isUploading: false,
      uploadError: null,
    }),

  startGame: (game) =>
    set((state) => ({
      gameTimings: {
        ...state.gameTimings,
        [game]: {
          startedAt: new Date().toISOString(),
          completedAt: null,
          durationMs: 0,
        },
      },
    })),

  recordEvent: (game, event) =>
    set((state) => ({
      eventsByGame: {
        ...state.eventsByGame,
        [game]: [...(state.eventsByGame[game] ?? []), event],
      },
    })),

  recordEvents: (game, events) =>
    set((state) => ({
      eventsByGame: {
        ...state.eventsByGame,
        [game]: [...(state.eventsByGame[game] ?? []), ...events],
      },
    })),

  endGame: (game) => {
    const timing = get().gameTimings[game];
    if (!timing) return;
    const completedAt = new Date().toISOString();
    const durationMs = Date.now() - new Date(timing.startedAt).getTime();
    set((state) => ({
      gameTimings: {
        ...state.gameTimings,
        [game]: { ...timing, completedAt, durationMs },
      },
      stickersEarned: [...state.stickersEarned, STICKER_MAP[game]],
    }));
  },

  advanceGame: () =>
    set((state) => ({ currentGameIndex: state.currentGameIndex + 1 })),

  earnSticker: (sticker) =>
    set((state) => ({ stickersEarned: [...state.stickersEarned, sticker] })),

  uploadSessionData: async () => {
    const state = get();
    if (!state.sessionId) return;

    set({ isUploading: true, uploadError: null });

    const games = state.gameOrder.slice(0, state.currentGameIndex + 1);
    const totalDurationMs = state.sessionStartedAt
      ? Date.now() - new Date(state.sessionStartedAt).getTime()
      : 0;

    try {
      // Upload events for each completed game
      for (const game of games) {
        const events = state.eventsByGame[game];
        const timing = state.gameTimings[game];
        if (!events?.length || !timing) continue;

        try {
          await uploadEvents(
            state.sessionId,
            game,
            events,
            timing.startedAt,
            timing.completedAt ?? new Date().toISOString(),
            timing.durationMs,
          );
        } catch {
          // Queue for retry — never lose session data
          await queueUpload(
            state.sessionId,
            game,
            events,
            timing.startedAt,
            timing.completedAt ?? new Date().toISOString(),
            timing.durationMs,
          );
        }
      }

      // Mark session complete
      try {
        await completeSession(
          state.sessionId,
          games.length,
          totalDurationMs,
        );
      } catch {
        await queueCompletion(state.sessionId, games.length, totalDurationMs);
      }

      set({ isUploading: false });
    } catch (err) {
      // Queue everything if something went wrong
      for (const game of games) {
        const events = state.eventsByGame[game];
        const timing = state.gameTimings[game];
        if (!events?.length || !timing) continue;
        await queueUpload(
          state.sessionId,
          game,
          events,
          timing.startedAt,
          timing.completedAt ?? new Date().toISOString(),
          timing.durationMs,
        );
      }
      await queueCompletion(state.sessionId, games.length, totalDurationMs);
      startBackgroundRetry();

      const message = err instanceof Error ? err.message : 'Upload failed';
      set({ isUploading: false, uploadError: message });
    }
  },

  resetSession: () =>
    set({
      sessionId: null,
      selectedPatient: null,
      currentGameIndex: 0,
      gameOrder: [],
      eventsByGame: {},
      gameTimings: {},
      stickersEarned: [],
      sessionStartedAt: null,
      isUploading: false,
      uploadError: null,
    }),

  currentGame: () => {
    const { gameOrder, currentGameIndex } = get();
    return gameOrder[currentGameIndex] ?? null;
  },

  isLastGame: () => {
    const { gameOrder, currentGameIndex } = get();
    return currentGameIndex >= gameOrder.length - 1;
  },

  gamesCompleted: () => {
    const { gameTimings } = get();
    return Object.values(gameTimings).filter((t) => t.completedAt !== null).length;
  },
}));
