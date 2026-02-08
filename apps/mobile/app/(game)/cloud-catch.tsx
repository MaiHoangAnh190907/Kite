import 'react-native-get-random-values';
import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableWithoutFeedback,
  useWindowDimensions,
  Animated,
} from 'react-native';
import { router } from 'expo-router';
import { v4 as uuid } from 'uuid';
import * as Haptics from 'expo-haptics';

import { useSessionStore } from '../../src/stores/session-store';
import { Colors } from '../../src/constants/colors';

// ─── Constants ────────────────────────────────────────────────────────

const GAME_DURATION_MS = 150_000; // 2.5 minutes
const CLOUD_SIZE = 80;
const TAP_TOLERANCE = 44; // 44pt tap radius per spec

type CloudType = 'golden' | 'storm' | 'distractor';

// ─── Difficulty schedule per spec ─────────────────────────────────────
interface DifficultyTier {
  maxTimeMs: number;
  speedMs: number;      // time to cross screen vertically
  spawnIntervalMs: number;
  stormRatio: number;
  distractorRatio: number;
  distractorEmoji: string;
}

const DIFFICULTY_TIERS: DifficultyTier[] = [
  { maxTimeMs: 30_000,  speedMs: 3000, spawnIntervalMs: 2000, stormRatio: 0.20, distractorRatio: 0,    distractorEmoji: '' },
  { maxTimeMs: 60_000,  speedMs: 2500, spawnIntervalMs: 1500, stormRatio: 0.25, distractorRatio: 0.10, distractorEmoji: '🐦' },
  { maxTimeMs: 90_000,  speedMs: 2000, spawnIntervalMs: 1200, stormRatio: 0.25, distractorRatio: 0.10, distractorEmoji: '🌈' },
  { maxTimeMs: 120_000, speedMs: 1500, spawnIntervalMs: 1000, stormRatio: 0.25, distractorRatio: 0.10, distractorEmoji: '🐦' },
  { maxTimeMs: 150_000, speedMs: 1500, spawnIntervalMs: 800,  stormRatio: 0.40, distractorRatio: 0.10, distractorEmoji: '🌈' },
];

function getTier(elapsedMs: number): DifficultyTier {
  for (const tier of DIFFICULTY_TIERS) {
    if (elapsedMs < tier.maxTimeMs) return tier;
  }
  return DIFFICULTY_TIERS[DIFFICULTY_TIERS.length - 1];
}

interface Cloud {
  id: string;
  type: CloudType;
  x: number;
  y: number;
  speedPxPerMs: number;
  spawnTimestamp: number;
  tapped: boolean;
  exited: boolean;
  width: number;
  height: number;
  emoji: string;
}

// ─── Event types per spec ─────────────────────────────────────────────

interface StimulusEvent {
  type: 'stimulus';
  stimulusId: string;
  stimulusType: CloudType;
  spawnTimestamp: number;
  spawnPosition: { x: number; y: number };
  speed: number;
}

interface TapEvent {
  type: 'tap';
  timestamp: number;
  position: { x: number; y: number };
  targetId: string | null;
  correct: boolean;
  reactionTimeMs: number;
}

interface MissEvent {
  type: 'miss';
  stimulusId: string;
  stimulusType: 'golden';
  timeOnScreen: number;
}

type GameEvent = StimulusEvent | TapEvent | MissEvent;

// ─── Cloud Catch Game ─────────────────────────────────────────────────

