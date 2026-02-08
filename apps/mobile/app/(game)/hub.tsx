import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { Colors } from '../../src/constants/colors';
import { useSessionStore } from '../../src/stores/session-store';
import type { GameType } from '../../src/types';

const GAMES: { key: GameType; label: string; icon: string; color: string }[] = [
  { key: 'cloud_catch', label: 'Cloud Catch', icon: '☁️', color: Colors.goldenYellow },
  { key: 'star_sequence', label: 'Star Sequence', icon: '⭐', color: '#6C63FF' },
  { key: 'sky_sigils', label: 'Sky Sigils', icon: '✨', color: Colors.softPurple },
  { key: 'sky_sort', label: 'Sky Sort', icon: '🪁', color: Colors.grassGreen },
];

export default function GameHubScreen(): React.JSX.Element {
  const { width } = useWindowDimensions();
  const cardSize = Math.min((width - 60) / 2, 180);

  const handlePick = (game: GameType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    useSessionStore.setState({ gameOrder: [game], currentGameIndex: 0 });

    const routes: Record<GameType, string> = {
      cloud_catch: '/(game)/cloud-catch',
      star_sequence: '/(game)/star-sequence',
      sky_sigils: '/(game)/sky-sigils',
      sky_sort: '/(game)/sky-sort',
    };
    router.replace(routes[game] as `/${string}`);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Pick a game!</Text>

      <View style={styles.grid}>
        {GAMES.map((g) => (
          <TouchableOpacity
            key={g.key}
            style={[styles.card, { width: cardSize, height: cardSize, borderColor: g.color }]}
            onPress={() => handlePick(g.key)}
            activeOpacity={0.8}
          >
            <Text style={styles.cardIcon}>{g.icon}</Text>
            <Text style={styles.cardLabel}>{g.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
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
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.white,
    marginBottom: 32,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 16,
    maxWidth: 400,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 24,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
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
