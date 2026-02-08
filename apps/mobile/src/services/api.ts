import {
  mockTabletVerify,
  mockGetPatientsToday,
  mockCreatePatient,
  mockCreateSession,
  mockUploadEvents,
  mockCompleteSession,
} from './mock-api';

import type {
  TabletAuthResponse,
  PatientsResponse,
  CreatePatientResponse,
  CreateSessionResponse,
  UploadEventsResponse,
  CompleteSessionResponse,
} from '../types';

export async function tabletVerify(pin: string): Promise<TabletAuthResponse> {
  return mockTabletVerify(pin);
}

export async function getPatientsToday(): Promise<PatientsResponse> {
  return mockGetPatientsToday();
}

export async function createPatient(
  firstName: string,
  lastName: string,
  dateOfBirth: string,
): Promise<CreatePatientResponse> {
  return mockCreatePatient(firstName, lastName, dateOfBirth);
}

export async function createSession(
  patientId: string,
  _tabletId: string,
): Promise<CreateSessionResponse> {
  return mockCreateSession(patientId);
}

export async function uploadEvents(
  sessionId: string,
  gameType: string,
  events: unknown[],
  _startedAt: string,
  _completedAt: string,
  _durationMs: number,
): Promise<UploadEventsResponse> {
  return mockUploadEvents(sessionId, gameType, events);
}

export async function completeSession(
  sessionId: string,
  _gamesCompleted: number,
  _totalDurationMs: number,
): Promise<CompleteSessionResponse> {
  return mockCompleteSession(sessionId);
}
