import { useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { router } from 'expo-router';

import { Transition } from '../../src/components/game-engine';
import { useSessionStore } from '../../src/stores/session-store';
import type { GameType } from '../../src/types';

const GAME_ROUTES: Record<GameType, string> = {
  cloud_catch: '/(game)/cloud-catch',
  star_sequence: '/(game)/star-sequence',
  sky_sigils: '/(game)/sky-sigils',
  wind_trails: '/(game)/wind-trails',
};

export default function TransitionScreen(): React.JSX.Element {
  const advanceGame = useSessionStore((s) => s.advanceGame);
  const isLastGame = useSessionStore((s) => s.isLastGame);
  const gameOrder = useSessionStore((s) => s.gameOrder);
  const currentGameIndex = useSessionStore((s) => s.currentGameIndex);
  const uploadSessionData = useSessionStore((s) => s.uploadSessionData);

  const handleComplete = useCallback(async () => {
    if (isLastGame()) {
      // All games done — upload and go to celebration screen
      await uploadSessionData();
      router.replace('/(game)/celebration');
      return;
    }

    // Advance to next game
    advanceGame();
    const nextIndex = currentGameIndex + 1;
    const nextGame = gameOrder[nextIndex];
    if (nextGame && GAME_ROUTES[nextGame]) {
      router.replace(GAME_ROUTES[nextGame] as `/${string}`);
    } else {
      // Fallback: go to celebration
      await uploadSessionData();
      router.replace('/(game)/celebration');
    }
  }, [advanceGame, isLastGame, gameOrder, currentGameIndex, uploadSessionData]);

  return (
    <View style={styles.container}>
      <Transition onComplete={handleComplete} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
