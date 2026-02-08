import { useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { router, usePathname } from 'expo-router';

import { useSessionStore } from '../stores/session-store';
import { useAuthStore } from '../stores/auth-store';

const INACTIVITY_TIMEOUT_MS = 120_000; // 120 seconds

interface InactivityProviderProps {
  children: React.ReactNode;
}

export function InactivityProvider({ children }: InactivityProviderProps): React.JSX.Element {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pathname = usePathname();
  const resetSession = useSessionStore((s) => s.resetSession);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const token = useAuthStore((s) => s.token);

  const resetToLogin = useCallback(() => {
    resetSession();
    clearAuth();
    router.replace('/(staff)/login');
  }, [resetSession, clearAuth]);

  const resetTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    // Don't set timer on login screen (no session to expire)
    if (!token) return;

    timerRef.current = setTimeout(() => {
      resetToLogin();
    }, INACTIVITY_TIMEOUT_MS);
  }, [token, resetToLogin]);

  // Reset timer on any touch
  const handleTouch = useCallback(() => {
    resetTimer();
  }, [resetTimer]);

  // Reset timer on route change
  useEffect(() => {
    resetTimer();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [pathname, resetTimer]);

  return (
    <View
      style={styles.container}
      onStartShouldSetResponder={() => { handleTouch(); return false; }}
      onMoveShouldSetResponder={() => { handleTouch(); return false; }}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