export default function CloudCatchScreen(): React.JSX.Element {
  const { width, height } = useWindowDimensions();

  const recordEvents = useSessionStore((s) => s.recordEvents);
  const startGame = useSessionStore((s) => s.startGame);
  const endGame = useSessionStore((s) => s.endGame);

  const cloudsRef = useRef<Cloud[]>([]);
  const eventsRef = useRef<GameEvent[]>([]);
  const gameStartRef = useRef(0);
  const lastSpawnRef = useRef(0);
  const animFrameRef = useRef(0);
  const gameOverRef = useRef(false);
  const breezeAnimRef = useRef(new Animated.Value(0)).current;

  const [clouds, setClouds] = useState<Cloud[]>([]);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION_MS);
  const [showEndAnim, setShowEndAnim] = useState(false);
  const [starsEarned, setStarsEarned] = useState(false);
  const [breezeState, setBreezeState] = useState<'idle' | 'happy' | 'shake'>('idle');

  // Breeze idle bob animation
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(breezeAnimRef, { toValue: -8, duration: 1000, useNativeDriver: true }),
        Animated.timing(breezeAnimRef, { toValue: 8, duration: 1000, useNativeDriver: true }),
      ]),
    ).start();
  }, [breezeAnimRef]);

  const triggerBreezeReaction = (type: 'happy' | 'shake') => {
    setBreezeState(type);
    setTimeout(() => setBreezeState('idle'), 400);
  };

  // ─── Spawn ──────────────────────────────────────
  const spawnCloud = (tier: DifficultyTier) => {
    const rand = Math.random();
    let type: CloudType;
    let emoji = '';

    if (rand < tier.distractorRatio && tier.distractorEmoji) {
      type = 'distractor';
      emoji = tier.distractorEmoji;
    } else if (rand < tier.distractorRatio + tier.stormRatio) {
      type = 'storm';
    } else {
      type = 'golden';
    }

    // Spawn from top with random x, or occasionally from sides
    const fromSide = Math.random() < 0.15;
    let startX: number;
    let startY: number;

    if (fromSide) {
      startX = Math.random() < 0.5 ? -CLOUD_SIZE / 2 : width + CLOUD_SIZE / 2;
      startY = Math.random() * (height * 0.4) + 50;
    } else {
      startX = Math.random() * (width - CLOUD_SIZE * 2) + CLOUD_SIZE;
      startY = -CLOUD_SIZE;
    }

    const speedPxPerMs = height / tier.speedMs;

    const cloud: Cloud = {
      id: uuid(),
      type,
      x: startX,
      y: startY,
      speedPxPerMs,
      spawnTimestamp: performance.now(),
      tapped: false,
      exited: false,
      width: CLOUD_SIZE + (type === 'golden' ? 10 : 0),
      height: CLOUD_SIZE * 0.65,
      emoji,
    };

    cloudsRef.current.push(cloud);

    eventsRef.current.push({
      type: 'stimulus',
      stimulusId: cloud.id,
      stimulusType: cloud.type,
      spawnTimestamp: cloud.spawnTimestamp,
      spawnPosition: { x: cloud.x / width, y: cloud.y / height },
      speed: cloud.speedPxPerMs,
    });
  };

  // ─── Handle tap on a cloud ──────────────────────
  const handleTapCloud = (cloud: Cloud) => {
    if (gameOverRef.current || cloud.tapped) return;

    cloud.tapped = true;
    const now = performance.now();
    const reactionTimeMs = now - cloud.spawnTimestamp;

    if (cloud.type === 'golden') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      triggerBreezeReaction('happy');
      eventsRef.current.push({
        type: 'tap',
        timestamp: now,
        position: { x: cloud.x / width, y: cloud.y / height },
        targetId: cloud.id,
        correct: true,
        reactionTimeMs,
      });
    } else if (cloud.type === 'storm') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      triggerBreezeReaction('shake');
      eventsRef.current.push({
        type: 'tap',
        timestamp: now,
        position: { x: cloud.x / width, y: cloud.y / height },
        targetId: cloud.id,
        correct: false,
        reactionTimeMs,
      });
    }
    // Distractors: do nothing on tap (ignore)
  };

  // ─── Handle tap on empty space ──────────────────
  const handleTapEmpty = (pageX: number, pageY: number) => {
    if (gameOverRef.current) return;

    // Check if tap is near any cloud
    for (const cloud of cloudsRef.current) {
      if (cloud.tapped || cloud.exited) continue;
      const dx = Math.abs(pageX - cloud.x);
      const dy = Math.abs(pageY - cloud.y);
      if (dx < TAP_TOLERANCE + cloud.width / 2 && dy < TAP_TOLERANCE + cloud.height / 2) {
        handleTapCloud(cloud);
        return;
      }
    }

    // Tap missed all clouds
    const now = performance.now();
    eventsRef.current.push({
      type: 'tap',
      timestamp: now,
      position: { x: pageX / width, y: pageY / height },
      targetId: null,
      correct: false,
      reactionTimeMs: 0,
    });
  };

  // ─── Game loop ──────────────────────────────────
  useEffect(() => {
    startGame('cloud_catch');
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
        // Record misses for remaining golden clouds
        for (const c of cloudsRef.current) {
          if (c.type === 'golden' && !c.tapped && !c.exited) {
            eventsRef.current.push({
              type: 'miss',
              stimulusId: c.id,
              stimulusType: 'golden',
              timeOnScreen: now - c.spawnTimestamp,
            });
          }
        }
        recordEvents('cloud_catch', eventsRef.current);
        endGame('cloud_catch');
        setShowEndAnim(true);
        setTimeout(() => setStarsEarned(true), 800);
        setTimeout(() => router.replace('/(game)/transition'), 3500);
        return;
      }

      setTimeLeft(remaining);

      const tier = getTier(elapsed);

      // Spawn clouds
      if (now - lastSpawnRef.current >= tier.spawnIntervalMs) {
        spawnCloud(tier);
        lastSpawnRef.current = now;
      }

      // Move clouds downward
      const alive: Cloud[] = [];
      for (const cloud of cloudsRef.current) {
        if (cloud.tapped || cloud.exited) continue;

        cloud.y += cloud.speedPxPerMs * dt;

        // Exited bottom
        if (cloud.y > height + CLOUD_SIZE) {
          cloud.exited = true;
          if (cloud.type === 'golden') {
            eventsRef.current.push({
              type: 'miss',
              stimulusId: cloud.id,
              stimulusType: 'golden',
              timeOnScreen: now - cloud.spawnTimestamp,
            });
          }
          continue;
        }

        alive.push(cloud);
      }

      cloudsRef.current = alive;
      setClouds([...alive]);
      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animFrameRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── End animation ──────────────────────────────
  if (showEndAnim) {
    return (
      <View style={styles.container}>
        <View style={styles.skyGradient} />
        <View style={[styles.sunGlow, { left: width / 2 - 110, top: height * 0.25 - 110 }]} />
        <View style={[styles.sun, { left: width / 2 - 80, top: height * 0.25 - 80 }]} />
        {starsEarned && (
          <View style={styles.starsContainer}>
            <Text style={styles.starEmoji}>⭐</Text>
          </View>
        )}
        {/* Breeze happy loop */}
        <View style={[styles.breezeEnd, { left: width / 2 - 40, top: height * 0.55 }]}>
          <Text style={{ fontSize: 64 }}>🪁</Text>
        </View>
      </View>
    );
  }

  // ─── Main game ──────────────────────────────────
  return (
    <TouchableWithoutFeedback onPress={(e) => handleTapEmpty(e.nativeEvent.pageX, e.nativeEvent.pageY)}>
      <View style={styles.container}>
        <View style={styles.skyGradient} />

        {/* Parallax bg clouds (far layer — slow) */}
        <View style={[styles.bgCloud, { left: width * 0.1, top: 50, width: 140, height: 50, opacity: 0.15 }]} />
        <View style={[styles.bgCloud, { left: width * 0.65, top: 30, width: 160, height: 55, opacity: 0.12 }]} />
        <View style={[styles.bgCloud, { left: width * 0.35, top: 100, width: 100, height: 35, opacity: 0.1 }]} />

        {/* Timer — subtle progress indicator */}
        <View style={styles.timerBg}>
          <View style={[styles.timerBar, { width: `${(timeLeft / GAME_DURATION_MS) * 100}%` }]} />
        </View>

        {/* Falling clouds — tappable */}
        {clouds.map((cloud) => (
          <TouchableWithoutFeedback
            key={cloud.id}
            onPress={() => handleTapCloud(cloud)}
          >
            <View
              style={[
                cloud.type === 'golden' ? styles.goldenCloud :
                cloud.type === 'storm' ? styles.stormCloud :
                styles.distractorCloud,
                {
                  left: cloud.x - cloud.width / 2,
                  top: cloud.y - cloud.height / 2,
                  width: cloud.width,
                  height: cloud.height,
                  borderRadius: cloud.height / 2,
                },
              ]}
            >
              {cloud.type === 'golden' && <View style={styles.goldenHighlight} />}
              {cloud.type === 'storm' && <Text style={styles.lightningIcon}>⚡</Text>}
              {cloud.type === 'distractor' && <Text style={styles.distractorIcon}>{cloud.emoji}</Text>}
            </View>
          </TouchableWithoutFeedback>
        ))}

        {/* Breeze at bottom — reacts to taps */}
        <Animated.View
          style={[
            styles.breezeWrap,
            {
              left: width / 2 - 35,
              bottom: 60,
              transform: [
                { translateY: breezeState === 'idle' ? breezeAnimRef : 0 },
                { scale: breezeState === 'happy' ? 1.15 : breezeState === 'shake' ? 0.9 : 1 },
                { rotate: breezeState === 'shake' ? '5deg' : '0deg' },
              ],
            },
          ]}
        >
          <Text style={styles.breezeEmoji}>🪁</Text>
        </Animated.View>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.skyBlue,
  },
  skyGradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.skyBlue,
  },
  bgCloud: {
    position: 'absolute',
    backgroundColor: Colors.cloudWhite,
    borderRadius: 25,
  },
  // Timer — subtle, non-distracting
  timerBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 5,
    backgroundColor: 'rgba(0,0,0,0.08)',
    zIndex: 20,
  },
  timerBar: {
    height: 5,
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  // Golden cloud — bright, fluffy, glowing
  goldenCloud: {
    position: 'absolute',
    backgroundColor: Colors.goldenYellow,
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 4,
    zIndex: 5,
  },
  goldenHighlight: {
    position: 'absolute',
    top: 4,
    left: 8,
    width: '45%',
    height: '40%',
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  // Storm cloud — dark grey, jagged
  stormCloud: {
    position: 'absolute',
    backgroundColor: Colors.stormGrey,
    zIndex: 5,
  },
  lightningIcon: {
    position: 'absolute',
    bottom: -2,
    right: '25%',
    fontSize: 14,
  },
  // Distractor — semi-transparent
  distractorCloud: {
    position: 'absolute',
    backgroundColor: 'transparent',
    zIndex: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  distractorIcon: {
    fontSize: 36,
  },
  // Breeze kite at bottom
  breezeWrap: {
    position: 'absolute',
    zIndex: 10,
  },
  breezeEmoji: {
    fontSize: 56,
  },
  // End animation
  sunGlow: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(255,215,0,0.15)',
  },
  sun: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: Colors.goldenYellow,
  },
  starsContainer: {
    position: 'absolute',
    bottom: '25%',
    alignSelf: 'center',
  },
  starEmoji: {
    fontSize: 64,
  },
  breezeEnd: {
    position: 'absolute',
  },
});
