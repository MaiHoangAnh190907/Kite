import { useEffect, useRef, useCallback, useState } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import {
  Canvas,
  RoundedRect,
  Circle,
  Path,
  Skia,
  Group,
  LinearGradient,
  vec,
  Rect,
  Text as SkiaText,
  useFont,
} from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { router } from 'expo-router';
import { v4 as uuid } from 'uuid';

import { useSessionStore } from '../../src/stores/session-store';
import { Colors } from '../../src/constants/colors';

// ─── Constants ────────────────────────────────────────────────────────

const GAME_DURATION_MS = 150_000; // 2.5 minutes
const CLOUD_SIZE = 80;
const CLOUD_HIT_RADIUS = 50;

// Difficulty tiers from spec
const DIFFICULTY_TIERS = [
  { startMs: 0,       speedMs: 3000, spawnIntervalMs: 2000, stormRatio: 0.25, distractors: false },
  { startMs: 30_000,  speedMs: 2500, spawnIntervalMs: 1500, stormRatio: 0.25, distractors: true },
  { startMs: 60_000,  speedMs: 2000, spawnIntervalMs: 1200, stormRatio: 0.30, distractors: true },
  { startMs: 90_000,  speedMs: 1500, spawnIntervalMs: 1000, stormRatio: 0.30, distractors: true },
  { startMs: 120_000, speedMs: 1500, spawnIntervalMs: 800,  stormRatio: 0.40, distractors: true },
];

type CloudType = 'golden' | 'storm' | 'distractor';

interface Cloud {
  id: string;
  type: CloudType;
  x: number;
  y: number;
  spawnY: number;
  speed: number; // px per ms
  spawnTimestamp: number;
  tapped: boolean;
  exited: boolean;
  width: number;
  height: number;
}

// Event types matching agent_docs/games.md
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

// ─── Helpers ──────────────────────────────────────────────────────────

function getDifficulty(elapsedMs: number): (typeof DIFFICULTY_TIERS)[0] {
  for (let i = DIFFICULTY_TIERS.length - 1; i >= 0; i--) {
    if (elapsedMs >= DIFFICULTY_TIERS[i].startMs) {
      return DIFFICULTY_TIERS[i];
    }
  }
  return DIFFICULTY_TIERS[0];
}

function pickCloudType(difficulty: (typeof DIFFICULTY_TIERS)[0]): CloudType {
  const roll = Math.random();
  if (difficulty.distractors && roll < 0.10) return 'distractor';
  if (roll < difficulty.stormRatio + (difficulty.distractors ? 0.10 : 0)) return 'storm';
  return 'golden';
}

// ─── Cloud Catch Game ─────────────────────────────────────────────────

