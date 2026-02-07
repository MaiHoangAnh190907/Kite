import { useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { Colors } from '../../src/constants/colors';
import { useSessionStore } from '../../src/stores/session-store';
import type { GameType } from '../../src/types';

const GAME_ROUTES: Record<GameType, string> = {
  cloud_catch: '/(game)/cloud-catch',
  star_sequence: '/(game)/star-sequence',
  wind_trails: '/(game)/wind-trails',
  sky_sort: '/(game)/sky-sort',
};

const GAMES: { type: GameType; icon: string; label: string; color: string }[] = [
  { type: 'cloud_catch', icon: '☁️', label: 'Cloud Catch', color: Colors.goldenYellow },
  { type: 'star_sequence', icon: '⭐', label: 'Star Sequence', color: Colors.softPurple },
  { type: 'wind_trails', icon: '🌈', label: 'Wind Trails', color: Colors.grassGreen },
  { type: 'sky_sort', icon: '🎈', label: 'Sky Sort', color: Colors.sunsetOrange },
];

export default function GameHubScreen(): React.JSX.Element {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const kiteY = useRef(new Animated.Value(0)).current;
  const gameOrder = useSessionStore((s) => s.gameOrder);

  // Fade in + kite bob
  Animated.timing(fadeAnim, {
    toValue: 1,
    duration: 800,
    delay: 300,
    useNativeDriver: true,
  }).start();

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

  const handlePickGame = (game: GameType): void => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Set this game as the first in the order so the session store tracks it
    const store = useSessionStore.getState();
    if (!store.gameOrder.includes(game)) {
      // Replace game order with just the picked game
      useSessionStore.setState({ gameOrder: [game], currentGameIndex: 0 });
    } else {
      // Jump to the picked game's index
      const idx = store.gameOrder.indexOf(game);
      useSessionStore.setState({ currentGameIndex: idx });
    }

    router.replace(GAME_ROUTES[game] as `/${string}`);
  };

  return (
    <View style={styles.container}>
      {/* Background clouds */}
      <View style={[styles.bgCloud, { top: 60, left: 40, opacity: 0.35 }]}>
        <Text style={{ fontSize: 52 }}>☁️</Text>
      </View>
      <View style={[styles.bgCloud, { top: 120, right: 60, opacity: 0.25 }]}>
        <Text style={{ fontSize: 68 }}>☁️</Text>
      </View>

      {/* Kite */}
      <Animated.View style={[styles.kiteWrap, { transform: [{ translateY: kiteY }] }]}>
        <Text style={styles.kiteEmoji}>🪁</Text>
      </Animated.View>

      {/* Title */}
      <Animated.View style={[styles.titleWrap, { opacity: fadeAnim }]}>
        <Text style={styles.title}>Pick a game!</Text>
        <Text style={styles.subtitle}>✨ ✨ ✨</Text>
      </Animated.View>

      {/* Game cards */}
      <Animated.View style={[styles.grid, { opacity: fadeAnim }]}>
        {GAMES.map((g) => (
          <TouchableOpacity
            key={g.type}
            style={[styles.card, { borderColor: g.color }]}
            activeOpacity={0.75}
            onPress={() => handlePickGame(g.type)}
          >
            <Text style={styles.cardIcon}>{g.icon}</Text>
            <Text style={styles.cardLabel}>{g.label}</Text>
          </TouchableOpacity>
        ))}
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
    paddingHorizontal: 32,
  },
  bgCloud: {
    position: 'absolute',
  },
  kiteWrap: {
    marginBottom: 16,
  },
  kiteEmoji: {
    fontSize: 80,
  },
  titleWrap: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.white,
    textShadowColor: 'rgba(0,0,0,0.1)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: 20,
    marginTop: 8,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 16,
    maxWidth: 420,
  },
  card: {
    width: 170,
    height: 140,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 24,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  cardIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  cardLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textDark,
  },
});
