import { v4 as uuid } from 'uuid';

import type {
  TabletAuthResponse,
  PatientsResponse,
  CreateSessionResponse,
  UploadEventsResponse,
  CompleteSessionResponse,
} from '../types';

const VALID_PIN = '1234';

const MOCK_PATIENTS: PatientsResponse = {
  patients: [
    { id: uuid(), firstName: 'Emma', lastInitial: 'S', ageMonths: 62, ageDisplay: '5 yrs 2 mos', hasSessionToday: false },
    { id: uuid(), firstName: 'Liam', lastInitial: 'J', ageMonths: 55, ageDisplay: '4 yrs 7 mos', hasSessionToday: false },
    { id: uuid(), firstName: 'Olivia', lastInitial: 'W', ageMonths: 72, ageDisplay: '6 yrs 0 mos', hasSessionToday: true },
    { id: uuid(), firstName: 'Noah', lastInitial: 'B', ageMonths: 49, ageDisplay: '4 yrs 1 mo', hasSessionToday: false },
    { id: uuid(), firstName: 'Ava', lastInitial: 'D', ageMonths: 84, ageDisplay: '7 yrs 0 mos', hasSessionToday: false },
  ],
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function mockTabletVerify(pin: string): Promise<TabletAuthResponse> {
  await delay(500);
  if (pin !== VALID_PIN) {
    throw { error: { code: 'UNAUTHORIZED', message: 'Invalid PIN' } };
  }
  return {
    accessToken: 'mock-jwt-tablet-token',
    staffName: 'Sarah',
    clinicName: 'Sunny Pediatrics',
  };
}

export async function mockGetPatientsToday(): Promise<PatientsResponse> {
  await delay(300);
  return MOCK_PATIENTS;
}

export async function mockCreateSession(patientId: string): Promise<CreateSessionResponse> {
  await delay(400);
  return {
    sessionId: uuid(),
    patientAgeMonths: 62,
    gamesConfig: {
      games: ['cloud_catch', 'star_sequence', 'wind_trails', 'sky_sort'],
      difficultyPreset: 'age_5',
    },
  };
}

export async function mockUploadEvents(
  _sessionId: string,
  _gameType: string,
  _events: unknown[],
): Promise<UploadEventsResponse> {
  await delay(200);
  return { gameResultId: uuid() };
}

export async function mockCompleteSession(sessionId: string): Promise<CompleteSessionResponse> {
  await delay(300);
  return {
    sessionId,
    status: 'completed',
    metricsComputed: true,
  };
}
