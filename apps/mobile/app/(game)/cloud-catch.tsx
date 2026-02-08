import 'react-native-get-random-values';
import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  PanResponder,
  useWindowDimensions,
} from 'react-native';
import { router } from 'expo-router';
import { v4 as uuid } from 'uuid';
import * as Haptics from 'expo-haptics';

import { useSessionStore } from '../../src/stores/session-store';
import { Colors } from '../../src/constants/colors';

// ─── Constants ────────────────────────────────────────────────────────

const GAME_DURATION_MS = 150_000; // 2.5 minutes
const MAX_LIVES = 3;
const CLOUD_SIZE = 70;
const KITE_WIDTH = 60;
const KITE_HEIGHT = 70;
const KITE_Y_OFFSET = 130; // distance from bottom
const HIT_TOLERANCE = 50; // how close cloud center must be to kite center

const BASE_SPEED = 0.18; // px per ms — starting fall speed
const SPEED_INCREMENT = 0.08; // big jump per consecutive golden catch
const MAX_SPEED = 1.2;
const SPAWN_INTERVAL_MS = 380; // lots of clouds
const GOLDEN_RATIO = 0.45; // 45% golden, rest are obstacles

type CloudType = 'golden' | 'storm' | 'bird';

interface Cloud {
  id: string;
  type: CloudType;
  x: number;
  y: number;
  speed: number;
  spawnTimestamp: number;
  caught: boolean;
  exited: boolean;
  width: number;
  height: number;
}

// ─── Event types ──────────────────────────────────────────────────────

interface StimulusEvent {
  type: 'stimulus';
  stimulusId: string;
  stimulusType: CloudType;
  spawnTimestamp: number;
  spawnPosition: { x: number; y: number };
  speed: number;
}

interface CatchEvent {
  type: 'catch';
  timestamp: number;
  stimulusId: string;
  stimulusType: CloudType;
  correct: boolean;
  combo: number;
  score: number;
  currentSpeed: number;
}

interface MissEvent {
  type: 'miss';
  stimulusId: string;
  stimulusType: 'golden';
  timeOnScreen: number;
}

type GameEvent = StimulusEvent | CatchEvent | MissEvent;

// ─── Cloud Catch Game ─────────────────────────────────────────────────

