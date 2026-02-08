import 'react-native-get-random-values';
import { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  PanResponder,
  TouchableOpacity,
  useWindowDimensions,
  Animated,
} from 'react-native';
import { router } from 'expo-router';
import { v4 as uuid } from 'uuid';
import * as Haptics from 'expo-haptics';

import { Colors } from '../../src/constants/colors';
import { useSessionStore } from '../../src/stores/session-store';

const GAME_DURATION_MS = 150_000;

type SortRule = 'type' | 'color' | 'size';
type ObjectType = 'bird' | 'butterfly' | 'airplane' | 'kite';
type ObjectColor = 'blue' | 'grey' | 'orange' | 'red';
type ObjectSize = 'small' | 'large';

// ─── Rule progression per spec ────────────────────────────────────────
// 0-50s: type, 50-55s: switch, 55-100s: color, 100-105s: switch, 105-150s: size
function getCurrentRule(elapsedMs: number): { rule: SortRule; transitioning: boolean } {
  if (elapsedMs < 50_000) return { rule: 'type', transitioning: false };
  if (elapsedMs < 55_000) return { rule: 'type', transitioning: true };
  if (elapsedMs < 100_000) return { rule: 'color', transitioning: false };
  if (elapsedMs < 105_000) return { rule: 'color', transitioning: true };
  return { rule: 'size', transitioning: false };
}

// Spawn rate per spec
function getSpawnIntervalMs(elapsedMs: number): number {
  if (elapsedMs < 50_000) return 2500;
  if (elapsedMs < 100_000) return 2000;
  return 1500;
}

function getFallDurationMs(elapsedMs: number): number {
  if (elapsedMs < 50_000) return 3000;
  if (elapsedMs < 100_000) return 2500;
  return 2000;
}

interface SortObject {
  id: string;
  objectType: ObjectType;
  objectColor: ObjectColor;
  objectSize: ObjectSize;
  emoji: string;
  x: number;
  y: number;
  speedPxPerMs: number;
  spawnTimestamp: number;
  sorted: boolean;
  exited: boolean;
}

interface SortEvent {
  type: 'sort';
  objectId: string;
  objectType: ObjectType;
  objectColor: ObjectColor;
  objectSize: ObjectSize;
  currentRule: SortRule;
  spawnTimestamp: number;
  sortTimestamp: number;
  direction: 'left' | 'right';
  correct: boolean;
  reactionTimeMs: number;
}

interface RuleSwitchEvent {
  type: 'rule_switch';
  fromRule: SortRule;
  toRule: SortRule;
  timestamp: number;
  firstSortAfterSwitch: {
    reactionTimeMs: number;
    correct: boolean;
  } | null;
}

type GameEvent = SortEvent | RuleSwitchEvent;

// ─── Object templates per spec ────────────────────────────────────────
// Birds (blue), Butterflies (orange), Airplanes (grey), Kites (red)
const OBJECT_TEMPLATES: { type: ObjectType; emoji: string; color: ObjectColor }[] = [
  { type: 'bird', emoji: '🐦', color: 'blue' },
  { type: 'butterfly', emoji: '🦋', color: 'orange' },
  { type: 'airplane', emoji: '✈️', color: 'grey' },
  { type: 'kite', emoji: '🪁', color: 'red' },
];

function randomObject(): Omit<SortObject, 'id' | 'x' | 'y' | 'speedPxPerMs' | 'spawnTimestamp' | 'sorted' | 'exited'> {
  const template = OBJECT_TEMPLATES[Math.floor(Math.random() * OBJECT_TEMPLATES.length)];
  const size: ObjectSize = Math.random() < 0.5 ? 'small' : 'large';
  return {
    objectType: template.type,
    objectColor: template.color,
    objectSize: size,
    emoji: template.emoji,
  };
}

