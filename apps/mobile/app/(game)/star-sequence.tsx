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

const GAME_DURATION_MS = 150_000;
const INITIAL_SEQ_LEN = 2;
const MAX_SEQ_LEN = 7;
const GRID_EXPAND_THRESHOLD = 5; // expand to 4x4 at sequence length 5+
const CONSECUTIVE_FAILS_TO_END = 2;

// Timing per spec table
function getShowIntervalMs(seqLen: number): number {
  if (seqLen <= 2) return 800;
  if (seqLen <= 4) return 700;
  if (seqLen <= 5) return 600;
  return 500;
}

type Phase = 'showing' | 'input' | 'feedback' | 'done';

interface RoundEvent {
  type: 'round';
  roundNumber: number;
  sequenceLength: number;
  sequenceShown: number[];
  sequenceTapped: number[];
  correct: boolean;
  tapTimestamps: number[];
  interTapIntervals: number[];
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
  const [showEndAnim, setShowEndAnim] = useState(false);
  const gameOverRef = useRef(false);

  // Track consecutive failures at current max for early end
  const maxReachedRef = useRef(INITIAL_SEQ_LEN);
  const consecutiveFailsRef = useRef(0);

  const tapTimestampsRef = useRef<number[]>([]);

  // Grid size: 3x3 normally, 4x4 at sequence length 5+
  const gridSize = seqLen >= GRID_EXPAND_THRESHOLD ? 4 : 3;
  const totalCells = gridSize * gridSize;

  const generateSequence = useCallback((len: number, cells: number) => {
    const seq: number[] = [];
    for (let i = 0; i < len; i++) {
      seq.push(Math.floor(Math.random() * cells));
    }
    return seq;
  }, []);

  const finishGame = useCallback(() => {
    if (gameOverRef.current) return;
    gameOverRef.current = true;
    recordEvents('star_sequence', eventsRef.current);
    endGame('star_sequence');
    setPhase('done');
    setShowEndAnim(true);
    setTimeout(() => router.replace('/(game)/transition'), 3000);
  }, [recordEvents, endGame]);

