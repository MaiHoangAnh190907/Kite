import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
} from 'react-native';
import { router } from 'expo-router';

import { Colors } from '../../src/constants/colors';
import { useSessionStore } from '../../src/stores/session-store';
import { useAuthStore } from '../../src/stores/auth-store';

const COUNTDOWN_SECONDS = 30;

const STICKER_ICONS: Record<string, string> = {
  sun: '☀️',
  constellation: '⭐',
  rainbow: '🌈',
  balloon: '🎈',
};

export default function CompleteScreen(): React.JSX.Element {
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const resetSession = useSessionStore((s) => s.resetSession);
  const stickersEarned = useSessionStore((s) => s.stickersEarned);
  const gamesCompleted = useSessionStore((s) => s.gamesCompleted);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  const completed = gamesCompleted();

  const handleReset = useCallback(() => {
    resetSession();
    clearAuth();
    router.replace('/(staff)/login');
  }, [resetSession, clearAuth]);

  useEffect(() => {
    // Entrance animation
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 5,
      tension: 40,
      useNativeDriver: true,
    }).start();

    // Countdown timer
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleReset();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [scaleAnim, handleReset]);

  return (
    <View style={styles.container}>
      {/* Stars decoration */}
      <View style={styles.starsTop}>
        <Text style={styles.starEmoji}>⭐</Text>
        <Text style={[styles.starEmoji, { fontSize: 32, marginTop: 10 }]}>⭐</Text>
        <Text style={styles.starEmoji}>⭐</Text>
      </View>

      <Animated.View
        style={[styles.content, { transform: [{ scale: scaleAnim }] }]}
      >
        {/* Celebration kite */}
        <Text style={styles.kiteEmoji}>🪁</Text>
        <Text style={styles.title}>Great flying!</Text>
        <Text style={styles.subtitle}>Time to see the doctor!</Text>

        {/* Stars earned — one per completed game */}
        <View style={styles.starsRow}>
          {Array.from({ length: Math.max(completed, 1) }).map((_, i) => (
            <Text key={i} style={styles.starReward}>⭐</Text>
          ))}
        </View>

        {/* Stickers earned */}
        {stickersEarned.length > 0 && (
          <View style={styles.stickersRow}>
            {stickersEarned.map((sticker, i) => (
              <View key={i} style={styles.stickerBadge}>
                <Text style={styles.stickerIcon}>
                  {STICKER_ICONS[sticker] ?? '🏅'}
                </Text>
              </View>
            ))}
          </View>
        )}
      </Animated.View>

      {/* Hand-back instruction */}
      <View style={styles.bottomSection}>
        <Text style={styles.instruction}>
          👋 Please hand the iPad back to the front desk
        </Text>

        {/* Countdown */}
        <View style={styles.countdownContainer}>
          <View style={styles.countdownBar}>
            <View
              style={[
                styles.countdownFill,
                { width: `${(countdown / COUNTDOWN_SECONDS) * 100}%` },
              ]}
            />
          </View>
          <Text style={styles.countdownText}>
            Resetting in {countdown}s
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.skyBlue,
    justifyContent: 'center',
    alignItems: 'center',
  },
  starsTop: {
    position: 'absolute',
    top: 60,
    flexDirection: 'row',
    gap: 40,
    opacity: 0.6,
  },
  starEmoji: {
    fontSize: 40,
  },
  content: {
    alignItems: 'center',
  },
  kiteEmoji: {
    fontSize: 100,
    marginBottom: 16,
  },
  title: {
    fontSize: 42,
    fontWeight: '700',
    color: Colors.white,
    textShadowColor: 'rgba(0,0,0,0.1)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: 22,
    color: Colors.cloudWhite,
    marginTop: 8,
    fontWeight: '500',
  },
  starsRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 24,
  },
  starReward: {
    fontSize: 48,
  },
  stickersRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  stickerBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stickerIcon: {
    fontSize: 28,
  },
  bottomSection: {
    position: 'absolute',
    bottom: 60,
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 40,
  },
  instruction: {
    fontSize: 18,
    color: Colors.white,
    fontWeight: '500',
    marginBottom: 20,
    opacity: 0.9,
  },
  countdownContainer: {
    width: 300,
    alignItems: 'center',
  },
  countdownBar: {
    width: '100%',
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  countdownFill: {
    height: '100%',
    backgroundColor: Colors.white,
    borderRadius: 3,
  },
  countdownText: {
    fontSize: 14,
    color: Colors.cloudWhite,
    opacity: 0.8,
  },
});
