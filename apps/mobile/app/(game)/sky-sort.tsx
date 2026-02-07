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

type Category = 'sky' | 'ground';
type SortRule = 'type' | 'color';

interface SortItem {
  id: string;
  emoji: string;
  label: string;
  category: Category;
  color: 'blue' | 'green' | 'yellow' | 'red';
}

interface SortEvent {
  type: 'sort';
  itemId: string;
  itemLabel: string;
  chosenBucket: string;
  correctBucket: string;
  correct: boolean;
  rule: SortRule;
  reactionTimeMs: number;
  timestamp: number;
}

interface RuleSwitchEvent {
  type: 'rule_switch';
  fromRule: SortRule;
  toRule: SortRule;
  timestamp: number;
}

const SKY_ITEMS: SortItem[] = [
  { id: '1', emoji: '☁️', label: 'Cloud', category: 'sky', color: 'blue' },
  { id: '2', emoji: '⭐', label: 'Star', category: 'sky', color: 'yellow' },
  { id: '3', emoji: '🌙', label: 'Moon', category: 'sky', color: 'yellow' },
  { id: '4', emoji: '☀️', label: 'Sun', category: 'sky', color: 'red' },
  { id: '5', emoji: '🪁', label: 'Kite', category: 'sky', color: 'blue' },
];

const GROUND_ITEMS: SortItem[] = [
  { id: '6', emoji: '🌺', label: 'Flower', category: 'ground', color: 'red' },
  { id: '7', emoji: '🌳', label: 'Tree', category: 'ground', color: 'green' },
  { id: '8', emoji: '🍎', label: 'Apple', category: 'ground', color: 'red' },
  { id: '9', emoji: '🐛', label: 'Bug', category: 'ground', color: 'green' },
  { id: '10', emoji: '🪨', label: 'Rock', category: 'ground', color: 'blue' },
];