  // Start game
  useEffect(() => {
    startGame('star_sequence');
    gameStartRef.current = performance.now();
    const gs = INITIAL_SEQ_LEN >= GRID_EXPAND_THRESHOLD ? 4 : 3;
    const seq = generateSequence(INITIAL_SEQ_LEN, gs * gs);
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
        finishGame();
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
      // Done showing → switch to input
      setTimeout(() => {
        setShowIdx(-1);
        setPhase('input');
        setPlayerInput([]);
        tapTimestampsRef.current = [];
      }, 400);
      return;
    }
    const timer = setTimeout(() => setShowIdx(showIdx + 1), getShowIntervalMs(seqLen));
    return () => clearTimeout(timer);
  }, [phase, showIdx, sequence, seqLen]);

  // Handle star tap
  const handleTap = useCallback((idx: number) => {
    if (phase !== 'input' || gameOverRef.current) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const now = performance.now();
    tapTimestampsRef.current.push(now);

    const newInput = [...playerInput, idx];
    setPlayerInput(newInput);

    const stepIdx = newInput.length - 1;

    if (newInput[stepIdx] !== sequence[stepIdx]) {
      // Wrong — gentle blue glow (NOT red per spec)
      setPhase('feedback');
      setFeedback('wrong');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

      const timestamps = tapTimestampsRef.current;
      const intervals: number[] = [];
      for (let i = 1; i < timestamps.length; i++) {
        intervals.push(timestamps[i] - timestamps[i - 1]);
      }

      eventsRef.current.push({
        type: 'round',
        roundNumber: roundIdx,
        sequenceLength: seqLen,
        sequenceShown: sequence,
        sequenceTapped: newInput,
        correct: false,
        tapTimestamps: timestamps,
        interTapIntervals: intervals,
      });

      // Track consecutive failures at max
      if (seqLen >= maxReachedRef.current) {
        consecutiveFailsRef.current += 1;
        if (consecutiveFailsRef.current >= CONSECUTIVE_FAILS_TO_END) {
          setTimeout(() => finishGame(), 800);
          return;
        }
      }

      // Reset round with same length
      setTimeout(() => {
        setFeedback(null);
        const gs = seqLen >= GRID_EXPAND_THRESHOLD ? 4 : 3;
        const nextSeq = generateSequence(seqLen, gs * gs);
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
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      const timestamps = tapTimestampsRef.current;
      const intervals: number[] = [];
      for (let i = 1; i < timestamps.length; i++) {
        intervals.push(timestamps[i] - timestamps[i - 1]);
      }

      eventsRef.current.push({
        type: 'round',
        roundNumber: roundIdx,
        sequenceLength: seqLen,
        sequenceShown: sequence,
        sequenceTapped: newInput,
        correct: true,
        tapTimestamps: timestamps,
        interTapIntervals: intervals,
      });

      // Reset consecutive fails on success
      consecutiveFailsRef.current = 0;

      // Increase difficulty
      setTimeout(() => {
        setFeedback(null);
        const nextLen = Math.min(seqLen + 1, MAX_SEQ_LEN);
        maxReachedRef.current = Math.max(maxReachedRef.current, nextLen);
        setSeqLen(nextLen);
        const gs = nextLen >= GRID_EXPAND_THRESHOLD ? 4 : 3;
        const nextSeq = generateSequence(nextLen, gs * gs);
        setSequence(nextSeq);
        setShowIdx(0);
        setPhase('showing');
        setRoundIdx((r) => r + 1);
      }, 1000);
    }
  }, [phase, playerInput, sequence, seqLen, roundIdx, generateSequence, finishGame]);

  if (showEndAnim) {
    return (
      <View style={styles.container}>
        <View style={styles.endWrap}>
          <Text style={styles.endStar}>⭐</Text>
          <Text style={styles.endText}>✨</Text>
        </View>
      </View>
    );
  }

  const cellSize = Math.min((width - 120) / gridSize, (height * 0.5) / gridSize);

  return (
    <View style={styles.container}>
      {/* Timer */}
      <View style={styles.timerBg}>
        <View style={[styles.timerBar, { width: `${(timeLeft / GAME_DURATION_MS) * 100}%` }]} />
      </View>

      {/* Phase indicator — icons only, minimal text */}
      <View style={styles.phaseWrap}>
        {phase === 'showing' && <Text style={styles.phaseIcon}>👀</Text>}
        {phase === 'input' && <Text style={styles.phaseIcon}>👆</Text>}
        {phase === 'feedback' && feedback === 'correct' && <Text style={styles.phaseIcon}>✨</Text>}
        {phase === 'feedback' && feedback === 'wrong' && <Text style={styles.phaseIcon}>💫</Text>}
      </View>

      {/* Star grid */}
      <View style={[styles.gridWrap, { maxWidth: cellSize * gridSize + (gridSize - 1) * 16 }]}>
        {Array.from({ length: totalCells }).map((_, i) => {
          const isLit = phase === 'showing' && showIdx >= 0 && showIdx < sequence.length && sequence[showIdx] === i;
          const isPlayerTapped = phase === 'input' && playerInput.includes(i);
          const isFeedbackCorrect = phase === 'feedback' && feedback === 'correct' && sequence.includes(i);
          // Spec: incorrect tap → gentle BLUE glow, not red
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
                isFeedbackWrong && styles.cellWrongBlue, // Blue glow per spec
              ]}
              onPress={() => handleTap(i)}
              activeOpacity={0.7}
              disabled={phase !== 'input'}
            >
              <Text style={[styles.starIcon, (isLit || isFeedbackCorrect) && styles.starIconLit]}>
                {isLit || isFeedbackCorrect ? '⭐' : '✦'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e', // Dark purple night sky
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
    height: 48,
    justifyContent: 'center',
  },
  phaseIcon: {
    fontSize: 36,
  },
  gridWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 16,
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
  // Spec: incorrect tap → gentle BLUE glow (not red)
  cellWrongBlue: {
    backgroundColor: 'rgba(135,206,235,0.3)',
    borderColor: Colors.skyBlue,
  },
  starIcon: {
    fontSize: 32,
    color: 'rgba(255,255,255,0.3)',
  },
  starIconLit: {
    fontSize: 40,
  },
  endWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  endStar: {
    fontSize: 100,
    marginBottom: 16,
  },
  endText: {
    fontSize: 48,
  },
});
