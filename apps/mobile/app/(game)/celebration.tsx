import { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
} from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { Colors } from '../../src/constants/colors';
import { useSessionStore } from '../../src/stores/session-store';

const CELEBRATION_DURATION_MS = 5000;

const STICKER_DATA: { key: string; emoji: string; label: string }[] = [
  { key: 'sun', emoji: '☀️', label: 'Sun' },
  { key: 'constellation', emoji: '⭐', label: 'Constellation' },
  { key: 'rainbow', emoji: '🌈', label: 'Rainbow' },
  { key: 'balloon', emoji: '🎈', label: 'Balloon' },
];

export default function CelebrationScreen(): React.JSX.Element {
  const stickersEarned = useSessionStore((s) => s.stickersEarned);
  const gamesCompleted = useSessionStore((s) => s.gamesCompleted);
  const completed = gamesCompleted();

  const scaleAnim = useRef(new Animated.Value(0)).current;
  const starsAnim = useRef(new Animated.Value(0)).current;
  const stickersAnim = useRef(new Animated.Value(0)).current;
  const kiteAnim = useRef(new Animated.Value(-100)).current;

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Sequence: scale in → stars appear → stickers appear → kite loop
    Animated.sequence([
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 5,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.timing(starsAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(stickersAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();

    // Kite victory loop
    Animated.loop(
      Animated.sequence([
        Animated.timing(kiteAnim, {
          toValue: 400,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(kiteAnim, {
          toValue: -100,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    ).start();

    // Auto-navigate to end screen after 5 seconds
    const timer = setTimeout(() => {
      router.replace('/(end)/complete');
    }, CELEBRATION_DURATION_MS);

    return () => clearTimeout(timer);
  }, [scaleAnim, starsAnim, stickersAnim, kiteAnim]);

  return (
    <View style={styles.container}>
      {/* Sparkle decorations */}
      <Text style={[styles.sparkle, { top: 60, left: 50 }]}>✨</Text>
      <Text style={[styles.sparkle, { top: 100, right: 70 }]}>✨</Text>
      <Text style={[styles.sparkle, { top: 180, left: '40%' }]}>✨</Text>
      <Text style={[styles.sparkle, { bottom: 120, right: 100 }]}>✨</Text>
      <Text style={[styles.sparkle, { bottom: 200, left: 80 }]}>✨</Text>

      {/* Flying Breeze kite doing sky loop */}
      <Animated.View style={[styles.flyingKite, { transform: [{ translateX: kiteAnim }] }]}>
        <Text style={{ fontSize: 48 }}>🪁</Text>
      </Animated.View>

      <Animated.View style={[styles.content, { transform: [{ scale: scaleAnim }] }]}>
        {/* Title */}
        <Text style={styles.title}>Great flying!</Text>

        {/* Stars earned — always 1 per game completed */}
        <Animated.View style={[styles.starsRow, { opacity: starsAnim }]}>
          {Array.from({ length: Math.max(completed, 4) }).map((_, i) => (
            <Text key={i} style={styles.star}>⭐</Text>
          ))}
        </Animated.View>

        {/* Stickers earned */}
        <Animated.View style={[styles.stickersRow, { opacity: stickersAnim }]}>
          {STICKER_DATA.map((sticker) => {
            const earned = stickersEarned.includes(sticker.key);
            return (
              <View key={sticker.key} style={[styles.stickerBadge, earned && styles.stickerEarned]}>
                <Text style={{ fontSize: earned ? 36 : 28, opacity: earned ? 1 : 0.3 }}>
                  {sticker.emoji}
                </Text>
              </View>
            );
          })}
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.skyBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sparkle: {
    position: 'absolute',
    fontSize: 28,
    opacity: 0.6,
  },
  flyingKite: {
    position: 'absolute',
    top: '20%',
  },
  content: {
    alignItems: 'center',
  },
  title: {
    fontSize: 48,
    fontWeight: '700',
    color: Colors.white,
    textShadowColor: 'rgba(0,0,0,0.1)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
    marginBottom: 32,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  star: {
    fontSize: 52,
  },
  stickersRow: {
    flexDirection: 'row',
    gap: 16,
  },
  stickerBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stickerEarned: {
    backgroundColor: 'rgba(255,255,255,0.4)',
    borderWidth: 2,
    borderColor: Colors.goldenYellow,
  },
});
