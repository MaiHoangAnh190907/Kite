import 'react-native-get-random-values';
import { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  PanResponder,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { router } from 'expo-router';
import { v4 as uuid } from 'uuid';
import * as Haptics from 'expo-haptics';

import { Colors } from '../../src/constants/colors';
import { useSessionStore } from '../../src/stores/session-store';
import { recognize, type SymbolName } from '../../src/utils/unistroke-recognizer';

// ─── Constants ───────────────────────────────────────────────────────

const GAME_DURATION_MS = 150_000;
const INITIAL_LIVES = 3;
const KITE_RADIUS = 40;
const ENEMY_SIZE = 70;
const ENEMY_COLLISION_RADIUS = 35;
const DIFFICULTY_INTERVAL_MS = 20_000;

function SymbolIcon({ symbol }: { symbol: SymbolName }): React.JSX.Element {
  switch (symbol) {
    case 'horizontal_line':
      return (
        <View style={symbolStyles.container}>
          <View style={symbolStyles.horizontalLine} />
        </View>
      );
    case 'vertical_line':
      return (
        <View style={symbolStyles.container}>
          <View style={symbolStyles.verticalLine} />
        </View>
      );
    case 'circle':
      return (
        <View style={symbolStyles.container}>
          <View style={symbolStyles.circle} />
        </View>
      );
    case 'v_shape':
      return (
        <View style={symbolStyles.container}>
          <View style={symbolStyles.vWrap}>
            <View style={[symbolStyles.vBar, { transform: [{ rotate: '30deg' }] }]} />
            <View style={[symbolStyles.vBar, { transform: [{ rotate: '-30deg' }] }]} />
          </View>
        </View>
      );
    case 'inverted_v':
      return (
        <View style={symbolStyles.container}>
          <View style={symbolStyles.vWrap}>
            <View style={[symbolStyles.vBar, { transform: [{ rotate: '-30deg' }] }]} />
            <View style={[symbolStyles.vBar, { transform: [{ rotate: '30deg' }] }]} />
          </View>
        </View>
      );
  }
}

const symbolStyles = StyleSheet.create({
  container: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  horizontalLine: {
    width: 28,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.white,
  },
  verticalLine: {
    width: 4,
    height: 28,
    borderRadius: 2,
    backgroundColor: Colors.white,
  },
  circle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: Colors.white,
    backgroundColor: 'transparent',
  },
  vWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: -6,
  },
  vBar: {
    width: 4,
    height: 20,
    borderRadius: 2,
    backgroundColor: Colors.white,
  },
});

const ALL_SYMBOLS: SymbolName[] = [
  'horizontal_line',
  'vertical_line',
  'v_shape',
  'inverted_v',
  'circle',
];

interface DifficultyLevel {
  speed: number;
  spawnInterval: number;
  maxEnemies: number;
}

const DIFFICULTY_LEVELS: DifficultyLevel[] = [
  { speed: 0.04, spawnInterval: 3500, maxEnemies: 2 },
  { speed: 0.055, spawnInterval: 3000, maxEnemies: 3 },
  { speed: 0.07, spawnInterval: 2500, maxEnemies: 3 },
  { speed: 0.085, spawnInterval: 2200, maxEnemies: 4 },
  { speed: 0.10, spawnInterval: 1900, maxEnemies: 4 },
  { speed: 0.12, spawnInterval: 1600, maxEnemies: 5 },
  { speed: 0.14, spawnInterval: 1400, maxEnemies: 5 },
  { speed: 0.16, spawnInterval: 1200, maxEnemies: 6 },
];

// ─── Types ───────────────────────────────────────────────────────────

interface StrokePoint {
  x: number;
  y: number;
  t: number;
}

interface Enemy {
  id: string;
  symbol: SymbolName;
  x: number;
  y: number;
  dx: number;
  dy: number;
  speed: number;
  spawnTimestamp: number;
  difficultyLevel: number;
  destroyed: boolean;
  collided: boolean;
}

interface LightBeam {
  id: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  startTime: number;
}

interface Explosion {
  id: string;
  x: number;
  y: number;
  startTime: number;
}

// ─── Event types ─────────────────────────────────────────────────────

interface GestureEvent {
  type: 'gesture';
  timestamp: number;
  strokePoints: StrokePoint[];
  recognizedSymbol: string | null;
  recognitionScore: number;
  matchedEnemyId: string | null;
  outcome: 'hit' | 'substitution_error' | 'unrecognized';
  strokeDurationMs: number;
}

