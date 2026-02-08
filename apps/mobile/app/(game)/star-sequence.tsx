import 'react-native-get-random-values';
import { useEffect, useRef, useState, useCallback } from 'react';
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
import { MaterialIcons } from '@expo/vector-icons';

const GRID_SIZE = 2; // 2x2 grid of stars

const STAR_COLORS = [
  { fill: '#3B82F6', border: '#60A5FA', bg: 'rgba(59,130,246,0.35)' },  // blue
  { fill: '#EF4444', border: '#F87171', bg: 'rgba(239,68,68,0.35)' },   // red
  { fill: '#22C55E', border: '#4ADE80', bg: 'rgba(34,197,94,0.35)' },   // green
  { fill: '#FACC15', border: '#FDE047', bg: 'rgba(250,204,21,0.35)' },  // yellow
];
const SHOW_ON_MS = 500;  // how long a star stays lit
const SHOW_GAP_MS = 250; // brief off-gap between stars (makes repeats visible)

type Phase = 'showing' | 'input' | 'feedback' | 'done';

interface RoundEvent {
  type: 'round';
  roundIndex: number;
  sequenceLength: number;
  sequence: number[];
  playerInput: number[];
  correct: boolean;
  reactionTimesMs: number[];
  timestamp: number;
}

export default function StarSequenceScreen(): React.JSX.Element {
  const { width, height } = useWindowDimensions();

  const recordEvents = useSessionStore((s) => s.recordEvents);
  const startGame = useSessionStore((s) => s.startGame);
  const endGame = useSessionStore((s) => s.endGame);

  const eventsRef = useRef<RoundEvent[]>([]);
  const sequenceRef = useRef<number[]>([]);
  const gameOverRef = useRef(false);
  const [phase, setPhase] = useState<Phase>('showing');
  const [sequence, setSequence] = useState<number[]>([]);
  const [showIdx, setShowIdx] = useState(-1);
  const [showGap, setShowGap] = useState(false); // brief off between stars
  const [playerInput, setPlayerInput] = useState<number[]>([]);
  const [roundIdx, setRoundIdx] = useState(0);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [score, setScore] = useState(0);
  const inputTimesRef = useRef<number[]>([]);
  const lastTapRef = useRef(0);
  const [showEndAnim, setShowEndAnim] = useState(false);

  const addToSequence = useCallback(() => {
    const next = Math.floor(Math.random() * (GRID_SIZE * GRID_SIZE));
    sequenceRef.current = [...sequenceRef.current, next];
    setSequence([...sequenceRef.current]);
  }, []);

  // Start game
  useEffect(() => {
    startGame('star_sequence');
    // Build initial 2-star sequence
    const s1 = Math.floor(Math.random() * (GRID_SIZE * GRID_SIZE));
    const s2 = Math.floor(Math.random() * (GRID_SIZE * GRID_SIZE));
    sequenceRef.current = [s1, s2];
    setSequence([s1, s2]);
    setShowIdx(0);
    setPhase('showing');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Show sequence one star at a time, with a gap between each
  useEffect(() => {
    if (phase !== 'showing' || showIdx < 0) return;
    if (showIdx >= sequence.length) {
      // Done showing, switch to input
      const timer = setTimeout(() => {
        setShowIdx(-1);
        setShowGap(false);
        setPhase('input');
        setPlayerInput([]);
        inputTimesRef.current = [];
        lastTapRef.current = performance.now();
      }, 400);
      return () => clearTimeout(timer);
    }

    if (showGap) {
      // We're in the brief off-gap, then light the next star
      const timer = setTimeout(() => setShowGap(false), SHOW_GAP_MS);
      return () => clearTimeout(timer);
    }

    // Star is currently lit — after SHOW_ON_MS, go to gap then advance
    const timer = setTimeout(() => {
      setShowGap(true);
      setShowIdx(showIdx + 1);
    }, SHOW_ON_MS);
    return () => clearTimeout(timer);
  }, [phase, showIdx, showGap, sequence]);

  // Handle star tap
  const handleTap = useCallback((idx: number) => {
    if (phase !== 'input' || gameOverRef.current) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const now = performance.now();
    inputTimesRef.current.push(now - lastTapRef.current);
    lastTapRef.current = now;

    const newInput = [...playerInput, idx];
    setPlayerInput(newInput);

    // Check each step
    const stepIdx = newInput.length - 1;
    if (newInput[stepIdx] !== sequence[stepIdx]) {
      // Wrong — game over
      gameOverRef.current = true;
      setPhase('feedback');
      setFeedback('wrong');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      eventsRef.current.push({
        type: 'round',
        roundIndex: roundIdx,
        sequenceLength: sequence.length,
        sequence,
        playerInput: newInput,
        correct: false,
        reactionTimesMs: inputTimesRef.current,
        timestamp: performance.now(),
      });

      recordEvents('star_sequence', eventsRef.current);
      endGame('star_sequence');
      setTimeout(() => {
        setFeedback(null);
        setShowEndAnim(true);
        setTimeout(() => router.replace('/(game)/hub'), 3000);
      }, 1200);
      return;
    }

    // If full sequence entered correctly — append one new star
    if (newInput.length === sequence.length) {
      setPhase('feedback');
      setFeedback('correct');
      setScore((s) => s + 1);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      eventsRef.current.push({
        type: 'round',
        roundIndex: roundIdx,
        sequenceLength: sequence.length,
        sequence,
        playerInput: newInput,
        correct: true,
        reactionTimesMs: inputTimesRef.current,
        timestamp: performance.now(),
      });

      setTimeout(() => {
        setFeedback(null);
        addToSequence();
        setShowIdx(0);
        setPhase('showing');
        setRoundIdx((r) => r + 1);
      }, 1000);
    }
  }, [phase, playerInput, sequence, roundIdx, addToSequence, recordEvents, endGame]);

  const handleExit = () => {
    if (gameOverRef.current) return;
    gameOverRef.current = true;
    recordEvents('star_sequence', eventsRef.current);
    endGame('star_sequence');
    router.replace('/(game)/hub');
  };

  if (showEndAnim) {
    return (
      <View style={styles.container}>
        <View style={styles.endWrap}>
          <Text style={styles.endStar}>⭐</Text>
          <View style={styles.starBadge}>
            <View style={[styles.starInner, { backgroundColor: Colors.goldenYellow }]} />
          </View>
        </View>
      </View>
    );
  }

  const cellSize = Math.min((width - 100) / GRID_SIZE, (height * 0.45) / GRID_SIZE);
  const dotSize = cellSize * 0.45;

  return (
    <View style={styles.container}>
      {/* Exit button */}
      <TouchableOpacity style={styles.exitBtn} onPress={handleExit} activeOpacity={0.7}>
        <Text style={styles.exitBtnText}>✕</Text>
      </TouchableOpacity>

      {/* Phase indicator */}
      <View style={styles.phaseWrap}>
        <Text style={styles.phaseText}>
          {phase === 'showing' ? 'Watch the stars...' : phase === 'input' ? 'Your turn!' : phase === 'feedback' ? (feedback === 'correct' ? 'Great!' : 'Oh no!') : ''}
        </Text>
      </View>

      {/* Star grid */}
      <View style={styles.gridWrap}>
        {STAR_COLORS.map((color, i) => {
          const isLit = phase === 'showing' && !showGap && showIdx >= 0 && showIdx < sequence.length && sequence[showIdx] === i;
          const isPlayerTapped = phase === 'input' && playerInput.includes(i);
          const isFeedbackCorrect = phase === 'feedback' && feedback === 'correct' && sequence.includes(i);
          const isFeedbackWrong = phase === 'feedback' && feedback === 'wrong' && playerInput[playerInput.length - 1] === i;

          return (
            <TouchableOpacity
              key={i}
              style={[
                styles.cell,
                {
                  width: cellSize,
                  height: cellSize,
                  borderRadius: cellSize / 2,
                  borderColor: isLit || isPlayerTapped ? color.border : 'rgba(255,255,255,0.15)',
                  backgroundColor: isLit ? color.bg : isPlayerTapped ? color.bg : 'rgba(255,255,255,0.1)',
                },
                isFeedbackCorrect && styles.cellCorrect,
                isFeedbackWrong && styles.cellWrong,
              ]}
              onPress={() => handleTap(i)}
              activeOpacity={0.7}
              disabled={phase !== 'input'}
            >
              <MaterialIcons
              name="star"
              size={dotSize}
              color={color.fill}
              style={{ opacity: isLit ? 1 : 0.4 }}
              />

            </TouchableOpacity>
          );
        })}
      </View>

      {/* Score */}
      <View style={styles.scoreWrap}>
        <Text style={styles.scoreText}>Sequence: {sequence.length}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exitBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 30,
  },
  exitBtnText: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.white,
  },
  phaseWrap: {
    marginBottom: 24,
  },
  phaseText: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.white,
  },
  gridWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 16,
    maxWidth: 400,
  },
  cell: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
  },
  cellCorrect: {
    backgroundColor: 'rgba(76,175,80,0.35)',
    borderColor: Colors.grassGreen,
  },
  cellWrong: {
    backgroundColor: 'rgba(239,68,68,0.35)',
    borderColor: Colors.errorRed,
  },
  scoreWrap: {
    marginTop: 24,
  },
  scoreText: {
    fontSize: 18,
    color: Colors.cloudWhite,
    fontWeight: '600',
  },
  endWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  endStar: {
    fontSize: 100,
    marginBottom: 20,
  },
  starBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,215,0,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  starInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
});
