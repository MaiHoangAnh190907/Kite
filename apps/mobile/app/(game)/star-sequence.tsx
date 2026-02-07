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
import { v4 as uuid } from 'uuid';
import * as Haptics from 'expo-haptics';

import { Colors } from '../../src/constants/colors';
import { useSessionStore } from '../../src/stores/session-store';

const GAME_DURATION_MS = 150_000;
const GRID_SIZE = 3; // 3x3 grid of stars
const INITIAL_SEQ_LEN = 2;
const MAX_SEQ_LEN = 7;
const SHOW_INTERVAL_MS = 600;

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
  const gameStartRef = useRef(0);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION_MS);
  const [phase, setPhase] = useState<Phase>('showing');
  const [sequence, setSequence] = useState<number[]>([]);
  const [showIdx, setShowIdx] = useState(-1);
  const [playerInput, setPlayerInput] = useState<number[]>([]);
  const [seqLen, setSeqLen] = useState(INITIAL_SEQ_LEN);
  const [roundIdx, setRoundIdx] = useState(0);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [score, setScore] = useState(0);
  const inputTimesRef = useRef<number[]>([]);
  const lastTapRef = useRef(0);
  const [showEndAnim, setShowEndAnim] = useState(false);

  const generateSequence = useCallback((len: number) => {
    const seq: number[] = [];
    for (let i = 0; i < len; i++) {
      seq.push(Math.floor(Math.random() * (GRID_SIZE * GRID_SIZE)));
    }
    return seq;
  }, []);

  // Start game
  useEffect(() => {
    startGame('star_sequence');
    gameStartRef.current = performance.now();
    const seq = generateSequence(INITIAL_SEQ_LEN);
    setSequence(seq);
    setShowIdx(0);
    setPhase('showing');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Timer
  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = performance.now() - gameStartRef.current;
      const remaining = GAME_DURATION_MS - elapsed;
      if (remaining <= 0) {
        clearInterval(interval);
        setPhase('done');
        recordEvents('star_sequence', eventsRef.current);
        endGame('star_sequence');
        setShowEndAnim(true);
        setTimeout(() => router.replace('/(game)/transition'), 3000);
        return;
      }
      setTimeLeft(remaining);
    }, 200);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Show sequence one star at a time
  useEffect(() => {
    if (phase !== 'showing' || showIdx < 0) return;
    if (showIdx >= sequence.length) {
      // Done showing, switch to input
      setTimeout(() => {
        setShowIdx(-1);
        setPhase('input');
        setPlayerInput([]);
        inputTimesRef.current = [];
        lastTapRef.current = performance.now();
      }, 400);
      return;
    }
    const timer = setTimeout(() => setShowIdx(showIdx + 1), SHOW_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [phase, showIdx, sequence]);

  // Handle star tap
  const handleTap = useCallback((idx: number) => {
    if (phase !== 'input') return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const now = performance.now();
    inputTimesRef.current.push(now - lastTapRef.current);
    lastTapRef.current = now;

    const newInput = [...playerInput, idx];
    setPlayerInput(newInput);

    // Check each step
    const stepIdx = newInput.length - 1;
    if (newInput[stepIdx] !== sequence[stepIdx]) {
      // Wrong
      setPhase('feedback');
      setFeedback('wrong');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      eventsRef.current.push({
        type: 'round',
        roundIndex: roundIdx,
        sequenceLength: seqLen,
        sequence,
        playerInput: newInput,
        correct: false,
        reactionTimesMs: inputTimesRef.current,
        timestamp: performance.now(),
      });

      // Reset to same length
      setTimeout(() => {
        setFeedback(null);
        const nextSeq = generateSequence(seqLen);
        setSequence(nextSeq);
        setShowIdx(0);
        setPhase('showing');
        setRoundIdx((r) => r + 1);
      }, 1000);
      return;
    }

    // If full sequence entered correctly
    if (newInput.length === sequence.length) {
      setPhase('feedback');
      setFeedback('correct');
      setScore((s) => s + 1);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      eventsRef.current.push({
        type: 'round',
        roundIndex: roundIdx,
        sequenceLength: seqLen,
        sequence,
        playerInput: newInput,
        correct: true,
        reactionTimesMs: inputTimesRef.current,
        timestamp: performance.now(),
      });

      // Increase difficulty
      setTimeout(() => {
        setFeedback(null);
        const nextLen = Math.min(seqLen + 1, MAX_SEQ_LEN);
        setSeqLen(nextLen);
        const nextSeq = generateSequence(nextLen);
        setSequence(nextSeq);
        setShowIdx(0);
        setPhase('showing');
        setRoundIdx((r) => r + 1);
      }, 1000);
    }
  }, [phase, playerInput, sequence, seqLen, roundIdx, generateSequence]);

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

  const cellSize = Math.min((width - 120) / GRID_SIZE, (height * 0.5) / GRID_SIZE);

  return (
    <View style={styles.container}>
      {/* Timer */}
      <View style={styles.timerBg}>
        <View style={[styles.timerBar, { width: `${(timeLeft / GAME_DURATION_MS) * 100}%` }]} />
      </View>

      {/* Phase indicator */}
      <View style={styles.phaseWrap}>
        <Text style={styles.phaseText}>
          {phase === 'showing' ? 'Watch the stars...' : phase === 'input' ? 'Your turn!' : phase === 'feedback' ? (feedback === 'correct' ? 'Great!' : 'Try again!') : ''}
        </Text>
      </View>

      {/* Star grid */}
      <View style={styles.gridWrap}>
        {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, i) => {
          const isLit = phase === 'showing' && showIdx >= 0 && showIdx < sequence.length && sequence[showIdx] === i;
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
                },
                isLit && styles.cellLit,
                isPlayerTapped && styles.cellTapped,
                isFeedbackCorrect && styles.cellCorrect,
                isFeedbackWrong && styles.cellWrong,
              ]}
              onPress={() => handleTap(i)}
              activeOpacity={0.7}
              disabled={phase !== 'input'}
            >
              <Text style={[styles.starIcon, isLit && styles.starIconLit]}>
                {isLit || isFeedbackCorrect ? '⭐' : '✦'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Score */}
      <View style={styles.scoreWrap}>
        <Text style={styles.scoreText}>Sequence: {seqLen}</Text>
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
  timerBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  timerBar: {
    height: 6,
    backgroundColor: Colors.goldenYellow,
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
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  cellLit: {
    backgroundColor: 'rgba(255,215,0,0.35)',
    borderColor: Colors.goldenYellow,
  },
  cellTapped: {
    backgroundColor: 'rgba(179,157,219,0.3)',
    borderColor: Colors.softPurple,
  },
  cellCorrect: {
    backgroundColor: 'rgba(76,175,80,0.35)',
    borderColor: Colors.grassGreen,
  },
  cellWrong: {
    backgroundColor: 'rgba(239,68,68,0.35)',
    borderColor: Colors.errorRed,
  },
  starIcon: {
    fontSize: 32,
    color: 'rgba(255,255,255,0.3)',
  },
  starIconLit: {
    fontSize: 40,
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
