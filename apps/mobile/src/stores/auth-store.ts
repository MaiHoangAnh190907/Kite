import { create } from 'zustand';

interface AuthState {
  token: string | null;
  staffName: string | null;
  clinicName: string | null;
  setAuth: (token: string, staffName: string, clinicName: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  staffName: null,
  clinicName: null,
  setAuth: (token, staffName, clinicName) =>
    set({ token, staffName, clinicName }),
  clearAuth: () =>
    set({ token: null, staffName: null, clinicName: null }),
}));
