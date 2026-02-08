import 'react-native-get-random-values';
import { v4 as uuid } from 'uuid';

import type {
  TabletAuthResponse,
  PatientsResponse,
  CreatePatientResponse,
  CreateSessionResponse,
  UploadEventsResponse,
  CompleteSessionResponse,
} from '../types';

const VALID_PIN = '1234';

function createMockPatients(): PatientsResponse {
  return {
    patients: [
      { id: uuid(), firstName: 'Emma', lastInitial: 'S', ageMonths: 62, ageDisplay: '5 yrs 2 mos', hasSessionToday: false },
      { id: uuid(), firstName: 'Liam', lastInitial: 'J', ageMonths: 55, ageDisplay: '4 yrs 7 mos', hasSessionToday: false },
      { id: uuid(), firstName: 'Olivia', lastInitial: 'W', ageMonths: 72, ageDisplay: '6 yrs 0 mos', hasSessionToday: true },
      { id: uuid(), firstName: 'Noah', lastInitial: 'B', ageMonths: 49, ageDisplay: '4 yrs 1 mo', hasSessionToday: false },
      { id: uuid(), firstName: 'Ava', lastInitial: 'D', ageMonths: 84, ageDisplay: '7 yrs 0 mos', hasSessionToday: false },
    ],
  };
}

let _mockPatients: PatientsResponse | null = null;
function getMockPatients(): PatientsResponse {
  if (!_mockPatients) _mockPatients = createMockPatients();
  return _mockPatients;
}

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
    tabletId: '55555555-5555-5555-5555-555555555555',
  };
}

export async function mockCreatePatient(
  firstName: string,
  lastName: string,
  _dateOfBirth: string,
): Promise<CreatePatientResponse> {
  await delay(400);
  const patient = {
    id: uuid(),
    firstName,
    lastInitial: lastName.charAt(0).toUpperCase(),
    ageMonths: 60,
    ageDisplay: '5 yrs 0 mos',
    hasSessionToday: false,
  };
  // Add to mock patient list so they show up
  const list = getMockPatients();
  list.patients.push(patient);
  return patient;
}

export async function mockGetPatientsToday(): Promise<PatientsResponse> {
  await delay(300);
  return getMockPatients();
}

export async function mockCreateSession(patientId: string): Promise<CreateSessionResponse> {
  await delay(400);
  return {
    sessionId: uuid(),
    patientAgeMonths: 62,
    gamesConfig: {
      games: ['cloud_catch', 'star_sequence', 'sky_balance'],
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
