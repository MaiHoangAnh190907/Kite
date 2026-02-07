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

export default function GameHubScreen(): React.JSX.Element {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const kiteY = useRef(new Animated.Value(0)).current;
  const currentGame = useSessionStore((s) => s.currentGame);

  useEffect(() => {
    // Fade in the "Ready to fly?" text
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      delay: 500,
      useNativeDriver: true,
    }).start();

    // Kite bobbing animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(kiteY, {
          toValue: -15,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(kiteY, {
          toValue: 15,
          duration: 1200,
          useNativeDriver: true,
        }),
      ]),
    ).start();

    // Auto-advance to first game after 3 seconds
    const timer = setTimeout(() => {
      const game = currentGame();
      if (game === 'cloud_catch') {
        router.replace('/(game)/cloud-catch');
      } else {
        // For Phase A2, only Cloud Catch is implemented
        // Other games will be added in Phase A3
        router.replace('/(game)/cloud-catch');
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [fadeAnim, kiteY, currentGame]);

  return (
    <View style={styles.container}>
      {/* Decorative clouds */}
      <Animated.View style={[styles.cloudFar, { opacity: 0.4 }]}>
        <Text style={styles.cloudText}>☁️</Text>
      </Animated.View>
      <Animated.View style={[styles.cloudMid, { opacity: 0.6 }]}>
        <Text style={styles.cloudText}>☁️</Text>
      </Animated.View>
      <Animated.View style={[styles.cloudNear, { opacity: 0.3 }]}>
        <Text style={styles.cloudTextLarge}>☁️</Text>
      </Animated.View>

      {/* Breeze kite character */}
      <Animated.View
        style={[styles.kiteContainer, { transform: [{ translateY: kiteY }] }]}
      >
        <Text style={styles.kiteEmoji}>🪁</Text>
      </Animated.View>

      {/* Ready to fly text */}
      <Animated.View style={[styles.readyContainer, { opacity: fadeAnim }]}>
        <Text style={styles.readyText}>Ready to fly?</Text>
        <Text style={styles.readyDots}>✨ ✨ ✨</Text>
      </Animated.View>
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
  cloudFar: {
    position: 'absolute',
    top: 80,
    left: 60,
  },
  cloudMid: {
    position: 'absolute',
    top: 140,
    right: 100,
  },
  cloudNear: {
    position: 'absolute',
    bottom: 200,
    left: 120,
  },
  cloudText: {
    fontSize: 48,
  },
  cloudTextLarge: {
    fontSize: 64,
  },
  kiteContainer: {
    marginBottom: 40,
  },
  kiteEmoji: {
    fontSize: 120,
  },
  readyContainer: {
    alignItems: 'center',
  },
  readyText: {
    fontSize: 36,
    fontWeight: '700',
    color: Colors.white,
    textShadowColor: 'rgba(0,0,0,0.1)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  readyDots: {
    fontSize: 24,
    marginTop: 12,
  },
});
