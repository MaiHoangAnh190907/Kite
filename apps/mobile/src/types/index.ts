// API response types matching agent_docs/api.md

export interface TabletAuthResponse {
  accessToken: string;
  staffName: string;
  clinicName: string;
}

export interface PatientListItem {
  id: string;
  firstName: string;
  lastInitial: string;
  ageMonths: number;
  ageDisplay: string;
  hasSessionToday: boolean;
}

export interface PatientsResponse {
  patients: PatientListItem[];
}

export interface CreateSessionResponse {
  sessionId: string;
  patientAgeMonths: number;
  gamesConfig: {
    games: GameType[];
    difficultyPreset: string;
  };
}

export interface UploadEventsResponse {
  gameResultId: string;
}

export interface CompleteSessionResponse {
  sessionId: string;
  status: string;
  metricsComputed: boolean;
}

export type GameType = 'cloud_catch' | 'star_sequence' | 'sky_sigils' | 'sky_sort' | 'wind_trails';

export interface GameEvent {
  type: string;
  timestamp?: number;
  [key: string]: unknown;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}