export default function CloudCatchScreen(): React.JSX.Element {
  const { width, height } = useWindowDimensions();
  const kiteY = height - KITE_Y_OFFSET;

  const recordEvents = useSessionStore((s) => s.recordEvents);
  const startGame = useSessionStore((s) => s.startGame);
  const endGame = useSessionStore((s) => s.endGame);

  const cloudsRef = useRef<Cloud[]>([]);
  const eventsRef = useRef<GameEvent[]>([]);
  const gameStartRef = useRef(0);
  const lastSpawnRef = useRef(0);
  const animFrameRef = useRef(0);
  const gameOverRef = useRef(false);
  const kiteXRef = useRef(width / 2);
  const comboRef = useRef(0);
  const scoreRef = useRef(0);
  const currentSpeedRef = useRef(BASE_SPEED);
  const livesRef = useRef(MAX_LIVES);

  const [clouds, setClouds] = useState<Cloud[]>([]);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION_MS);
  const [kiteX, setKiteX] = useState(width / 2);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [lives, setLives] = useState(MAX_LIVES);
  const [flash, setFlash] = useState<'gold' | 'red' | null>(null);
  const [showEndAnim, setShowEndAnim] = useState(false);
  const [starsEarned, setStarsEarned] = useState(false);

  // ─── Drag kite left/right — finger = kite position ─────
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        const x = Math.max(KITE_WIDTH / 2, Math.min(width - KITE_WIDTH / 2, e.nativeEvent.pageX));
        kiteXRef.current = x;
        setKiteX(x);
      },
      onPanResponderMove: (e) => {
        const x = Math.max(KITE_WIDTH / 2, Math.min(width - KITE_WIDTH / 2, e.nativeEvent.pageX));
        kiteXRef.current = x;
        setKiteX(x);
      },
    }),
  ).current;

  // ─── Spawn ──────────────────────────────────────
  const spawnCloud = () => {
    let type: CloudType;
    const roll = Math.random();
    if (roll < GOLDEN_RATIO) {
      type = 'golden';
    } else {
      // Pick randomly among obstacle types
      const obstacles: CloudType[] = ['storm', 'bird'];
      type = obstacles[Math.floor(Math.random() * obstacles.length)];
    }

    const sizeMap: Record<CloudType, { w: number; h: number }> = {
      golden: { w: CLOUD_SIZE + 10, h: CLOUD_SIZE * 0.6 },
      storm:  { w: CLOUD_SIZE, h: CLOUD_SIZE * 0.6 },
      bird:   { w: CLOUD_SIZE * 0.7, h: CLOUD_SIZE * 0.5 },
    };
    const size = sizeMap[type];

    const cloud: Cloud = {
      id: uuid(),
      type,
      x: Math.random() * (width - CLOUD_SIZE * 2) + CLOUD_SIZE,
      y: -CLOUD_SIZE,
      speed: currentSpeedRef.current,
      spawnTimestamp: performance.now(),
      caught: false,
      exited: false,
      width: size.w,
      height: size.h,
    };

    cloudsRef.current.push(cloud);

    eventsRef.current.push({
      type: 'stimulus',
      stimulusId: cloud.id,
      stimulusType: cloud.type,
      spawnTimestamp: cloud.spawnTimestamp,
      spawnPosition: { x: cloud.x, y: cloud.y },
      speed: cloud.speed,
    });
  };

  // ─── End game helper ───────────────────────────────
  const finishGame = (now: number) => {
    gameOverRef.current = true;
    for (const c of cloudsRef.current) {
      if (c.type === 'golden' && !c.caught && !c.exited) {
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
  };

  // ─── Game loop ──────────────────────────────────
  useEffect(() => {
    startGame('cloud_catch');
    gameStartRef.current = performance.now();
    lastSpawnRef.current = performance.now();

    const loop = () => {
      if (gameOverRef.current) return;

      const now = performance.now();
      const elapsed = now - gameStartRef.current;
      const remaining = GAME_DURATION_MS - elapsed;

      if (remaining <= 0) {
        finishGame(now);
        return;
      }

      setTimeLeft(remaining);

      // Spawn
      if (now - lastSpawnRef.current >= SPAWN_INTERVAL_MS) {
        spawnCloud();
        lastSpawnRef.current = now;
      }

      // Move clouds & check collisions
      const dt = 16;
      const alive: Cloud[] = [];
      const kx = kiteXRef.current;

      for (const cloud of cloudsRef.current) {
        if (cloud.caught || cloud.exited) continue;

        cloud.y += currentSpeedRef.current * dt;

        // Collision with kite
        const dx = Math.abs(cloud.x - kx);
        const dy = Math.abs(cloud.y - kiteY);

        if (dx < HIT_TOLERANCE && dy < HIT_TOLERANCE) {
          cloud.caught = true;

          if (cloud.type === 'golden') {
            // Good catch — combo + speed up
            comboRef.current += 1;
            const comboMultiplier = Math.min(comboRef.current, 10);
            const points = 10 * comboMultiplier;
            scoreRef.current += points;
            currentSpeedRef.current = Math.min(
              MAX_SPEED,
              BASE_SPEED + SPEED_INCREMENT * comboRef.current,
            );
            setScore(scoreRef.current);
            setCombo(comboRef.current);
            setFlash('gold');
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          } else {
            // Any obstacle — lose a life, reset combo & speed
            livesRef.current -= 1;
            setLives(livesRef.current);
            comboRef.current = 0;
            currentSpeedRef.current = BASE_SPEED;
            setCombo(0);
            setFlash('red');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          }

          eventsRef.current.push({
            type: 'catch',
            timestamp: now,
            stimulusId: cloud.id,
            stimulusType: cloud.type,
            correct: cloud.type === 'golden',
            combo: comboRef.current,
            score: scoreRef.current,
            currentSpeed: currentSpeedRef.current,
          });

          setTimeout(() => setFlash(null), 200);

          // Out of lives — end game
          if (livesRef.current <= 0) {
            finishGame(now);
            return;
          }

          continue;
        }

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
        <View style={styles.endScoreWrap}>
          <Text style={styles.endScoreLabel}>Score</Text>
          <Text style={styles.endScoreValue}>{score}</Text>
        </View>
        {starsEarned && (
          <View style={styles.starsContainer}>
            <View style={styles.starBadge}>
              <View style={[styles.starInner, { backgroundColor: Colors.goldenYellow }]} />
            </View>
          </View>
        )}
      </View>
    );
  }

  // ─── Main game ──────────────────────────────────
  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      <View style={styles.skyGradient} />

      {/* Decorative bg clouds */}
      <View style={[styles.bgCloud, { left: width * 0.1, top: 50, width: 120, height: 45 }]} />
      <View style={[styles.bgCloud, { left: width * 0.65, top: 30, width: 140, height: 50 }]} />

      {/* HUD */}
      <View style={styles.hud}>
        <View style={styles.hudItem}>
          <Text style={styles.hudLabel}>Score</Text>
          <Text style={styles.hudValue}>{score}</Text>
        </View>
        {combo > 1 && (
          <View style={styles.hudItem}>
            <Text style={styles.comboText}>x{combo}</Text>
          </View>
        )}
        <View style={styles.livesContainer}>
          {Array.from({ length: MAX_LIVES }, (_, i) => (
            <View
              key={i}
              style={[
                styles.lifeHeart,
                i >= lives && styles.lifeHeartLost,
              ]}
            />
          ))}
        </View>
      </View>

      {/* Flash overlay */}
      {flash && (
        <View
          style={[
            styles.flash,
            { backgroundColor: flash === 'gold' ? 'rgba(255,215,0,0.15)' : 'rgba(239,68,68,0.15)' },
          ]}
        />
      )}

      {/* Falling clouds */}
      {clouds.map((cloud) => {
        const basePos = {
          left: cloud.x - cloud.width / 2,
          top: cloud.y - cloud.height / 2,
          width: cloud.width,
          height: cloud.height,
        };

        if (cloud.type === 'golden') {
          return (
            <View key={cloud.id} style={[styles.goldenCloud, basePos, { borderRadius: cloud.height / 2 }]}>
              <View style={styles.goldenHighlight} />
            </View>
          );
        }
        if (cloud.type === 'storm') {
          return (
            <View key={cloud.id} style={[styles.stormCloud, basePos, { borderRadius: cloud.height / 2 }]}>
              <View style={styles.stormBolt} />
            </View>
          );
        }
        // bird
        return (
          <View key={cloud.id} style={[styles.birdBody, basePos, { borderRadius: cloud.height / 2 }]}>
            <View style={styles.birdWingLeft} />
            <View style={styles.birdWingRight} />
          </View>
        );
      })}

      {/* Kite (draggable) */}
      <View style={[styles.kite, { left: kiteX - KITE_WIDTH / 2, top: kiteY - KITE_HEIGHT / 2 }]}>
        <View style={styles.kiteDiamond} />
        <View style={styles.kiteTailLine} />
        <View style={[styles.kiteTailBow, { top: 42, left: 22, backgroundColor: Colors.grassGreen }]} />
        <View style={[styles.kiteTailBow, { top: 54, left: 32, backgroundColor: Colors.goldenYellow }]} />
      </View>

      {/* Speed indicator */}
      <View style={[styles.speedBar, { bottom: 20 }]}>
        <View
          style={[
            styles.speedFill,
            {
              width: `${((currentSpeedRef.current - BASE_SPEED) / (MAX_SPEED - BASE_SPEED)) * 100}%`,
            },
          ]}
        />
        <Text style={styles.speedLabel}>Speed</Text>
      </View>

      {/* Timer */}
      <View style={styles.timerBg}>
        <View style={[styles.timerBar, { width: `${(timeLeft / GAME_DURATION_MS) * 100}%` }]} />
      </View>
    </View>
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
    opacity: 0.25,
  },
  // HUD
  hud: {
    position: 'absolute',
    top: 16,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    zIndex: 20,
  },
  hudItem: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
  },
  hudLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  hudValue: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textDark,
  },
  comboText: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.sunsetOrange,
  },
  livesContainer: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.85)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
  },
  lifeHeart: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#EF4444',
  },
  lifeHeartLost: {
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  // Flash overlay
  flash: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 15,
  },
  // Golden cloud
  goldenCloud: {
    position: 'absolute',
    backgroundColor: Colors.goldenYellow,
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
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
  // Storm cloud
  stormCloud: {
    position: 'absolute',
    backgroundColor: Colors.stormGrey,
    zIndex: 5,
  },
  stormBolt: {
    position: 'absolute',
    bottom: -3,
    right: '30%',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.goldenYellow,
    opacity: 0.7,
  },
  // Bird
  birdBody: {
    position: 'absolute',
    backgroundColor: '#2C2C2C',
    zIndex: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  birdWingLeft: {
    position: 'absolute',
    left: -6,
    top: 2,
    width: 14,
    height: 8,
    backgroundColor: '#3A3A3A',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 2,
    transform: [{ rotate: '-25deg' }],
  },
  birdWingRight: {
    position: 'absolute',
    right: -6,
    top: 2,
    width: 14,
    height: 8,
    backgroundColor: '#3A3A3A',
    borderTopLeftRadius: 2,
    borderTopRightRadius: 8,
    transform: [{ rotate: '25deg' }],
  },
  // Kite
  kite: {
    position: 'absolute',
    width: KITE_WIDTH,
    height: KITE_HEIGHT,
    alignItems: 'center',
    zIndex: 10,
  },
  kiteDiamond: {
    width: 44,
    height: 44,
    backgroundColor: Colors.sunsetOrange,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: Colors.white,
    transform: [{ rotate: '45deg' }],
  },
  kiteTailLine: {
    width: 2,
    height: 30,
    backgroundColor: Colors.sunsetOrange,
    marginTop: -6,
  },
  kiteTailBow: {
    position: 'absolute',
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  // Speed bar
  speedBar: {
    position: 'absolute',
    left: 30,
    right: 30,
    height: 10,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 5,
    overflow: 'hidden',
    zIndex: 20,
  },
  speedFill: {
    height: '100%',
    backgroundColor: Colors.sunsetOrange,
    borderRadius: 5,
  },
  speedLabel: {
    position: 'absolute',
    alignSelf: 'center',
    fontSize: 8,
    fontWeight: '700',
    color: Colors.white,
    top: -1,
  },
  // Timer
  timerBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 5,
    backgroundColor: 'rgba(0,0,0,0.1)',
    zIndex: 20,
  },
  timerBar: {
    height: 5,
    backgroundColor: Colors.cloudWhite,
  },
  // End
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
  endScoreWrap: {
    position: 'absolute',
    top: '40%',
    alignSelf: 'center',
    alignItems: 'center',
  },
  endScoreLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.white,
    opacity: 0.8,
  },
  endScoreValue: {
    fontSize: 64,
    fontWeight: '800',
    color: Colors.white,
  },
  starsContainer: {
    position: 'absolute',
    bottom: '20%',
    alignSelf: 'center',
  },
  starBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,215,0,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  starInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
});