interface EnemySpawnEvent {
  type: 'enemy_spawn';
  enemyId: string;
  symbol: string;
  spawnPosition: { x: number; y: number };
  spawnTimestamp: number;
  difficultyLevel: number;
  speed: number;
}

interface EnemyDestroyedEvent {
  type: 'enemy_destroyed';
  enemyId: string;
  symbol: string;
  destroyTimestamp: number;
  recognitionLatencyMs: number;
  strokePrecision: number;
}

interface CollisionEvent {
  type: 'collision';
  enemyId: string;
  symbol: string;
  timestamp: number;
  livesRemaining: number;
}

type GameEvent = GestureEvent | EnemySpawnEvent | EnemyDestroyedEvent | CollisionEvent;

// ─── Component ───────────────────────────────────────────────────────

export default function SkySigilsScreen(): React.JSX.Element {
  const { width, height } = useWindowDimensions();
  const kiteX = width / 2;
  const kiteY = height / 2;

  const recordEvents = useSessionStore((s) => s.recordEvents);
  const startGame = useSessionStore((s) => s.startGame);
  const endGame = useSessionStore((s) => s.endGame);

  const eventsRef = useRef<GameEvent[]>([]);
  const gameStartRef = useRef(0);
  const animFrameRef = useRef(0);
  const gameOverRef = useRef(false);
  const lastSpawnRef = useRef(0);
  const enemiesRef = useRef<Enemy[]>([]);
  const livesRef = useRef(INITIAL_LIVES);
  const strokeRef = useRef<StrokePoint[]>([]);
  const isDrawingRef = useRef(false);

  const [enemies, setEnemies] = useState<Enemy[]>([]);
  const [lives, setLives] = useState(INITIAL_LIVES);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION_MS);
  const [flash, setFlash] = useState<'gold' | 'red' | null>(null);
  const [drawingTrail, setDrawingTrail] = useState<StrokePoint[]>([]);
  const [beams, setBeams] = useState<LightBeam[]>([]);
  const [explosions, setExplosions] = useState<Explosion[]>([]);
  const [showEndAnim, setShowEndAnim] = useState(false);
  const [starsEarned, setStarsEarned] = useState(false);

  // ─── Difficulty ────────────────────────────────────────────────────

  const getDifficulty = useCallback((elapsed: number): DifficultyLevel => {
    const level = Math.min(
      DIFFICULTY_LEVELS.length - 1,
      Math.floor(elapsed / DIFFICULTY_INTERVAL_MS),
    );
    return DIFFICULTY_LEVELS[level];
  }, []);

  const getDifficultyIndex = useCallback((elapsed: number): number => {
    return Math.min(
      DIFFICULTY_LEVELS.length - 1,
      Math.floor(elapsed / DIFFICULTY_INTERVAL_MS),
    );
  }, []);

  // ─── End game ──────────────────────────────────────────────────────

  const finishGame = useCallback(() => {
    if (gameOverRef.current) return;
    gameOverRef.current = true;
    cancelAnimationFrame(animFrameRef.current);
    recordEvents('sky_sigils', eventsRef.current);
    endGame('sky_sigils');
    setShowEndAnim(true);
    setTimeout(() => setStarsEarned(true), 800);
    setTimeout(() => router.replace('/(game)/hub'), 3500);
  }, [recordEvents, endGame]);

  // ─── Spawn enemy ───────────────────────────────────────────────────

  const spawnEnemy = useCallback((elapsed: number) => {
    const diff = getDifficulty(elapsed);
    const diffIdx = getDifficultyIndex(elapsed);

    // Don't exceed max enemies
    const activeCount = enemiesRef.current.filter((e) => !e.destroyed && !e.collided).length;
    if (activeCount >= diff.maxEnemies) return;

    const symbol = ALL_SYMBOLS[Math.floor(Math.random() * ALL_SYMBOLS.length)];

    // Pick random edge
    const edge = Math.floor(Math.random() * 4);
    let sx: number, sy: number;
    switch (edge) {
      case 0: sx = Math.random() * width; sy = -ENEMY_SIZE; break;        // top
      case 1: sx = width + ENEMY_SIZE; sy = Math.random() * height; break; // right
      case 2: sx = Math.random() * width; sy = height + ENEMY_SIZE; break; // bottom
      default: sx = -ENEMY_SIZE; sy = Math.random() * height; break;       // left
    }

    // Direction toward center
    const angle = Math.atan2(kiteY - sy, kiteX - sx);
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);

    const enemy: Enemy = {
      id: uuid(),
      symbol,
      x: sx,
      y: sy,
      dx,
      dy,
      speed: diff.speed,
      spawnTimestamp: performance.now(),
      difficultyLevel: diffIdx,
      destroyed: false,
      collided: false,
    };

    enemiesRef.current.push(enemy);

    eventsRef.current.push({
      type: 'enemy_spawn',
      enemyId: enemy.id,
      symbol: enemy.symbol,
      spawnPosition: { x: sx, y: sy },
      spawnTimestamp: enemy.spawnTimestamp,
      difficultyLevel: diffIdx,
      speed: diff.speed,
    });
  }, [width, height, kiteX, kiteY, getDifficulty, getDifficultyIndex]);

  // ─── Handle gesture recognition ───────────────────────────────────

  const handleStrokeEnd = useCallback(() => {
    const points = strokeRef.current;
    if (points.length < 3) {
      strokeRef.current = [];
      setDrawingTrail([]);
      return;
    }

    const now = performance.now();
    const strokeDurationMs = points.length > 0 ? now - points[0].t : 0;
    const result = recognize(points.map((p) => ({ x: p.x, y: p.y })));

    if (!result) {
      // Unrecognized
      eventsRef.current.push({
        type: 'gesture',
        timestamp: now,
        strokePoints: [...points],
        recognizedSymbol: null,
        recognitionScore: 0,
        matchedEnemyId: null,
        outcome: 'unrecognized',
        strokeDurationMs,
      });
      strokeRef.current = [];
      setDrawingTrail([]);
      return;
    }

    // Find nearest active enemy with matching symbol
    const activeEnemies = enemiesRef.current.filter(
      (e) => !e.destroyed && !e.collided && e.symbol === result.name,
    );

    if (activeEnemies.length === 0) {
      // Substitution error — valid symbol but no matching enemy
      eventsRef.current.push({
        type: 'gesture',
        timestamp: now,
        strokePoints: [...points],
        recognizedSymbol: result.name,
        recognitionScore: result.score,
        matchedEnemyId: null,
        outcome: 'substitution_error',
        strokeDurationMs,
      });
      strokeRef.current = [];
      setDrawingTrail([]);
      return;
    }

    // Find closest matching enemy to kite center
    let closestEnemy = activeEnemies[0];
    let closestDist = Math.sqrt(
      (closestEnemy.x - kiteX) ** 2 + (closestEnemy.y - kiteY) ** 2,
    );
    for (let i = 1; i < activeEnemies.length; i++) {
      const d = Math.sqrt(
        (activeEnemies[i].x - kiteX) ** 2 + (activeEnemies[i].y - kiteY) ** 2,
      );
      if (d < closestDist) {
        closestDist = d;
        closestEnemy = activeEnemies[i];
      }
    }

    // Destroy enemy
    closestEnemy.destroyed = true;

    eventsRef.current.push({
      type: 'gesture',
      timestamp: now,
      strokePoints: [...points],
      recognizedSymbol: result.name,
      recognitionScore: result.score,
      matchedEnemyId: closestEnemy.id,
      outcome: 'hit',
      strokeDurationMs,
    });

    eventsRef.current.push({
      type: 'enemy_destroyed',
      enemyId: closestEnemy.id,
      symbol: closestEnemy.symbol,
      destroyTimestamp: now,
      recognitionLatencyMs: now - closestEnemy.spawnTimestamp,
      strokePrecision: result.score,
    });

    // Light beam effect
    const beamId = uuid();
    setBeams((prev) => [
      ...prev,
      { id: beamId, fromX: kiteX, fromY: kiteY, toX: closestEnemy.x, toY: closestEnemy.y, startTime: now },
    ]);
    setTimeout(() => setBeams((prev) => prev.filter((b) => b.id !== beamId)), 500);

    // Explosion effect
    const explId = uuid();
    setExplosions((prev) => [
      ...prev,
      { id: explId, x: closestEnemy.x, y: closestEnemy.y, startTime: now },
    ]);
    setTimeout(() => setExplosions((prev) => prev.filter((e) => e.id !== explId)), 500);

    // Flash + haptic
    setFlash('gold');
    setTimeout(() => setFlash(null), 300);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    strokeRef.current = [];
    setDrawingTrail([]);
  }, [kiteX, kiteY]);

  // ─── PanResponder ──────────────────────────────────────────────────

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        if (gameOverRef.current) return;
        const { pageX, pageY } = e.nativeEvent;
        const t = performance.now();
        isDrawingRef.current = true;
        strokeRef.current = [{ x: pageX, y: pageY, t }];
        setDrawingTrail([{ x: pageX, y: pageY, t }]);
      },
      onPanResponderMove: (e) => {
        if (gameOverRef.current || !isDrawingRef.current) return;
        const { pageX, pageY } = e.nativeEvent;
        const t = performance.now();
        strokeRef.current.push({ x: pageX, y: pageY, t });
        setDrawingTrail([...strokeRef.current]);
      },
      onPanResponderRelease: () => {
        if (!isDrawingRef.current) return;
        isDrawingRef.current = false;
        handleStrokeEnd();
      },
      onPanResponderTerminate: () => {
        if (!isDrawingRef.current) return;
        isDrawingRef.current = false;
        handleStrokeEnd();
      },
    }),
  ).current;

  // ─── Game loop ─────────────────────────────────────────────────────

  useEffect(() => {
    startGame('sky_sigils');
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

      // Timer expired
      if (remaining <= 0) {
        finishGame();
        return;
      }

      setTimeLeft(remaining);

      // Get current difficulty
      const diff = getDifficulty(elapsed);

      // Spawn enemies
      if (now - lastSpawnRef.current >= diff.spawnInterval) {
        spawnEnemy(elapsed);
        lastSpawnRef.current = now;
      }

      // Move enemies & check collisions
      let lostLife = false;
      for (const enemy of enemiesRef.current) {
        if (enemy.destroyed || enemy.collided) continue;

        enemy.x += enemy.dx * enemy.speed * dt;
        enemy.y += enemy.dy * enemy.speed * dt;

        // Check collision with kite
        const dist = Math.sqrt((enemy.x - kiteX) ** 2 + (enemy.y - kiteY) ** 2);
        if (dist < ENEMY_COLLISION_RADIUS + KITE_RADIUS) {
          enemy.collided = true;
          livesRef.current -= 1;
          lostLife = true;

          eventsRef.current.push({
            type: 'collision',
            enemyId: enemy.id,
            symbol: enemy.symbol,
            timestamp: now,
            livesRemaining: livesRef.current,
          });

          setFlash('red');
          setTimeout(() => setFlash(null), 300);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

          if (livesRef.current <= 0) {
            setLives(0);
            finishGame();
            return;
          }
        }
      }

      if (lostLife) {
        setLives(livesRef.current);
      }

      // Clean up off-screen enemies (way past edges)
      enemiesRef.current = enemiesRef.current.filter((e) => {
        if (e.destroyed || e.collided) return false;
        if (e.x < -200 || e.x > width + 200 || e.y < -200 || e.y > height + 200) return false;
        return true;
      });

      setEnemies([...enemiesRef.current.filter((e) => !e.destroyed && !e.collided)]);
      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animFrameRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Exit handler ──────────────────────────────────────────────────

  const handleExit = () => {
    if (gameOverRef.current) return;
    gameOverRef.current = true;
    cancelAnimationFrame(animFrameRef.current);
    router.replace('/(game)/hub');
  };

  // ─── End animation ─────────────────────────────────────────────────

  if (showEndAnim) {
    return (
      <View style={styles.container}>
        <View style={styles.endWrap}>
          <Text style={styles.endIcon}>✨</Text>
          {starsEarned && (
            <View style={styles.starBadge}>
              <View style={[styles.starInner, { backgroundColor: Colors.softPurple }]} />
            </View>
          )}
        </View>
      </View>
    );
  }

  // ─── Main game ─────────────────────────────────────────────────────

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      <View style={styles.skyGradient} />

      {/* Timer bar */}
      <View style={styles.timerBg}>
        <View style={[styles.timerBar, { width: `${(timeLeft / GAME_DURATION_MS) * 100}%` }]} />
      </View>

      {/* Exit button */}
      <TouchableOpacity style={styles.exitBtn} onPress={handleExit} activeOpacity={0.7}>
        <Text style={styles.exitBtnText}>✕</Text>
      </TouchableOpacity>

      {/* Lives (suns) */}
      <View style={styles.livesRow}>
        {Array.from({ length: INITIAL_LIVES }).map((_, i) => (
          <Text
            key={`life-${i}`}
            style={[styles.lifeIcon, i >= lives && styles.lifeIconLost]}
          >
            ☀️
          </Text>
        ))}
      </View>

      {/* Flash overlay */}
      {flash && (
        <View
          style={[
            styles.flash,
            {
              backgroundColor:
                flash === 'gold'
                  ? 'rgba(255,215,0,0.2)'
                  : 'rgba(239,68,68,0.2)',
            },
          ]}
        />
      )}

      {/* Enemies */}
      {enemies.map((enemy) => (
        <View
          key={enemy.id}
          style={[
            styles.enemy,
            {
              left: enemy.x - ENEMY_SIZE / 2,
              top: enemy.y - ENEMY_SIZE / 2,
            },
          ]}
        >
          <View style={styles.enemyBody} />
          <View style={styles.enemySymbol}>
            <SymbolIcon symbol={enemy.symbol} />
          </View>
        </View>
      ))}

      {/* Kite (Breeze) at center */}
      <View
        style={[
          styles.kite,
          { left: kiteX - 30, top: kiteY - 35 },
        ]}
      >
        <View style={styles.kiteDiamond} />
        <View style={styles.kiteTailLine} />
        <View style={[styles.kiteTailBow, { top: 42, left: 22, backgroundColor: Colors.grassGreen }]} />
        <View style={[styles.kiteTailBow, { top: 54, left: 32, backgroundColor: Colors.goldenYellow }]} />
      </View>

      {/* Light beams */}
      {beams.map((beam) => {
        const dx = beam.toX - beam.fromX;
        const dy = beam.toY - beam.fromY;
        const length = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);
        return (
          <View
            key={beam.id}
            style={[
              styles.lightBeam,
              {
                left: beam.fromX,
                top: beam.fromY - 1,
                width: length,
                transform: [{ rotate: `${angle}deg` }],
                transformOrigin: 'left center',
              },
            ]}
          />
        );
      })}

      {/* Explosions */}
      {explosions.map((expl) => (
        <Text
          key={expl.id}
          style={[styles.explosion, { left: expl.x - 20, top: expl.y - 20 }]}
        >
          💥
        </Text>
      ))}

      {/* Drawing trail */}
      {drawingTrail.map((p, i) => {
        if (i === 0) return null;
        const prev = drawingTrail[i - 1];
        const dx = p.x - prev.x;
        const dy = p.y - prev.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        if (length < 1) return null;
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);
        return (
          <View
            key={`trail-${i}`}
            style={[
              styles.trailLine,
              {
                left: prev.x,
                top: prev.y - 2,
                width: length,
                transform: [{ rotate: `${angle}deg` }],
                transformOrigin: 'left center',
              },
            ]}
          />
        );
      })}
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
  timerBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 6,
    backgroundColor: 'rgba(0,0,0,0.08)',
    zIndex: 20,
  },
  timerBar: {
    height: 6,
    backgroundColor: Colors.softPurple,
  },
  exitBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 30,
  },
  exitBtnText: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.white,
  },
  livesRow: {
    position: 'absolute',
    top: 16,
    left: 20,
    flexDirection: 'row',
    gap: 8,
    zIndex: 20,
  },
  lifeIcon: {
    fontSize: 28,
  },
  lifeIconLost: {
    opacity: 0.3,
  },
  flash: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 15,
  },
  enemy: {
    position: 'absolute',
    width: ENEMY_SIZE,
    height: ENEMY_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  enemyBody: {
    width: ENEMY_SIZE,
    height: ENEMY_SIZE * 0.65,
    borderRadius: ENEMY_SIZE * 0.32,
    backgroundColor: Colors.stormGrey,
    position: 'absolute',
    bottom: 0,
  },
  enemySymbol: {
    position: 'absolute',
    top: -2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kite: {
    position: 'absolute',
    width: 60,
    height: 70,
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
  lightBeam: {
    position: 'absolute',
    height: 3,
    backgroundColor: Colors.goldenYellow,
    opacity: 0.8,
    zIndex: 12,
  },
  explosion: {
    position: 'absolute',
    fontSize: 40,
    zIndex: 14,
  },
  trailLine: {
    position: 'absolute',
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.goldenYellow,
    shadowColor: Colors.goldenYellow,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 8,
  },
  endWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.skyBlue,
  },
  endIcon: {
    fontSize: 100,
    marginBottom: 20,
  },
  starBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(179,157,219,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  starInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
});
