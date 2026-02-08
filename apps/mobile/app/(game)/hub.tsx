import { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
} from 'react-native';
import { router } from 'expo-router';

import { Colors } from '../../src/constants/colors';
import { useSessionStore } from '../../src/stores/session-store';

const AUTO_ADVANCE_MS = 3000;

export default function GameHubScreen(): React.JSX.Element {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const kiteY = useRef(new Animated.Value(0)).current;
  const gameOrder = useSessionStore((s) => s.gameOrder);

  useEffect(() => {
    // Fade in
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      delay: 300,
      useNativeDriver: true,
    }).start();

    // Kite bob
    Animated.loop(
      Animated.sequence([
        Animated.timing(kiteY, {
          toValue: -12,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(kiteY, {
          toValue: 12,
          duration: 1200,
          useNativeDriver: true,
        }),
      ]),
    ).start();

    // Auto-advance to first game after 3 seconds
    const timer = setTimeout(() => {
      router.replace('/(game)/cloud-catch');
    }, AUTO_ADVANCE_MS);

    return () => clearTimeout(timer);
  }, [fadeAnim, kiteY, gameOrder]);

  return (
    <View style={styles.container}>
      {/* Drifting background clouds */}
      <View style={[styles.bgCloud, { top: 60, left: 40, opacity: 0.35 }]}>
        <Text style={{ fontSize: 52 }}>☁️</Text>
      </View>
      <View style={[styles.bgCloud, { top: 120, right: 60, opacity: 0.25 }]}>
        <Text style={{ fontSize: 68 }}>☁️</Text>
      </View>
      <View style={[styles.bgCloud, { bottom: 100, left: '30%', opacity: 0.2 }]}>
        <Text style={{ fontSize: 44 }}>☁️</Text>
      </View>

      {/* Breeze kite bobbing */}
      <Animated.View style={[styles.kiteWrap, { transform: [{ translateY: kiteY }] }]}>
        <Text style={styles.kiteEmoji}>🪁</Text>
      </Animated.View>

      {/* "Ready to fly?" text with fade in */}
      <Animated.View style={[styles.titleWrap, { opacity: fadeAnim }]}>
        <Text style={styles.title}>Ready to fly?</Text>
        <Text style={styles.subtitle}>✨ ✨ ✨</Text>
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
  bgCloud: {
    position: 'absolute',
  },
  kiteWrap: {
    marginBottom: 24,
  },
  kiteEmoji: {
    fontSize: 100,
  },
  titleWrap: {
    alignItems: 'center',
  },
  title: {
    fontSize: 36,
    fontWeight: '700',
    color: Colors.white,
    textShadowColor: 'rgba(0,0,0,0.1)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: 24,
    marginTop: 12,
  },
});