const ALL_ITEMS = [...SKY_ITEMS, ...GROUND_ITEMS];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export default function SkySortScreen(): React.JSX.Element {
  const { width } = useWindowDimensions();

  const recordEvents = useSessionStore((s) => s.recordEvents);
  const startGame = useSessionStore((s) => s.startGame);
  const endGame = useSessionStore((s) => s.endGame);

  const eventsRef = useRef<(SortEvent | RuleSwitchEvent)[]>([]);
  const gameStartRef = useRef(0);
  const itemShownRef = useRef(0);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION_MS);
  const [currentItem, setCurrentItem] = useState<SortItem | null>(null);
  const [rule, setRule] = useState<SortRule>('type');
  const [sortCount, setSortCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [showEndAnim, setShowEndAnim] = useState(false);
  const gameOverRef = useRef(false);

  const nextItem = useCallback(() => {
    const item = pickRandom(ALL_ITEMS);
    setCurrentItem(item);
    itemShownRef.current = performance.now();
    setFeedback(null);
  }, []);

  useEffect(() => {
    startGame('sky_sort');
    gameStartRef.current = performance.now();
    nextItem();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Timer + rule switches
  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = performance.now() - gameStartRef.current;
      const remaining = GAME_DURATION_MS - elapsed;
      if (remaining <= 0 && !gameOverRef.current) {
        gameOverRef.current = true;
        clearInterval(interval);
        recordEvents('sky_sort', eventsRef.current);
        endGame('sky_sort');
        setShowEndAnim(true);
        setTimeout(() => router.replace('/(game)/transition'), 3000);
        return;
      }
      setTimeLeft(remaining);
    }, 200);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Switch rule every 8 sorts
  useEffect(() => {
    if (sortCount > 0 && sortCount % 8 === 0) {
      const newRule: SortRule = rule === 'type' ? 'color' : 'type';
      eventsRef.current.push({
        type: 'rule_switch',
        fromRule: rule,
        toRule: newRule,
        timestamp: performance.now(),
      });
      setRule(newRule);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortCount]);

  const handleSort = useCallback((bucket: string) => {
    if (!currentItem || feedback || gameOverRef.current) return;

    const reactionTimeMs = performance.now() - itemShownRef.current;

    let correctBucket: string;
    if (rule === 'type') {
      correctBucket = currentItem.category;
    } else {
      // Color rule: blue/green → left, yellow/red → right
      correctBucket = (currentItem.color === 'blue' || currentItem.color === 'green') ? 'cool' : 'warm';
    }

    const correct = bucket === correctBucket;

    eventsRef.current.push({
      type: 'sort',
      itemId: currentItem.id,
      itemLabel: currentItem.label,
      chosenBucket: bucket,
      correctBucket,
      correct,
      rule,
      reactionTimeMs,
      timestamp: performance.now(),
    });

    if (correct) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setStreak((s) => s + 1);
      setFeedback('correct');
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setStreak(0);
      setFeedback('wrong');
    }

    setSortCount((c) => c + 1);
    setTimeout(() => nextItem(), 800);
  }, [currentItem, feedback, rule, nextItem]);

  if (showEndAnim) {
    return (
      <View style={styles.container}>
        <View style={styles.endWrap}>
          <Text style={styles.endIcon}>🎈</Text>
          <View style={styles.starBadge}>
            <View style={[styles.starInner, { backgroundColor: Colors.sunsetOrange }]} />
          </View>
        </View>
      </View>
    );
  }

  const buckets = rule === 'type'
    ? [
        { key: 'sky', label: 'Sky', icon: '☁️', color: Colors.skyBlue },
        { key: 'ground', label: 'Ground', icon: '🌿', color: Colors.grassGreen },
      ]
    : [
        { key: 'cool', label: 'Cool', icon: '💙', color: '#5BA3C9' },
        { key: 'warm', label: 'Warm', icon: '❤️', color: Colors.sunsetOrange },
      ];

  return (
    <View style={styles.container}>
      {/* Timer */}
      <View style={styles.timerBg}>
        <View style={[styles.timerBar, { width: `${(timeLeft / GAME_DURATION_MS) * 100}%` }]} />
      </View>

      {/* Rule indicator */}
      <View style={styles.ruleWrap}>
        <Text style={styles.ruleText}>
          Sort by: {rule === 'type' ? 'Where it belongs' : 'Color'}
        </Text>
        {streak >= 3 && <Text style={styles.streakText}>🔥 {streak}</Text>}
      </View>

      {/* Current item */}
      <View style={styles.itemWrap}>
        {currentItem && (
          <>
            <Text style={[
              styles.itemEmoji,
              feedback === 'correct' && { transform: [{ scale: 1.2 }] },
              feedback === 'wrong' && { opacity: 0.5 },
            ]}>
              {currentItem.emoji}
            </Text>
          </>
        )}
      </View>

      {/* Feedback */}
      {feedback && (
        <Text style={[styles.feedbackText, feedback === 'correct' ? styles.feedbackCorrect : styles.feedbackWrong]}>
          {feedback === 'correct' ? 'Yes!' : 'Oops!'}
        </Text>
      )}

      {/* Buckets */}
      <View style={styles.bucketsRow}>
        {buckets.map((b) => (
          <TouchableOpacity
            key={b.key}
            style={[styles.bucket, { borderColor: b.color }]}
            onPress={() => handleSort(b.key)}
            activeOpacity={0.7}
          >
            <Text style={styles.bucketIcon}>{b.icon}</Text>
            <Text style={styles.bucketLabel}>{b.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 6,
    backgroundColor: 'rgba(0,0,0,0.08)',
    zIndex: 10,
  },
  timerBar: {
    height: 6,
    backgroundColor: Colors.sunsetOrange,
  },
  ruleWrap: {
    position: 'absolute',
    top: 30,
    alignItems: 'center',
  },
  ruleText: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textDark,
  },
  streakText: {
    fontSize: 18,
    marginTop: 4,
    color: Colors.sunsetOrange,
    fontWeight: '700',
  },
  itemWrap: {
    marginBottom: 40,
  },
  itemEmoji: {
    fontSize: 100,
  },
  feedbackText: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 20,
  },
  feedbackCorrect: {
    color: Colors.grassGreen,
  },
  feedbackWrong: {
    color: Colors.errorRed,
  },
  bucketsRow: {
    flexDirection: 'row',
    gap: 24,
  },
  bucket: {
    width: 140,
    height: 140,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 28,
    borderWidth: 4,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  bucketIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  bucketLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textDark,
  },
  endWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  endIcon: {
    fontSize: 100,
    marginBottom: 20,
  },
  starBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,140,66,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  starInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
});
