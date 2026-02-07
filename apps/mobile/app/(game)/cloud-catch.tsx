import 'react-native-get-random-values';
import { useEffect, useRef, useCallback, useState } from 'react';
import {
  View,
  StyleSheet,
  useWindowDimensions,
  TouchableWithoutFeedback,
} from 'react-native';
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
  const handleTap = useCallback(
    (tapX: number, tapY: number) => {
      if (gameOverRef.current) return;

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
        setBreezeState(correct ? 'happy' : 'shake');
      }
    },
    [],
  );

  // ─── Render ───────────────────────────────────

  if (showEndAnim) {
    return (
      <View style={styles.container}>
        {/* Sky gradient effect */}
        <View style={styles.skyGradient} />

        {/* Sun */}
        <View style={[styles.sunGlow, { left: width / 2 - 110, top: height * 0.3 - 110 }]} />
        <View style={[styles.sun, { left: width / 2 - 80, top: height * 0.3 - 80 }]} />

        {/* Stars earned */}
        {starsEarned && (
          <View style={styles.starsContainer}>
            <View style={styles.starRow}>
              <View style={styles.starBadge}>
                <View style={[styles.starInner, { backgroundColor: Colors.goldenYellow }]} />
              </View>
            </View>
          </View>
        )}

        {/* Breeze kite */}
        <View style={[styles.breezeContainer, { bottom: height * 0.15 }]}>
          <View style={styles.kiteBody}>
            <View style={[styles.kiteDiamond, { backgroundColor: Colors.sunsetOrange }]} />
          </View>
        </View>
      </View>
    );
  }

  return (
    <TouchableWithoutFeedback
      onPress={(e) => handleTap(e.nativeEvent.locationX, e.nativeEvent.locationY)}
    >
      <View style={styles.container}>
        {/* Sky gradient background */}
        <View style={styles.skyGradient} />

        {/* Background decorative clouds */}
        <View style={[styles.bgCloud, { left: width * 0.1, top: 60, width: 120, height: 50, opacity: 0.3 }]} />
        <View style={[styles.bgCloud, { left: width * 0.6, top: 40, width: 150, height: 55, opacity: 0.3 }]} />
        <View style={[styles.bgCloud, { left: width * 0.85, top: 100, width: 100, height: 40, opacity: 0.3 }]} />

        {/* Game clouds */}
        {clouds.map((cloud) => {
          if (cloud.type === 'golden') {
            return (
              <View
                key={cloud.id}
                style={[
                  styles.goldenCloud,
                  {
                    left: cloud.x - cloud.width / 2,
                    top: cloud.y - cloud.height / 2,
                    width: cloud.width,
                    height: cloud.height,
                    borderRadius: cloud.height / 2,
                  },
                ]}
              >
                <View style={styles.goldenHighlight} />
              </View>
            );
          }

          if (cloud.type === 'storm') {
            return (
              <View
                key={cloud.id}
                style={[
                  styles.stormCloud,
                  {
                    left: cloud.x - CLOUD_SIZE / 2,
                    top: cloud.y - CLOUD_SIZE * 0.3,
                    width: CLOUD_SIZE,
                    height: CLOUD_SIZE * 0.6,
                    borderRadius: CLOUD_SIZE * 0.2,
                  },
                ]}
              >
                <View style={styles.lightning} />
              </View>
            );
          }

          // Distractor
          return (
            <View
              key={cloud.id}
              style={[
                styles.distractorCloud,
                {
                  left: cloud.x - 20,
                  top: cloud.y - 20,
                },
              ]}
            />
          );
        })}

        {/* Breeze kite at bottom */}
        <View
          style={[
            styles.kiteCharacter,
            {
              left: width / 2 - 20,
              top: height - 120 + kiteOffset + (breezeState === 'happy' ? -10 : breezeState === 'shake' ? 5 : 0),
            },
          ]}
        >
          <View style={[styles.kiteDiamond, { backgroundColor: Colors.sunsetOrange }]} />
          <View style={styles.kiteTailLine} />
          <View style={[styles.kiteTailBow, { top: 38, left: -2, backgroundColor: Colors.grassGreen }]} />
          <View style={[styles.kiteTailBow, { top: 50, left: 8, backgroundColor: Colors.goldenYellow }]} />
        </View>

        {/* Timer bar at top */}
        <View style={styles.timerBg} />
        <View
          style={[
            styles.timerBar,
            { width: width * (timeLeft / GAME_DURATION_MS) },
          ]}
        />
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
  // Golden cloud
  goldenCloud: {
    position: 'absolute',
    backgroundColor: Colors.goldenYellow,
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  goldenHighlight: {
    position: 'absolute',
    top: 5,
    left: 8,
    width: '50%',
    height: '40%',
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  // Storm cloud
  stormCloud: {
    position: 'absolute',
    backgroundColor: Colors.stormGrey,
  },
  lightning: {
    position: 'absolute',
    bottom: -4,
    right: CLOUD_SIZE * 0.3,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.goldenYellow,
    opacity: 0.7,
  },
  // Distractor
  distractorCloud: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.softPurple,
    opacity: 0.6,
  },
  // Kite character
  kiteCharacter: {
    position: 'absolute',
    alignItems: 'center',
  },
  kiteDiamond: {
    width: 40,
    height: 40,
    borderRadius: 4,
    transform: [{ rotate: '45deg' }],
  },
  kiteTailLine: {
    width: 2,
    height: 40,
    backgroundColor: Colors.sunsetOrange,
    marginTop: -6,
  },
  kiteTailBow: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  // Timer
  timerBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 6,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  timerBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: 6,
    backgroundColor: Colors.cloudWhite,
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
});
