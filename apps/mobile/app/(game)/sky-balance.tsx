import 'react-native-get-random-values';
import { useEffect, useRef, useState } from 'react';
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
import { Accelerometer } from 'expo-sensors';

import { useSessionStore } from '../../src/stores/session-store';
import { Colors } from '../../src/constants/colors';

// ─── Constants ────────────────────────────────────────────────────────

const GAME_DURATION_MS = 120_000; // 2 minutes
const TILT_SAMPLE_INTERVAL_MS = 100;
const INITIAL_SPAWN_INTERVAL_MS = 3500;
const MIN_SPAWN_INTERVAL_MS = 1500;
const DIFFICULTY_STEP_MS = 15_000; // speed up every 15s

const BALL_RADIUS = 18;
const PLANK_WIDTH_RATIO = 0.5; // fraction of screen width
const PLANK_HEIGHT = 14;
const FULCRUM_SIZE = 24;

const GRAVITY = 980; // px/s^2
const BALL_COLORS = ['#FF6B6B', '#4ECDC4', '#FFE66D', '#6C63FF', '#FF8C42', '#95E1D3'];

const MAX_TILT_RAD = 0.35; // max plank tilt (≈20°)
const FALL_GRAVITY = 400; // px/s^2 — slower than real gravity so kids can see them fall

interface Ball {
  id: string;
  color: string;
  falling: boolean; // true while dropping from sky, false once on plank
  screenX: number; // absolute X while falling
  screenY: number; // absolute Y while falling
  fallVelY: number; // vertical velocity while falling
  posX: number; // position along plank from center (used once landed)
  velX: number; // velocity along plank px/s
  spawnTime: number;
  landedTime: number; // when ball landed on plank
}

// ─── Event types ──────────────────────────────────────────────────────

interface TiltSampleEvent {
  type: 'tilt_sample';
  timestamp: number;
  tiltAngle: number;
  angularVelocity: number;
  ballCount: number;
}

interface BallSpawnEvent {
  type: 'ball_spawn';
  ballId: string;
  timestamp: number;
}

interface BallDropEvent {
  type: 'ball_drop';
  ballId: string;
  side: 'left' | 'right';
  tiltAngle: number;
  ballsRemaining: number;
  timeOnPlankMs: number;
  timestamp: number;
}

type GameEvent = TiltSampleEvent | BallSpawnEvent | BallDropEvent;

// ─── Sky Balance Game ─────────────────────────────────────────────────