export default function CloudCatchScreen(): React.JSX.Element {
  const { width, height } = useWindowDimensions();

  const recordEvents = useSessionStore((s) => s.recordEvents);
  const startGame = useSessionStore((s) => s.startGame);
  const endGame = useSessionStore((s) => s.endGame);

  const cloudsRef = useRef<Cloud[]>([]);
  const eventsRef = useRef<GameEvent[]>([]);
  const gameStartRef = useRef<number>(0);
  const lastSpawnRef = useRef<number>(0);
  const animFrameRef = useRef<number>(0);
  const gameOverRef = useRef(false);

  // State for rendering (updated every frame)
  const [clouds, setClouds] = useState<Cloud[]>([]);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION_MS);
  const [showEndAnim, setShowEndAnim] = useState(false);
  const [starsEarned, setStarsEarned] = useState(false);
  // Breeze reaction
  const [breezeState, setBreezeState] = useState<'idle' | 'happy' | 'shake'>('idle');

  // ─── Kite bobbing ─────────────────────────────
  const [kiteOffset, setKiteOffset] = useState(0);

  // ─── Spawn a cloud ────────────────────────────
  const spawnCloud = useCallback(
    (elapsed: number) => {
      const diff = getDifficulty(elapsed);
      const type = pickCloudType(diff);
      const cloud: Cloud = {
        id: uuid(),
        type,
        x: Math.random() * (width - CLOUD_SIZE * 2) + CLOUD_SIZE,
        y: -CLOUD_SIZE,
        spawnY: -CLOUD_SIZE,
        speed: (height + CLOUD_SIZE * 2) / diff.speedMs, // px per ms
        spawnTimestamp: performance.now(),
        tapped: false,
        exited: false,
        width: CLOUD_SIZE + (type === 'golden' ? 10 : 0),
        height: CLOUD_SIZE * 0.65,
      };

      cloudsRef.current.push(cloud);

      // Record stimulus event
      eventsRef.current.push({
        type: 'stimulus',
        stimulusId: cloud.id,
        stimulusType: cloud.type,
        spawnTimestamp: cloud.spawnTimestamp,
        spawnPosition: { x: cloud.x, y: cloud.y },
        speed: cloud.speed,
      });
    },
    [width, height],
  );

  // ─── Game loop ────────────────────────────────
  useEffect(() => {
    startGame('cloud_catch');
    gameStartRef.current = performance.now();
    lastSpawnRef.current = performance.now();

    const loop = () => {
      if (gameOverRef.current) return;

      const now = performance.now();
      const elapsed = now - gameStartRef.current;
      const remaining = GAME_DURATION_MS - elapsed;

      // Game over
      if (remaining <= 0) {
        gameOverRef.current = true;

        // Record misses for untapped golden clouds still on screen
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

        // Upload events to session store
        recordEvents('cloud_catch', eventsRef.current);
        endGame('cloud_catch');
        setShowEndAnim(true);

        // Show end animation, then navigate
        setTimeout(() => setStarsEarned(true), 800);
        setTimeout(() => {
          router.replace('/(game)/transition');
        }, 3500);

        return;
      }

      setTimeLeft(remaining);

      // Spawn logic
      const diff = getDifficulty(elapsed);
      if (now - lastSpawnRef.current >= diff.spawnIntervalMs) {
        spawnCloud(elapsed);
        lastSpawnRef.current = now;
      }

      // Update cloud positions
      const dt = 16; // ~60fps
      const updatedClouds: Cloud[] = [];
      for (const cloud of cloudsRef.current) {
        if (cloud.tapped || cloud.exited) continue;

        cloud.y += cloud.speed * dt;

        // Cloud exits screen
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

        updatedClouds.push(cloud);
      }

      cloudsRef.current = updatedClouds;
      setClouds([...updatedClouds]);

      // Kite bobbing
      setKiteOffset(Math.sin(now / 600) * 8);

      // Reset breeze state after reaction
      if (breezeState !== 'idle') {
        setTimeout(() => setBreezeState('idle'), 300);
      }

      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Tap handler ──────────────────────────────
  const tap = Gesture.Tap()
    .onEnd((e) => {
      if (gameOverRef.current) return;

      const tapX = e.x;
      const tapY = e.y;
      const now = performance.now();

      // Find closest tappable cloud within hit radius
      let closest: Cloud | null = null;
      let closestDist = Infinity;

      for (const cloud of cloudsRef.current) {
        if (cloud.tapped || cloud.exited) continue;
        const dx = tapX - cloud.x;
        const dy = tapY - cloud.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < CLOUD_HIT_RADIUS && dist < closestDist) {
          closest = cloud;
          closestDist = dist;
        }
      }

      const targetId = closest?.id ?? null;
      const correct = closest?.type === 'golden';
      const reactionTimeMs = closest ? now - closest.spawnTimestamp : 0;

      eventsRef.current.push({
        type: 'tap',
        timestamp: now,
        position: { x: tapX, y: tapY },
        targetId,
        correct,
        reactionTimeMs,
      });

      if (closest) {
        closest.tapped = true;
        // Breeze reaction
        setBreezeState(correct ? 'happy' : 'shake');
      }
    });

  // ─── Render ───────────────────────────────────

  if (showEndAnim) {
    return (
      <View style={styles.container}>
        <Canvas style={StyleSheet.absoluteFill}>
          {/* Sun reveal */}
          <Circle
            cx={width / 2}
            cy={height * 0.3}
            r={80}
            color={Colors.goldenYellow}
          />
          {/* Sun glow */}
          <Circle
            cx={width / 2}
            cy={height * 0.3}
            r={100}
            color="rgba(255,215,0,0.2)"
          />

          {/* Sky gradient */}
          <Rect x={0} y={0} width={width} height={height}>
            <LinearGradient
              start={vec(0, 0)}
              end={vec(0, height)}
              colors={['#87CEEB', '#E8F4FD']}
            />
          </Rect>

          {/* Sun on top of gradient */}
          <Circle
            cx={width / 2}
            cy={height * 0.3}
            r={80}
            color={Colors.goldenYellow}
          />
          <Circle
            cx={width / 2}
            cy={height * 0.3}
            r={110}
            color="rgba(255,215,0,0.15)"
          />
        </Canvas>

        {/* Stars earned */}
        {starsEarned && (
          <View style={styles.starsContainer}>
            <View style={styles.starRow}>
              {/* Using View-based elements for the star display */}
              <View style={styles.starBadge}>
                <View style={[styles.starInner, { backgroundColor: Colors.goldenYellow }]} />
              </View>
            </View>
          </View>
        )}

        {/* Breeze happy loop */}
        <View style={[styles.breezeContainer, { bottom: height * 0.15 }]}>
          <View style={styles.kiteBody}>
            <View style={[styles.kiteDiamond, { backgroundColor: Colors.sunsetOrange }]} />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <GestureDetector gesture={tap}>
        <View style={StyleSheet.absoluteFill}>
          <Canvas style={StyleSheet.absoluteFill}>
            {/* Sky gradient background */}
            <Rect x={0} y={0} width={width} height={height}>
              <LinearGradient
                start={vec(0, 0)}
                end={vec(0, height)}
                colors={['#5BA3C9', '#87CEEB', '#B8E2F8']}
              />
            </Rect>

            {/* Background decorative clouds (parallax - slow) */}
            <Group opacity={0.3}>
              <RoundedRect x={width * 0.1} y={60} width={120} height={50} r={25} color={Colors.cloudWhite} />
              <RoundedRect x={width * 0.6} y={40} width={150} height={55} r={27} color={Colors.cloudWhite} />
              <RoundedRect x={width * 0.85} y={100} width={100} height={40} r={20} color={Colors.cloudWhite} />
            </Group>

            {/* Game clouds */}
            {clouds.map((cloud) => {
              if (cloud.type === 'golden') {
                return (
                  <Group key={cloud.id}>
                    {/* Golden cloud - bright, fluffy, glowing edge */}
                    <RoundedRect
                      x={cloud.x - cloud.width / 2 - 4}
                      y={cloud.y - cloud.height / 2 - 4}
                      width={cloud.width + 8}
                      height={cloud.height + 8}
                      r={cloud.height / 2}
                      color="rgba(255,215,0,0.25)"
                    />
                    <RoundedRect
                      x={cloud.x - cloud.width / 2}
                      y={cloud.y - cloud.height / 2}
                      width={cloud.width}
                      height={cloud.height}
                      r={cloud.height / 2}
                      color={Colors.goldenYellow}
                    />
                    {/* Cloud highlight */}
                    <RoundedRect
                      x={cloud.x - cloud.width / 2 + 8}
                      y={cloud.y - cloud.height / 2 + 5}
                      width={cloud.width * 0.5}
                      height={cloud.height * 0.4}
                      r={10}
                      color="rgba(255,255,255,0.4)"
                    />
                  </Group>
                );
              }

              if (cloud.type === 'storm') {
                return (
                  <Group key={cloud.id}>
                    {/* Storm cloud - dark grey, jagged */}
                    <RoundedRect
                      x={cloud.x - CLOUD_SIZE / 2}
                      y={cloud.y - CLOUD_SIZE * 0.3}
                      width={CLOUD_SIZE}
                      height={CLOUD_SIZE * 0.6}
                      r={CLOUD_SIZE * 0.2}
                      color={Colors.stormGrey}
                    />
                    {/* Lightning bolt accent */}
                    <Circle
                      cx={cloud.x + 10}
                      cy={cloud.y + CLOUD_SIZE * 0.2}
                      r={4}
                      color={Colors.goldenYellow}
                      opacity={0.7}
                    />
                  </Group>
                );
              }

              // Distractor (bird/rainbow) - small neutral shape
              return (
                <Group key={cloud.id}>
                  <Circle
                    cx={cloud.x}
                    cy={cloud.y}
                    r={20}
                    color={Colors.softPurple}
                    opacity={0.6}
                  />
                  <Circle
                    cx={cloud.x + 12}
                    cy={cloud.y - 5}
                    r={12}
                    color={Colors.softPurple}
                    opacity={0.5}
                  />
                </Group>
              );
            })}

            {/* Breeze kite at bottom */}
            <Group
              transform={[
                { translateX: width / 2 },
                { translateY: height - 120 + kiteOffset + (breezeState === 'happy' ? -10 : breezeState === 'shake' ? 5 : 0) },
              ]}
            >
              {/* Kite body (diamond) */}
              {(() => {
                const path = Skia.Path.Make();
                path.moveTo(0, -22);
                path.lineTo(16, 0);
                path.lineTo(0, 22);
                path.lineTo(-16, 0);
                path.close();
                return <Path path={path} color={Colors.sunsetOrange} style="fill" />;
              })()}
              {/* Kite cross */}
              {(() => {
                const path = Skia.Path.Make();
                path.moveTo(0, -22);
                path.lineTo(0, 22);
                path.moveTo(-16, 0);
                path.lineTo(16, 0);
                return <Path path={path} color={Colors.white} style="stroke" strokeWidth={1.5} />;
              })()}
              {/* Tail */}
              {(() => {
                const path = Skia.Path.Make();
                path.moveTo(0, 22);
                path.cubicTo(-8, 35, 8, 48, -4, 60);
                return <Path path={path} color={Colors.sunsetOrange} style="stroke" strokeWidth={2} />;
              })()}
              {/* Tail bows */}
              <Circle cx={-5} cy={38} r={3} color={Colors.grassGreen} />
              <Circle cx={5} cy={50} r={3} color={Colors.goldenYellow} />
            </Group>

            {/* Timer bar at top */}
            <Rect x={0} y={0} width={width} height={6} color="rgba(0,0,0,0.1)" />
            <Rect
              x={0}
              y={0}
              width={width * (timeLeft / GAME_DURATION_MS)}
              height={6}
              color={Colors.cloudWhite}
            />
          </Canvas>
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.skyBlue,
  },
  starsContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  starRow: {
    flexDirection: 'row',
    gap: 20,
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
  breezeContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  kiteBody: {
    alignItems: 'center',
  },
  kiteDiamond: {
    width: 40,
    height: 40,
    borderRadius: 4,
    transform: [{ rotate: '45deg' }],
  },
});