// Determine correct basket per rule
function getCorrectDirection(obj: SortObject, rule: SortRule): 'left' | 'right' {
  switch (rule) {
    case 'type':
      // Birds + Butterflies (nature) = left, Airplanes + Kites (flying things) = right
      return (obj.objectType === 'bird' || obj.objectType === 'butterfly') ? 'left' : 'right';
    case 'color':
      // Blue + Grey (cool) = left, Orange + Red (warm) = right
      return (obj.objectColor === 'blue' || obj.objectColor === 'grey') ? 'left' : 'right';
    case 'size':
      // Small = left, Large = right
      return obj.objectSize === 'small' ? 'left' : 'right';
  }
}

// Rule labels (icon-based)
function getRuleLabels(rule: SortRule): { left: string; right: string; ruleIcon: string } {
  switch (rule) {
    case 'type':
      return { left: '🐦🦋', right: '✈️🪁', ruleIcon: '🏷️' };
    case 'color':
      return { left: '💙🩶', right: '🧡❤️', ruleIcon: '🎨' };
    case 'size':
      return { left: '🔹', right: '🔷', ruleIcon: '📏' };
  }
}

const SWIPE_THRESHOLD = 50;

export default function SkySortScreen(): React.JSX.Element {
  const { width, height } = useWindowDimensions();

  const recordEvents = useSessionStore((s) => s.recordEvents);
  const startGame = useSessionStore((s) => s.startGame);
  const endGame = useSessionStore((s) => s.endGame);

  const eventsRef = useRef<GameEvent[]>([]);
  const objectsRef = useRef<SortObject[]>([]);
  const gameStartRef = useRef(0);
  const lastSpawnRef = useRef(0);
  const animFrameRef = useRef(0);
  const gameOverRef = useRef(false);
  const lastRuleRef = useRef<SortRule>('type');
  const ruleSwitchRecordedRef = useRef<Set<string>>(new Set());
  const firstSortAfterSwitchRef = useRef<{ rule: SortRule; pending: boolean }>({ rule: 'type', pending: false });

  const [objects, setObjects] = useState<SortObject[]>([]);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION_MS);
  const [rule, setRule] = useState<SortRule>('type');
  const [transitioning, setTransitioning] = useState(false);
  const [streak, setStreak] = useState(0);
  const [showEndAnim, setShowEndAnim] = useState(false);

  // Swipe gesture for current falling object
  const [activeObj, setActiveObj] = useState<SortObject | null>(null);
  const swipeAnim = useRef(new Animated.Value(0)).current;

  const handleSort = useCallback((obj: SortObject, direction: 'left' | 'right') => {
    if (obj.sorted || gameOverRef.current) return;
    obj.sorted = true;

    const correctDir = getCorrectDirection(obj, rule);
    const correct = direction === correctDir;
    const reactionTimeMs = performance.now() - obj.spawnTimestamp;

    eventsRef.current.push({
      type: 'sort',
      objectId: obj.id,
      objectType: obj.objectType,
      objectColor: obj.objectColor,
      objectSize: obj.objectSize,
      currentRule: rule,
      spawnTimestamp: obj.spawnTimestamp,
      sortTimestamp: performance.now(),
      direction,
      correct,
      reactionTimeMs,
    });

    // Track first sort after rule switch
    if (firstSortAfterSwitchRef.current.pending) {
      const switchKey = `${firstSortAfterSwitchRef.current.rule}`;
      const switchEvents = eventsRef.current.filter(
        (e): e is RuleSwitchEvent => e.type === 'rule_switch'
      );
      const lastSwitch = switchEvents[switchEvents.length - 1];
      if (lastSwitch && lastSwitch.firstSortAfterSwitch === null) {
        lastSwitch.firstSortAfterSwitch = { reactionTimeMs, correct };
      }
      firstSortAfterSwitchRef.current.pending = false;
    }

    if (correct) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setStreak((s) => s + 1);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setStreak(0);
    }

    setActiveObj(null);
  }, [rule]);

  // Pan responder for swiping
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 10,
      onPanResponderMove: (_, gs) => {
        swipeAnim.setValue(gs.dx);
      },
      onPanResponderRelease: (_, gs) => {
        if (Math.abs(gs.dx) >= SWIPE_THRESHOLD) {
          const direction: 'left' | 'right' = gs.dx < 0 ? 'left' : 'right';
          // Sort the frontmost unsorted falling object
          const frontObj = objectsRef.current.find((o) => !o.sorted && !o.exited);
          if (frontObj) {
            handleSort(frontObj, direction);
          }
        }
        Animated.spring(swipeAnim, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      },
    })
  ).current;

  // Spawn objects
  const spawnObject = useCallback(() => {
    const template = randomObject();
    const obj: SortObject = {
      id: uuid(),
      ...template,
      x: width / 2 + (Math.random() - 0.5) * width * 0.3,
      y: -80,
      speedPxPerMs: 0,
      spawnTimestamp: performance.now(),
      sorted: false,
      exited: false,
    };
    objectsRef.current.push(obj);
  }, [width]);

  // ─── Game loop ──────────────────────────────────
  useEffect(() => {
    startGame('sky_sort');
    gameStartRef.current = performance.now();
    lastSpawnRef.current = performance.now();

    let lastFrameTime = performance.now();

    const loop = () => {
      if (gameOverRef.current) return;

      const now = performance.now();
      const elapsed = now - gameStartRef.current;
      const remaining = GAME_DURATION_MS - elapsed;
      const dt = now - lastFrameTime;
      lastFrameTime = now;

      if (remaining <= 0) {
        gameOverRef.current = true;
        recordEvents('sky_sort', eventsRef.current);
        endGame('sky_sort');
        setShowEndAnim(true);
        setTimeout(() => router.replace('/(game)/hub'), 3000);
        return;
      }

      setTimeLeft(remaining);

      // Rule progression
      const ruleState = getCurrentRule(elapsed);
      if (ruleState.rule !== lastRuleRef.current && !ruleSwitchRecordedRef.current.has(`${lastRuleRef.current}->${ruleState.rule}`)) {
        ruleSwitchRecordedRef.current.add(`${lastRuleRef.current}->${ruleState.rule}`);
        eventsRef.current.push({
          type: 'rule_switch',
          fromRule: lastRuleRef.current,
          toRule: ruleState.rule,
          timestamp: now,
          firstSortAfterSwitch: null,
        });
        firstSortAfterSwitchRef.current = { rule: ruleState.rule, pending: true };
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
      lastRuleRef.current = ruleState.rule;
      setRule(ruleState.rule);
      setTransitioning(ruleState.transitioning);

      // Spawn
      const spawnInterval = getSpawnIntervalMs(elapsed);
      if (now - lastSpawnRef.current >= spawnInterval && !ruleState.transitioning) {
        spawnObject();
        lastSpawnRef.current = now;
      }

      // Move objects down
      const fallDuration = getFallDurationMs(elapsed);
      const fallSpeed = height / fallDuration;
      const alive: SortObject[] = [];

      for (const obj of objectsRef.current) {
        if (obj.sorted || obj.exited) continue;
        obj.y += fallSpeed * dt;
        obj.speedPxPerMs = fallSpeed;

        if (obj.y > height + 100) {
          obj.exited = true;
          continue;
        }
        alive.push(obj);
      }

      objectsRef.current = alive;
      setObjects([...alive]);

      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animFrameRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleExit = () => {
    if (gameOverRef.current) return;
    gameOverRef.current = true;
    cancelAnimationFrame(animFrameRef.current);
    recordEvents('sky_sort', eventsRef.current);
    endGame('sky_sort');
    router.replace('/(game)/hub');
  };

  if (showEndAnim) {
    return (
      <View style={styles.container}>
        <View style={styles.endWrap}>
          <Text style={styles.endIcon}>🎈</Text>
          <Text style={styles.endText}>✨</Text>
        </View>
      </View>
    );
  }

  const labels = getRuleLabels(rule);

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      {/* Timer */}
      <View style={styles.timerBg}>
        <View style={[styles.timerBar, { width: `${(timeLeft / GAME_DURATION_MS) * 100}%` }]} />
      </View>

      {/* Exit button */}
      <TouchableOpacity style={styles.exitBtn} onPress={handleExit} activeOpacity={0.7}>
        <Text style={styles.exitBtnText}>✕</Text>
      </TouchableOpacity>

      {/* Rule indicator at top */}
      <View style={[styles.ruleWrap, transitioning && styles.ruleTransitioning]}>
        <View style={styles.ruleRow}>
          <Text style={styles.ruleEmoji}>{labels.ruleIcon}</Text>
          <View style={styles.ruleArrow}>
            <Text style={styles.ruleLabel}>{labels.left}</Text>
            <Text style={styles.ruleArrowText}>⬅️  ➡️</Text>
            <Text style={styles.ruleLabel}>{labels.right}</Text>
          </View>
        </View>
        {streak >= 3 && <Text style={styles.streakText}>🔥 {streak}</Text>}
      </View>

      {/* Transitioning overlay */}
      {transitioning && (
        <View style={styles.transitionOverlay}>
          <Text style={styles.transitionText}>✨</Text>
        </View>
      )}

      {/* Falling objects */}
      {objects.map((obj) => (
        <Animated.View
          key={obj.id}
          style={[
            styles.fallingObject,
            {
              left: obj.x - (obj.objectSize === 'large' ? 50 : 35),
              top: obj.y - (obj.objectSize === 'large' ? 50 : 35),
              width: obj.objectSize === 'large' ? 100 : 70,
              height: obj.objectSize === 'large' ? 100 : 70,
              transform: [{ translateX: swipeAnim }],
            },
          ]}
        >
          <Text style={{ fontSize: obj.objectSize === 'large' ? 56 : 40 }}>
            {obj.emoji}
          </Text>
        </Animated.View>
      ))}

      {/* Baskets at bottom */}
      <View style={styles.basketRow}>
        <View style={[styles.basket, { borderColor: Colors.skyBlue }]}>
          <Text style={styles.basketIcon}>{labels.left}</Text>
        </View>
        <View style={styles.swipeHint}>
          <Text style={styles.swipeHintText}>⬅️ swipe ➡️</Text>
        </View>
        <View style={[styles.basket, { borderColor: Colors.sunsetOrange }]}>
          <Text style={styles.basketIcon}>{labels.right}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
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
  exitBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 30,
  },
  exitBtnText: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.white,
  },
  ruleWrap: {
    position: 'absolute',
    top: 20,
    alignSelf: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    zIndex: 10,
  },
  ruleTransitioning: {
    backgroundColor: 'rgba(255,215,0,0.3)',
    borderWidth: 2,
    borderColor: Colors.goldenYellow,
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  ruleEmoji: {
    fontSize: 24,
  },
  ruleArrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ruleLabel: {
    fontSize: 20,
  },
  ruleArrowText: {
    fontSize: 14,
    color: Colors.textMuted,
  },
  streakText: {
    fontSize: 16,
    marginTop: 4,
    color: Colors.sunsetOrange,
    fontWeight: '700',
  },
  transitionOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,215,0,0.1)',
    zIndex: 5,
  },
  transitionText: {
    fontSize: 64,
  },
  fallingObject: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 8,
  },
  basketRow: {
    position: 'absolute',
    bottom: 40,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  basket: {
    width: 120,
    height: 100,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 24,
    borderWidth: 4,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  basketIcon: {
    fontSize: 28,
  },
  swipeHint: {
    alignItems: 'center',
  },
  swipeHintText: {
    fontSize: 14,
    color: Colors.textMuted,
    opacity: 0.6,
  },
  endWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  endIcon: {
    fontSize: 100,
    marginBottom: 16,
  },
  endText: {
    fontSize: 48,
  },
});
