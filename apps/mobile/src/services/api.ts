import axios from 'axios';
import Constants from 'expo-constants';

import type {
  TabletAuthResponse,
  PatientsResponse,
  CreateSessionResponse,
  UploadEventsResponse,
  CompleteSessionResponse,
} from '../types';
import {
  mockTabletVerify,
  mockGetPatientsToday,
  mockCreateSession,
  mockUploadEvents,
  mockCompleteSession,
} from './mock-api';
import { useAuthStore } from '../stores/auth-store';

const USE_MOCK = Constants.expoConfig?.extra?.useMockApi !== false;

const BASE_URL = Constants.expoConfig?.extra?.apiBaseUrl ?? 'http://localhost:3000/api/v1';

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

client.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().clearAuth();
    }
    return Promise.reject(error);
  },
);

export async function tabletVerify(pin: string): Promise<TabletAuthResponse> {
  if (USE_MOCK) return mockTabletVerify(pin);
  const { data } = await client.post<TabletAuthResponse>('/auth/tablet/verify', { pin });
  return data;
}

export async function getPatientsToday(): Promise<PatientsResponse> {
  if (USE_MOCK) return mockGetPatientsToday();
  const { data } = await client.get<PatientsResponse>('/sessions/patients/today');
  return data;
}

export async function createSession(
  patientId: string,
  tabletId: string,
): Promise<CreateSessionResponse> {
  if (USE_MOCK) return mockCreateSession(patientId);
  const { data } = await client.post<CreateSessionResponse>('/sessions', {
    patientId,
    tabletId,
    consentGivenAt: new Date().toISOString(),
  });
  return data;
}

export async function uploadEvents(
  sessionId: string,
  gameType: string,
  events: unknown[],
  startedAt: string,
  completedAt: string,
  durationMs: number,
): Promise<UploadEventsResponse> {
  if (USE_MOCK) return mockUploadEvents(sessionId, gameType, events);
  const { data } = await client.post<UploadEventsResponse>(
    `/sessions/${sessionId}/events`,
    { gameType, startedAt, completedAt, durationMs, events },
  );
  return data;
}

export async function completeSession(
  sessionId: string,
  gamesCompleted: number,
  totalDurationMs: number,
): Promise<CompleteSessionResponse> {
  if (USE_MOCK) return mockCompleteSession(sessionId);
  const { data } = await client.patch<CompleteSessionResponse>(
    `/sessions/${sessionId}/complete`,
    { completedAt: new Date().toISOString(), gamesCompleted, totalDurationMs },
  );
  return data;
}