export default function SkyBalanceScreen(): React.JSX.Element {
  const { width, height } = useWindowDimensions();
  const plankWidth = width * PLANK_WIDTH_RATIO;
  const plankHalf = plankWidth / 2;
  const plankCenterX = width / 2;
  const plankCenterY = height * 0.55;

  const recordEvents = useSessionStore((s) => s.recordEvents);
  const startGame = useSessionStore((s) => s.startGame);
  const endGame = useSessionStore((s) => s.endGame);

  // Refs for game loop
  const ballsRef = useRef<Ball[]>([]);
  const eventsRef = useRef<GameEvent[]>([]);
  const gameStartRef = useRef(0);
  const lastSpawnRef = useRef(0);
  const lastTiltSampleRef = useRef(0);
  const animFrameRef = useRef(0);
  const gameOverRef = useRef(false);
  const tiltRef = useRef(0); // current tilt angle in radians
  const prevTiltRef = useRef(0);
  const lastFrameTimeRef = useRef(0);
  const maxBallsRef = useRef(0);
  const prevTimestampRef = useRef(0);

  // React state for rendering
  const [balls, setBalls] = useState<Ball[]>([]);
  const [tiltAngle, setTiltAngle] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION_MS);
  const [showEndAnim, setShowEndAnim] = useState(false);
  const [starsEarned, setStarsEarned] = useState(false);

  // ─── Get spawn interval based on elapsed time ─────
  const getSpawnInterval = (elapsed: number): number => {
    const steps = Math.floor(elapsed / DIFFICULTY_STEP_MS);
    const interval = INITIAL_SPAWN_INTERVAL_MS - steps * 250;
    return Math.max(MIN_SPAWN_INTERVAL_MS, interval);
  };

  // ─── Spawn a ball ─────
  const spawnBall = (now: number) => {
    // Random X within plank area, start above screen
    const landingZoneX = plankCenterX + (Math.random() - 0.5) * plankHalf * 0.6;
    const ball: Ball = {
      id: uuid(),
      color: BALL_COLORS[Math.floor(Math.random() * BALL_COLORS.length)],
      falling: true,
      screenX: landingZoneX,
      screenY: -BALL_RADIUS * 2, // above screen
      fallVelY: 0,
      posX: 0,
      velX: 0,
      spawnTime: now,
      landedTime: 0,
    };
    ballsRef.current.push(ball);
    eventsRef.current.push({
      type: 'ball_spawn',
      ballId: ball.id,
      timestamp: now,
    });
  };

  // ─── End game helper ─────
  const finishGame = () => {
    gameOverRef.current = true;
    cancelAnimationFrame(animFrameRef.current);
    recordEvents('sky_balance', eventsRef.current);
    endGame('sky_balance');
    setShowEndAnim(true);
    setTimeout(() => setStarsEarned(true), 800);
    setTimeout(() => router.replace('/(game)/transition'), 3500);
  };

  // ─── Exit button ─────
  const handleExit = () => {
    if (gameOverRef.current) return;
    gameOverRef.current = true;
    cancelAnimationFrame(animFrameRef.current);
    router.replace('/(game)/hub');
  };

  // ─── Game loop ─────
  useEffect(() => {
    startGame('sky_balance');
    const startTime = performance.now();
    gameStartRef.current = startTime;
    lastSpawnRef.current = startTime;
    lastTiltSampleRef.current = startTime;
    lastFrameTimeRef.current = startTime;

    // Subscribe to accelerometer
    Accelerometer.setUpdateInterval(16);
    const subscription = Accelerometer.addListener(({ y }) => {
      // y axis: side-to-side roll in landscape — tilt left side up → plank left rises
      const raw = -y * 1.5; // negate so physical tilt direction matches plank visually
      tiltRef.current = Math.max(-MAX_TILT_RAD, Math.min(MAX_TILT_RAD, raw));
    });

    const loop = () => {
      if (gameOverRef.current) return;

      const now = performance.now();
      const elapsed = now - gameStartRef.current;
      const dt = Math.min((now - lastFrameTimeRef.current) / 1000, 0.05); // seconds, capped
      lastFrameTimeRef.current = now;

      // Check time
      const remaining = GAME_DURATION_MS - elapsed;
      if (remaining <= 0) {
        setTimeLeft(0);
        finishGame();
        return;
      }
      setTimeLeft(remaining);

      // Spawn balls
      const spawnInterval = getSpawnInterval(elapsed);
      if (now - lastSpawnRef.current >= spawnInterval) {
        spawnBall(now);
        lastSpawnRef.current = now;
      }

      const currentTilt = tiltRef.current;

      // Count only landed balls for tilt sample
      const landedCount = ballsRef.current.filter((b) => !b.falling).length;

      // Record tilt sample
      if (now - lastTiltSampleRef.current >= TILT_SAMPLE_INTERVAL_MS) {
        const angularVelocity = (currentTilt - prevTiltRef.current) / (TILT_SAMPLE_INTERVAL_MS / 1000);
        eventsRef.current.push({
          type: 'tilt_sample',
          timestamp: now,
          tiltAngle: currentTilt,
          angularVelocity,
          ballCount: landedCount,
        });
        prevTiltRef.current = currentTilt;
        lastTiltSampleRef.current = now;
      }

      // The plank surface Y in screen coords (at center)
      const plankSurfaceY = plankCenterY - PLANK_HEIGHT / 2 - BALL_RADIUS;

      // Physics
      const accel = GRAVITY * Math.sin(currentTilt);
      const alive: Ball[] = [];

      for (const ball of ballsRef.current) {
        if (ball.falling) {
          // Falling from sky — vertical gravity
          ball.fallVelY += FALL_GRAVITY * dt;
          ball.screenY += ball.fallVelY * dt;

          // Check if ball reached plank surface
          // Account for tilt: surface Y at ball's X offset from center
          const offsetFromCenter = ball.screenX - plankCenterX;
          const tiltedSurfaceY = plankSurfaceY + offsetFromCenter * Math.sin(currentTilt);

          if (ball.screenY >= tiltedSurfaceY) {
            // Land on plank
            ball.falling = false;
            ball.posX = ball.screenX - plankCenterX; // convert to plank-relative
            ball.velX = 0;
            ball.landedTime = now;
          }

          alive.push(ball);
          continue;
        }

        // Landed ball — roll physics
        ball.velX += accel * dt;
        ball.velX *= 0.995; // friction
        ball.posX += ball.velX * dt;

        // Ball-edge collision: check if ball fell off plank
        if (Math.abs(ball.posX) > plankHalf - BALL_RADIUS) {
          const side = ball.posX > 0 ? 'right' : 'left';
          eventsRef.current.push({
            type: 'ball_drop',
            ballId: ball.id,
            side,
            tiltAngle: currentTilt,
            ballsRemaining: landedCount - 1,
            timeOnPlankMs: now - ball.landedTime,
            timestamp: now,
          });
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          continue;
        }

        alive.push(ball);
      }

      // Simple 1D elastic collisions between landed balls
      const landed = alive.filter((b) => !b.falling);
      landed.sort((a, b) => a.posX - b.posX);
      for (let i = 0; i < landed.length - 1; i++) {
        const a = landed[i];
        const b = landed[i + 1];
        const dist = b.posX - a.posX;
        if (dist < BALL_RADIUS * 2) {
          const tempV = a.velX;
          a.velX = b.velX;
          b.velX = tempV;
          const overlap = BALL_RADIUS * 2 - dist;
          a.posX -= overlap / 2;
          b.posX += overlap / 2;
        }
      }

      // Track max landed balls
      const currentLanded = alive.filter((b) => !b.falling).length;
      if (currentLanded > maxBallsRef.current) {
        maxBallsRef.current = currentLanded;
      }

      ballsRef.current = alive;
      setBalls([...alive]);
      setTiltAngle(currentTilt);
      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      subscription.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Timer bar width ─────
  const timerFraction = Math.max(0, timeLeft / GAME_DURATION_MS);

  // ─── End animation ─────
  if (showEndAnim) {
    return (
      <View style={styles.container}>
        <View style={styles.skyGradient} />
        <View style={[styles.sunGlow, { left: width / 2 - 110, top: height * 0.25 - 110 }]} />
        <View style={[styles.sun, { left: width / 2 - 80, top: height * 0.25 - 80 }]} />
        <View style={styles.endMessageWrap}>
          <Text style={styles.endEmoji}>⚖️</Text>
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

  // ─── Plank rotation for rendering ─────
  const tiltDeg = (tiltAngle * 180) / Math.PI;

  // ─── Main game ─────
  return (
    <View style={styles.container}>
      <View style={styles.skyGradient} />

      {/* Decorative bg clouds */}
      <View style={[styles.bgCloud, { left: width * 0.08, top: 40, width: 100, height: 38 }]} />
      <View style={[styles.bgCloud, { left: width * 0.6, top: 25, width: 120, height: 42 }]} />

      {/* HUD */}
      <View style={styles.hud}>
        <TouchableOpacity style={styles.exitBtn} onPress={handleExit} activeOpacity={0.7}>
          <Text style={styles.exitBtnText}>✕</Text>
        </TouchableOpacity>
        <View style={styles.hudItem}>
          <Text style={styles.hudLabel}>Balls</Text>
          <Text style={styles.hudValue}>{balls.length}</Text>
        </View>
        <View style={styles.hudItem}>
          <Text style={styles.hudLabel}>Best</Text>
          <Text style={styles.hudValue}>{maxBallsRef.current}</Text>
        </View>
      </View>

      {/* Timer bar */}
      <View style={styles.timerBar}>
        <View style={[styles.timerFill, { width: `${timerFraction * 100}%` }]} />
      </View>

      {/* Fulcrum triangle */}
      <View
        style={[
          styles.fulcrum,
          {
            left: plankCenterX - FULCRUM_SIZE / 2,
            top: plankCenterY + PLANK_HEIGHT / 2,
          },
        ]}
      />

      {/* Falling balls (screen space, rendered behind plank) */}
      {balls.filter((b) => b.falling).map((ball) => (
        <View
          key={ball.id}
          style={[
            styles.ball,
            {
              left: ball.screenX - BALL_RADIUS,
              top: ball.screenY - BALL_RADIUS,
              backgroundColor: ball.color,
              zIndex: 8,
            },
          ]}
        >
          <View style={styles.ballHighlight} />
        </View>
      ))}

      {/* Plank */}
      <View
        style={[
          styles.plankContainer,
          {
            left: plankCenterX - plankHalf,
            top: plankCenterY - PLANK_HEIGHT / 2,
            width: plankWidth,
            height: PLANK_HEIGHT,
            transform: [{ rotate: `${tiltDeg}deg` }],
          },
        ]}
      >
        <View style={styles.plank} />

        {/* Landed balls on plank */}
        {balls.filter((b) => !b.falling).map((ball) => {
          const ballScreenX = plankHalf + ball.posX - BALL_RADIUS;
          const ballScreenY = -BALL_RADIUS * 2;

          return (
            <View
              key={ball.id}
              style={[
                styles.ball,
                {
                  left: ballScreenX,
                  top: ballScreenY,
                  backgroundColor: ball.color,
                },
              ]}
            >
              <View style={styles.ballHighlight} />
            </View>
          );
        })}
      </View>

      {/* Ground */}
      <View style={[styles.ground, { top: height * 0.85 }]} />
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
  // Timer
  timerBar: {
    position: 'absolute',
    top: 80,
    left: 30,
    right: 30,
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 4,
    overflow: 'hidden',
    zIndex: 20,
  },
  timerFill: {
    height: '100%',
    backgroundColor: Colors.grassGreen,
    borderRadius: 4,
  },
  // Plank
  plankContainer: {
    position: 'absolute',
    zIndex: 10,
  },
  plank: {
    width: '100%',
    height: '100%',
    backgroundColor: '#8B6914',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#6B4F12',
  },
  // Fulcrum
  fulcrum: {
    position: 'absolute',
    width: 0,
    height: 0,
    borderLeftWidth: FULCRUM_SIZE / 2,
    borderRightWidth: FULCRUM_SIZE / 2,
    borderBottomWidth: FULCRUM_SIZE,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#6B4F12',
    zIndex: 9,
  },
  // Ball
  ball: {
    position: 'absolute',
    width: BALL_RADIUS * 2,
    height: BALL_RADIUS * 2,
    borderRadius: BALL_RADIUS,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  ballHighlight: {
    position: 'absolute',
    top: 4,
    left: 6,
    width: '35%',
    height: '35%',
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  // Ground
  ground: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.grassGreen,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
  },
  // Exit button
  exitBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  exitBtnText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.white,
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
  endMessageWrap: {
    position: 'absolute',
    top: '40%',
    alignSelf: 'center',
    alignItems: 'center',
  },
  endEmoji: {
    fontSize: 80,
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
