import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  ScrollView,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

export interface GameInfo {
  key: string;
  title: string;
  icon: string;
  description: string;
  bgColor: string;
  instructions: string[];
}

interface GamePopupProps {
  game: GameInfo;
  onClose: () => void;
  onPlay: (difficulty: number) => void;
}

const DIFFICULTY_LABELS = ['EASY', 'MEDIUM', 'HARD'];
const DIFFICULTY_COLORS = ['#7FBF9E', '#F6C445', '#F45B5B'];
const DIFFICULTY_EMOJIS = ['\u{1F60A}', '\u{1F610}', '\u{1F608}'];

export function GamePopup({ game, onClose, onPlay }: GamePopupProps) {
  const [difficulty, setDifficulty] = useState(1);
  const [showInstructions, setShowInstructions] = useState(false);
  const thumbX = useSharedValue(1);

  const handleDifficultyChange = (level: number) => {
    setDifficulty(level);
    thumbX.value = level;
  };

  const thumbStyle = useAnimatedStyle(() => ({
    left: withSpring(thumbX.value * 50 + '%' as unknown as number, {
      damping: 20,
      stiffness: 400,
    }),
  }));

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          {/* Top Section - Colored */}
          <View style={[styles.topSection, { backgroundColor: game.bgColor }]}>
            <TouchableOpacity style={styles.backBtn} onPress={onClose}>
              <Ionicons name="arrow-back" size={24} color="#1F2933" />
            </TouchableOpacity>

            <View style={styles.titleWrap}>
              <Text style={styles.gameIcon}>{game.icon}</Text>
              <Text style={styles.gameTitle}>
                {game.title.toUpperCase()}
              </Text>
              <Text style={styles.gameDesc}>{game.description}</Text>
            </View>
          </View>

          {/* Centered Difficulty Emoji */}
          <View style={styles.emojiOuter}>
            <View
              style={[
                styles.emojiCircle,
                { backgroundColor: DIFFICULTY_COLORS[difficulty] },
              ]}
            >
              <Text style={styles.emojiText}>
                {DIFFICULTY_EMOJIS[difficulty]}
              </Text>
            </View>
          </View>

          {/* Bottom Section - White */}
          <View style={styles.bottomSection}>
            {/* Difficulty Label */}
            <Text
              style={[
                styles.diffLabel,
                { color: DIFFICULTY_COLORS[difficulty] },
              ]}
            >
              {DIFFICULTY_LABELS[difficulty]}
            </Text>

            {/* Difficulty Slider */}
            <View style={styles.sliderWrap}>
              <View style={styles.sliderTrack}>
                <View style={[styles.sliderSeg, { backgroundColor: '#7FBF9E' }]} />
                <View style={[styles.sliderSeg, { backgroundColor: '#F6C445' }]} />
                <View style={[styles.sliderSeg, { backgroundColor: '#F45B5B' }]} />
              </View>

              {/* Tappable zones */}
              <View style={styles.sliderTouchRow}>
                {[0, 1, 2].map((level) => (
                  <TouchableOpacity
                    key={level}
                    style={styles.sliderTouchZone}
                    onPress={() => handleDifficultyChange(level)}
                    activeOpacity={1}
                  />
                ))}
              </View>

              {/* Thumb indicator */}
              <View
                style={[
                  styles.sliderThumb,
                  {
                    left: `${(difficulty / 2) * 100}%`,
                    borderColor: DIFFICULTY_COLORS[difficulty],
                  },
                ]}
              />
            </View>

            {/* Buttons */}
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.playBtn}
                onPress={() => onPlay(difficulty)}
                activeOpacity={0.8}
              >
                <Ionicons name="play" size={24} color="#FFFFFF" />
                <View>
                  <Text style={styles.playLabel}>PLAY</Text>
                  <Text style={styles.playLevel}>Level {difficulty + 1}</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.helpBtn}
                onPress={() => setShowInstructions(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="help-circle" size={28} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Pressable>

      {/* Instructions Sub-Modal */}
      {showInstructions && (
        <Modal transparent animationType="fade" onRequestClose={() => setShowInstructions(false)}>
          <Pressable
            style={styles.instrBackdrop}
            onPress={() => setShowInstructions(false)}
          >
            <Pressable style={styles.instrCard} onPress={() => {}}>
              <View style={styles.instrHeader}>
                <Text style={styles.instrTitle}>HOW TO PLAY</Text>
                <TouchableOpacity
                  onPress={() => setShowInstructions(false)}
                  style={styles.instrClose}
                >
                  <Ionicons name="close" size={22} color="#1F2933" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.instrList}>
                {game.instructions.map((instr, idx) => (
                  <View key={idx} style={styles.instrRow}>
                    <View style={styles.instrNum}>
                      <Text style={styles.instrNumText}>{idx + 1}</Text>
                    </View>
                    <Text style={styles.instrText}>{instr}</Text>
                  </View>
                ))}
              </ScrollView>

              <TouchableOpacity
                style={styles.instrGotIt}
                onPress={() => setShowInstructions(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.instrGotItText}>Got it!</Text>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: '85%',
    maxWidth: 700,
    borderRadius: 32,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 30,
    elevation: 10,
  },
  topSection: {
    height: 240,
    paddingTop: 20,
    paddingHorizontal: 20,
  },
  backBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  titleWrap: {
    alignItems: 'center',
    marginTop: 16,
  },
  gameIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  gameTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 3,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
    marginBottom: 8,
  },
  gameDesc: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    lineHeight: 22,
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
    paddingHorizontal: 24,
  },
  emojiOuter: {
    alignItems: 'center',
    marginTop: -44,
    zIndex: 10,
  },
  emojiCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  emojiText: {
    fontSize: 44,
  },
  bottomSection: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 40,
    paddingBottom: 32,
    paddingTop: 12,
    alignItems: 'center',
  },
  diffLabel: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 4,
    textAlign: 'center',
    marginBottom: 16,
    marginTop: 8,
  },
  sliderWrap: {
    width: '100%',
    maxWidth: 340,
    height: 48,
    marginBottom: 24,
    justifyContent: 'center',
  },
  sliderTrack: {
    height: 18,
    borderRadius: 9,
    flexDirection: 'row',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sliderSeg: {
    flex: 1,
  },
  sliderTouchRow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
  },
  sliderTouchZone: {
    flex: 1,
  },
  sliderThumb: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 4,
    top: -11,
    marginLeft: -20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 6,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    maxWidth: 340,
  },
  playBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#F45B5B',
    paddingVertical: 14,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  playLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 2,
  },
  playLevel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 11,
  },
  helpBtn: {
    width: 56,
    backgroundColor: '#8B7AA8',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },

  // Instructions sub-modal
  instrBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  instrCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 28,
    width: '80%',
    maxWidth: 420,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  instrHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  instrTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4C6A92',
    letterSpacing: 1,
  },
  instrClose: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  instrList: {
    maxHeight: 260,
  },
  instrRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  instrNum: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#8FB8A8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  instrNumText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  instrText: {
    flex: 1,
    color: '#1F2933',
    fontSize: 15,
    lineHeight: 22,
    paddingTop: 4,
  },
  instrGotIt: {
    backgroundColor: '#4C6A92',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  instrGotItText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
