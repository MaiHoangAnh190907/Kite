import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { Colors } from '../../src/constants/colors';
import { useSessionStore } from '../../src/stores/session-store';
import type { GameType } from '../../src/types';
import { HomeHeader } from '../../src/components/home/HomeHeader';
import { GamePopup, type GameInfo } from '../../src/components/home/GamePopup';
import { SettingsSidebar } from '../../src/components/home/SettingsSidebar';
import { ProfileModal } from '../../src/components/home/ProfileModal';

interface GameData {
  key: GameType;
  title: string;
  image: string;
  bgColor: string;
  description: string;
  instructions: string[];
  icon: string;
}

const GAMES: GameData[] = [
  {
    key: 'cloud_catch',
    title: 'Cloud Catch',
    icon: '☁️',
    description: 'Tap the golden clouds while avoiding storm clouds!',
    image: 'https://images.unsplash.com/photo-1627544263474-c0d0b646bac5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzaW1wbGUlMjBjbG91ZCUyMGljb24lMjBpbGx1c3RyYXRpb258ZW58MXx8fHwxNzcwNTE1MzMwfDA&ixlib=rb-4.1.0&q=80&w=1080',
    bgColor: '#87CEEB',
    instructions: [
      'Tap golden clouds to catch them',
      'Avoid tapping storm clouds',
      'Breeze will react to your taps',
      'Collect as many as you can!',
    ],
  },
  {
    key: 'star_sequence',
    title: 'Star Sequence',
    icon: '⭐',
    description: 'Memorize the pattern and tap the stars in order!',
    image: 'https://images.unsplash.com/photo-1639465294781-d4d5d7319951?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzdGFyJTIwcGF0dGVybiUyMG1lbW9yeSUyMGdhbWV8ZW58MXx8fHwxNzcwNTE1MzMwfDA&ixlib=rb-4.1.0&q=80&w=1080',
    bgColor: '#1e3a5f',
    instructions: [
      'Watch the stars light up in sequence',
      'Remember the pattern',
      'Tap the stars in the same order',
      'Patterns get longer as you progress',
    ],
  },
  {
    key: 'sky_sigils',
    title: 'Sky Sigils',
    icon: '✨',
    description: 'Trace storm clouds to reveal lightning patterns!',
    image: 'https://images.unsplash.com/photo-1656523537172-63d277539a03?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsaWdodG5pbmclMjBib2x0JTIwaWNvbnxlbnwxfHx8fDE3NzA1MTUzMzF8MA&ixlib=rb-4.1.0&q=80&w=1080',
    bgColor: '#4A90E2',
    instructions: [
      'Trace your finger on the storm clouds',
      'Reveal the lightning pattern inside',
      'Stay within the cloud boundaries',
      'Complete the pattern to win',
    ],
  },
  {
    key: 'wind_trails',
    title: 'Wind Trails',
    icon: '🌬️',
    description: 'Guide the kite through winding sky paths!',
    image: 'https://images.unsplash.com/photo-1602328790041-ee36d98e677c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb2xvcmZ1bCUyMGJhbGxvb25zJTIwc2ltcGxlfGVufDF8fHx8MTc3MDUxNTMzMXww&ixlib=rb-4.1.0&q=80&w=1080',
    bgColor: '#87CEEB',
    instructions: [
      'Follow the trail with your finger',
      'Keep your kite on the path',
      'Navigate through wind gusts',
      'Complete all 6 paths to finish',
    ],
  },
];

const ROUTES: Record<GameType, string> = {
  cloud_catch: '/(game)/cloud-catch',
  star_sequence: '/(game)/star-sequence',
  sky_sigils: '/(game)/sky-sigils',
  wind_trails: '/(game)/wind-trails',
};

export default function GameHubScreen(): React.JSX.Element {
  const { width } = useWindowDimensions();
  const [selectedGame, setSelectedGame] = useState<GameData | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [pressedCard, setPressedCard] = useState<string | null>(null);

  // Calculate grid layout for iPad
  const horizontalPadding = 48;
  const gap = 24;
  const cols = width > 900 ? 3 : 2;
  const cardWidth = (width - horizontalPadding * 2 - gap * (cols - 1)) / cols;

  const handleGamePress = (game: GameData) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedGame(game);
  };

  const handlePlay = (difficulty: number) => {
    if (!selectedGame) return;
    useSessionStore.setState({
      gameOrder: [selectedGame.key],
      currentGameIndex: 0,
    });
    setSelectedGame(null);
    router.replace(ROUTES[selectedGame.key] as `/${string}`);
  };

  const handleLogout = () => {
    router.replace('/');
  };

  return (
    <View style={styles.container}>
      <HomeHeader
        stars={12456}
        username="Player"
        onMenuPress={() => setShowSettings(true)}
        onProfilePress={() => setShowProfile(true)}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingHorizontal: horizontalPadding },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.grid, { gap }]}>
          {GAMES.map((game) => (
            <TouchableOpacity
              key={game.key}
              style={[styles.cardWrapper, { width: cardWidth }]}
              onPress={() => handleGamePress(game)}
              onPressIn={() => setPressedCard(game.key)}
              onPressOut={() => setPressedCard(null)}
              activeOpacity={1}
            >
              {/* Title + underline */}
              <View style={styles.cardTitleSection}>
                <Text style={styles.cardTitle}>{game.title}</Text>
                <View style={styles.cardUnderline} />
              </View>

              {/* Image card */}
              <View
                style={[
                  styles.cardImageContainer,
                  pressedCard === game.key && styles.cardImageContainerPressed,
                ]}
              >
                <Image
                  source={{ uri: game.image }}
                  style={styles.cardImage}
                  resizeMode="cover"
                />
                {/* Press overlay with description */}
                {pressedCard === game.key && (
                  <View style={styles.cardOverlay}>
                    <View style={styles.cardOverlayContent}>
                      <Text style={styles.cardDescription}>
                        {game.description}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Game Popup */}
      {selectedGame && (
        <GamePopup
          game={{
            key: selectedGame.key,
            title: selectedGame.title,
            icon: selectedGame.icon,
            description: selectedGame.description,
            bgColor: selectedGame.bgColor,
            instructions: selectedGame.instructions,
          }}
          onClose={() => setSelectedGame(null)}
          onPlay={handlePlay}
        />
      )}

      {/* Settings Sidebar */}
      <SettingsSidebar
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        onLogout={handleLogout}
      />

      {/* Profile Modal */}
      <ProfileModal
        isOpen={showProfile}
        onClose={() => setShowProfile(false)}
        username="Player"
        userInfo={{
          name: 'Player',
          age: '8 years old',
          dob: 'February 14, 2018',
          gender: 'Male',
          parentContact: 'parent@example.com',
          joinedDate: 'January 15, 2026',
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.pageBg,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 32,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cardWrapper: {
    marginBottom: 24,
  },
  cardTitleSection: {
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textDark,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  cardUnderline: {
    height: 2,
    backgroundColor: Colors.mintGreen,
    borderRadius: 1,
  },
  cardImageContainer: {
    aspectRatio: 16 / 10,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    backgroundColor: '#E0E0E0',
  },
  cardImageContainerPressed: {
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 30,
    elevation: 8,
    transform: [{ scale: 1.02 }],
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(76,106,146,0.55)',
  },
  cardOverlayContent: {
    padding: 16,
  },
  cardDescription: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
});
