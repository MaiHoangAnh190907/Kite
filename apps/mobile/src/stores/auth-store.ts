import { create } from 'zustand';

interface AuthState {
  token: string | null;
  staffName: string | null;
  clinicName: string | null;
  tabletId: string | null;
  setAuth: (token: string, staffName: string, clinicName: string, tabletId: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  staffName: null,
  clinicName: null,
  tabletId: null,
  setAuth: (token, staffName, clinicName, tabletId) =>
    set({ token, staffName, clinicName, tabletId }),
  clearAuth: () =>
    set({ token: null, staffName: null, clinicName: null, tabletId: null }),
}));
