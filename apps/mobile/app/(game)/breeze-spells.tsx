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

import { useSessionStore } from '../../src/stores/session-store';
import { Colors } from '../../src/constants/colors';
import { recognizeGesture, type GestureSymbol } from '../../src/utils/gesture-recognizer';

// ─── Constants ────────────────────────────────────────────────────────

const MAX_LIVES = 3;
const KITE_WIDTH = 60;
const KITE_HEIGHT = 70;
const WISP_SIZE = 55;
const TRAIL_LINE_WIDTH = 5;
const TRAIL_MAX_POINTS = 60;

// Symbol display characters
const SYMBOL_ICONS: Record<GestureSymbol, string> = {
  horizontal: '━',
  vertical: '┃',
  v_shape: '∨',
  circle: '○',
};

// Difficulty phases (based on wisps cleared, not time)
interface Phase {
  minCleared: number;
  travelTimeMs: number;
  spawnIntervalMs: number;
  symbols: GestureSymbol[];
  multiSymbolChance: number;
  tripleSymbolChance: number;
}

const PHASES: Phase[] = [
  { minCleared: 0,  travelTimeMs: 6000, spawnIntervalMs: 4000, symbols: ['horizontal', 'vertical'],                         multiSymbolChance: 0.3,  tripleSymbolChance: 0 },
  { minCleared: 4,  travelTimeMs: 5000, spawnIntervalMs: 3500, symbols: ['horizontal', 'vertical', 'v_shape'],               multiSymbolChance: 0.4,  tripleSymbolChance: 0.05 },
  { minCleared: 8,  travelTimeMs: 4200, spawnIntervalMs: 3000, symbols: ['horizontal', 'vertical', 'v_shape'],               multiSymbolChance: 0.5,  tripleSymbolChance: 0.15 },
  { minCleared: 14, travelTimeMs: 3500, spawnIntervalMs: 2600, symbols: ['horizontal', 'vertical', 'v_shape', 'circle'],     multiSymbolChance: 0.6,  tripleSymbolChance: 0.25 },
  { minCleared: 20, travelTimeMs: 3000, spawnIntervalMs: 2200, symbols: ['horizontal', 'vertical', 'v_shape', 'circle'],     multiSymbolChance: 0.7,  tripleSymbolChance: 0.35 },
  { minCleared: 28, travelTimeMs: 2600, spawnIntervalMs: 1900, symbols: ['horizontal', 'vertical', 'v_shape', 'circle'],     multiSymbolChance: 0.8,  tripleSymbolChance: 0.45 },
  { minCleared: 36, travelTimeMs: 2200, spawnIntervalMs: 1600, symbols: ['horizontal', 'vertical', 'v_shape', 'circle'],     multiSymbolChance: 0.85, tripleSymbolChance: 0.55 },
  { minCleared: 45, travelTimeMs: 1900, spawnIntervalMs: 1400, symbols: ['horizontal', 'vertical', 'v_shape', 'circle'],     multiSymbolChance: 0.9,  tripleSymbolChance: 0.65 },
];

// ─── Types ──────────────────────────────────────────────────────────

interface Wisp {
  id: string;
  symbols: GestureSymbol[];
  symbolsRemaining: GestureSymbol[];
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  startX: number;
  startY: number;
  spawnTimestamp: number;
  travelTimeMs: number;
  spawnEdge: 'left' | 'right' | 'top';
  alive: boolean;
  dissolved: boolean;
  dissolveTimestamp: number;
}

interface TrailPoint {
  x: number;
  y: number;
  timestamp: number;
}

interface SparkleParticle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

// Event types for data collection
interface WispEvent {
  type: 'wisp';
  wispId: string;
  symbol: string;
  spawnTimestamp: number;
  spawnEdge: 'left' | 'right' | 'top';
  speed: number;
}

interface GestureEvent {
  type: 'gesture';
  timestamp: number;
  targetWispId: string | null;
  targetSymbol: string;
  recognizedSymbol: string | null;
  correct: boolean;
  reactionTimeMs: number;
  gestureAccuracy: number;
  gestureDurationMs: number;
}

interface WispReachedEvent {
  type: 'wisp_reached';
  wispId: string;
  symbol: string;
  timeOnScreen: number;
}

type GameEvent = WispEvent | GestureEvent | WispReachedEvent;

// ─── Helpers ────────────────────────────────────────────────────────

function getPhase(cleared: number): Phase {
  for (let i = PHASES.length - 1; i >= 0; i--) {
    if (cleared >= PHASES[i].minCleared) return PHASES[i];
  }
  return PHASES[0];
}

function pickEdge(): 'left' | 'right' | 'top' {
  const edges: ('left' | 'right' | 'top')[] = ['left', 'right', 'top'];
  return edges[Math.floor(Math.random() * edges.length)];
}

function spawnPosition(edge: 'left' | 'right' | 'top', screenW: number, screenH: number): { x: number; y: number } {
  switch (edge) {
    case 'left':  return { x: -WISP_SIZE, y: 80 + Math.random() * (screenH * 0.4) };
    case 'right': return { x: screenW + WISP_SIZE, y: 80 + Math.random() * (screenH * 0.4) };
    case 'top':   return { x: WISP_SIZE + Math.random() * (screenW - WISP_SIZE * 2), y: -WISP_SIZE };
  }
}

const SPARKLE_COLORS = ['#FFD700', '#FFA500', '#FF69B4', '#87CEEB', '#90EE90', '#DDA0DD'];

// ─── Breeze Spells Game ─────────────────────────────────────────────

export default function BreezeSpellsScreen(): React.JSX.Element {
  const { width, height } = useWindowDimensions();
  const kiteX = width / 2;
  const kiteY = height / 2;

  const recordEvents = useSessionStore((s) => s.recordEvents);
  const startGame = useSessionStore((s) => s.startGame);
  const endGame = useSessionStore((s) => s.endGame);

  // Refs for mutable game state
  const wispsRef = useRef<Wisp[]>([]);
  const eventsRef = useRef<GameEvent[]>([]);
  const sparklesRef = useRef<SparkleParticle[]>([]);
  const gameStartRef = useRef(0);
  const lastSpawnRef = useRef(0);
  const animFrameRef = useRef(0);
  const gameOverRef = useRef(false);
  const touchPointsRef = useRef<{ x: number; y: number }[]>([]);
  const touchStartTimeRef = useRef(0);
  const wispsDissipatedRef = useRef(0);
  const wispsReachedRef = useRef(0);
  const livesRef = useRef(MAX_LIVES);

  // Render state
  const [wisps, setWisps] = useState<Wisp[]>([]);
  const [trail, setTrail] = useState<TrailPoint[]>([]);
  const [sparkles, setSparkles] = useState<SparkleParticle[]>([]);
  const [dissipated, setDissipated] = useState(0);
  const [lives, setLives] = useState(MAX_LIVES);
  const [showEndAnim, setShowEndAnim] = useState(false);
  const [starsEarned, setStarsEarned] = useState(false);
  const [spellFlash, setSpellFlash] = useState<{ x: number; y: number } | null>(null);
  const [hitFlash, setHitFlash] = useState(false);

  // Heart animation refs
  const heartScales = useRef(
    Array.from({ length: MAX_LIVES }, () => new Animated.Value(1)),
  ).current;
  const prevLivesRef = useRef(MAX_LIVES);

  // Animate heart loss
  useEffect(() => {
    if (lives < prevLivesRef.current) {
      const lostIndex = lives; // heart at this index just went empty
      setHitFlash(true);
      setTimeout(() => setHitFlash(false), 250);

      Animated.sequence([
        Animated.timing(heartScales[lostIndex], {
          toValue: 1.8,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(heartScales[lostIndex], {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
    prevLivesRef.current = lives;
  }, [lives, heartScales]);

  // ─── Find best matching wisp for a recognized gesture ─────────
  const findTargetWisp = useCallback((symbol: GestureSymbol): Wisp | null => {
    let closest: Wisp | null = null;
    let closestDist = Infinity;

    for (const wisp of wispsRef.current) {
      if (!wisp.alive || wisp.dissolved) continue;
      if (!wisp.symbolsRemaining.includes(symbol)) continue;

      // Pick the wisp closest to Breeze (most urgent)
      const dist = Math.sqrt((wisp.x - kiteX) ** 2 + (wisp.y - kiteY) ** 2);
      if (dist < closestDist) {
        closestDist = dist;
        closest = wisp;
      }
    }
    return closest;
  }, [kiteX, kiteY]);

  // ─── Spawn sparkle burst at position ────────────────────
  const spawnSparkles = useCallback((x: number, y: number) => {
    const particles: SparkleParticle[] = [];
    for (let i = 0; i < 12; i++) {
      const angle = (Math.PI * 2 * i) / 12 + (Math.random() - 0.5) * 0.5;
      const speed = 1.5 + Math.random() * 2;
      particles.push({
        id: uuid(),
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        color: SPARKLE_COLORS[Math.floor(Math.random() * SPARKLE_COLORS.length)],
      });
    }
    sparklesRef.current.push(...particles);
  }, []);

  // ─── Handle gesture completion ───────────────────────
  const handleGestureEnd = useCallback(() => {
    const points = touchPointsRef.current;
    if (points.length < 3) {
      touchPointsRef.current = [];
      setTrail([]);
      return;
    }

    const result = recognizeGesture(points);
    const now = performance.now();
    const gestureDuration = now - touchStartTimeRef.current;

    if (result.symbol) {
      const targetWisp = findTargetWisp(result.symbol);

      if (targetWisp) {
        // Match! Remove the matched symbol from remaining
        const idx = targetWisp.symbolsRemaining.indexOf(result.symbol);
        if (idx !== -1) {
          targetWisp.symbolsRemaining.splice(idx, 1);
        }

        // If all symbols matched, dissolve the wisp
        if (targetWisp.symbolsRemaining.length === 0) {
          targetWisp.dissolved = true;
          targetWisp.dissolveTimestamp = now;
          wispsDissipatedRef.current += 1;
          setDissipated(wispsDissipatedRef.current);
          spawnSparkles(targetWisp.x, targetWisp.y);
          setSpellFlash({ x: targetWisp.x, y: targetWisp.y });
          setTimeout(() => setSpellFlash(null), 300);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } else {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
        }

        eventsRef.current.push({
          type: 'gesture',
          timestamp: now,
          targetWispId: targetWisp.id,
          targetSymbol: result.symbol,
          recognizedSymbol: result.symbol,
          correct: true,
          reactionTimeMs: now - targetWisp.spawnTimestamp,
          gestureAccuracy: result.accuracy,
          gestureDurationMs: gestureDuration,
        });
      } else {
        // Recognized gesture but no matching wisp
        eventsRef.current.push({
          type: 'gesture',
          timestamp: now,
          targetWispId: null,
          targetSymbol: result.symbol,
          recognizedSymbol: result.symbol,
          correct: false,
          reactionTimeMs: 0,
          gestureAccuracy: result.accuracy,
          gestureDurationMs: gestureDuration,
        });
      }
    } else {
      // Unrecognized gesture
      eventsRef.current.push({
        type: 'gesture',
        timestamp: now,
        targetWispId: null,
        targetSymbol: 'unknown',
        recognizedSymbol: null,
        correct: false,
        reactionTimeMs: 0,
        gestureAccuracy: 0,
        gestureDurationMs: gestureDuration,
      });
    }

    touchPointsRef.current = [];
    setTrail([]);
  }, [findTargetWisp, spawnSparkles]);

  // ─── Pan responder for drawing gestures ────────────
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        const { pageX, pageY } = e.nativeEvent;
        touchPointsRef.current = [{ x: pageX, y: pageY }];
        touchStartTimeRef.current = performance.now();
        setTrail([{ x: pageX, y: pageY, timestamp: performance.now() }]);
      },
      onPanResponderMove: (e) => {
        const { pageX, pageY } = e.nativeEvent;
        touchPointsRef.current.push({ x: pageX, y: pageY });
        setTrail((prev) => {
          const next = [...prev, { x: pageX, y: pageY, timestamp: performance.now() }];
          return next.length > TRAIL_MAX_POINTS ? next.slice(-TRAIL_MAX_POINTS) : next;
        });
      },
      onPanResponderRelease: () => {
        handleGestureEnd();
      },
      onPanResponderTerminate: () => {
        touchPointsRef.current = [];
        setTrail([]);
      },
    }),
  ).current;

  // ─── Spawn a wisp ──────────────────────────────────
  const spawnWisp = useCallback((phase: Phase) => {
    const edge = pickEdge();
    const pos = spawnPosition(edge, width, height);
    const symbols: GestureSymbol[] = [phase.symbols[Math.floor(Math.random() * phase.symbols.length)]];

    // Multi-symbol wisps — longer sequences
    if (Math.random() < phase.multiSymbolChance) {
      const second = phase.symbols[Math.floor(Math.random() * phase.symbols.length)];
      symbols.push(second);
    }
    if (Math.random() < phase.tripleSymbolChance) {
      const third = phase.symbols[Math.floor(Math.random() * phase.symbols.length)];
      symbols.push(third);
    }

    const wisp: Wisp = {
      id: uuid(),
      symbols,
      symbolsRemaining: [...symbols],
      startX: pos.x,
      startY: pos.y,
      x: pos.x,
      y: pos.y,
      targetX: kiteX + (Math.random() - 0.5) * 100,
      targetY: kiteY,
      spawnTimestamp: performance.now(),
      travelTimeMs: phase.travelTimeMs,
      spawnEdge: edge,
      alive: true,
      dissolved: false,
      dissolveTimestamp: 0,
    };

    wispsRef.current.push(wisp);

    for (const sym of symbols) {
      eventsRef.current.push({
        type: 'wisp',
        wispId: wisp.id,
        symbol: sym,
        spawnTimestamp: wisp.spawnTimestamp,
        spawnEdge: edge,
        speed: phase.travelTimeMs,
      });
    }
  }, [width, height, kiteX, kiteY]);

  // ─── End game ─────────────────────────────────
  const finishGame = useCallback(() => {
    gameOverRef.current = true;
    const now = performance.now();

    // Record remaining wisps as reached
    for (const w of wispsRef.current) {
      if (w.alive && !w.dissolved) {
        eventsRef.current.push({
          type: 'wisp_reached',
          wispId: w.id,
          symbol: w.symbols.join(','),
          timeOnScreen: now - w.spawnTimestamp,
        });
      }
    }

    recordEvents('breeze_spells', eventsRef.current);
    endGame('breeze_spells');
    setShowEndAnim(true);
    setTimeout(() => setStarsEarned(true), 800);
    setTimeout(() => router.replace('/(game)/hub'), 3500);
  }, [recordEvents, endGame]);

  // ─── Exit button ────────────────────────────
  const handleExit = useCallback(() => {
    if (gameOverRef.current) return;
    gameOverRef.current = true;
    cancelAnimationFrame(animFrameRef.current);
    router.replace('/(game)/hub');
  }, []);

  // ─── Game loop ──────────────────────────────────
  useEffect(() => {
    startGame('breeze_spells');
    gameStartRef.current = performance.now();
    lastSpawnRef.current = performance.now();

    const loop = () => {
      if (gameOverRef.current) return;

      const now = performance.now();

      const phase = getPhase(wispsDissipatedRef.current);

      // Spawn wisps
      if (now - lastSpawnRef.current >= phase.spawnIntervalMs) {
        spawnWisp(phase);
        lastSpawnRef.current = now;
      }

      // Update wisp positions
      const alive: Wisp[] = [];
      for (const wisp of wispsRef.current) {
        if (!wisp.alive) continue;

        if (wisp.dissolved) {
          // Keep dissolved wisps briefly for animation
          if (now - wisp.dissolveTimestamp > 500) {
            wisp.alive = false;
            continue;
          }
          alive.push(wisp);
          continue;
        }

        // Lerp position toward target
        const progress = Math.min(1, (now - wisp.spawnTimestamp) / wisp.travelTimeMs);
        wisp.x = wisp.startX + (wisp.targetX - wisp.startX) * progress;
        wisp.y = wisp.startY + (wisp.targetY - wisp.startY) * progress;

        // Wisp reached Breeze — lose a life
        if (progress >= 1) {
          wisp.alive = false;
          wispsReachedRef.current += 1;
          livesRef.current -= 1;
          setLives(livesRef.current);

          eventsRef.current.push({
            type: 'wisp_reached',
            wispId: wisp.id,
            symbol: wisp.symbols.join(','),
            timeOnScreen: now - wisp.spawnTimestamp,
          });

          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

          // Out of lives — game over
          if (livesRef.current <= 0) {
            wispsRef.current = alive;
            finishGame();
            return;
          }
          continue;
        }

        alive.push(wisp);
      }
      wispsRef.current = alive;

      // Update sparkles
      const aliveSparkles: SparkleParticle[] = [];
      for (const p of sparklesRef.current) {
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.025;
        if (p.life > 0) aliveSparkles.push(p);
      }
      sparklesRef.current = aliveSparkles;

      // Push render state
      setWisps([...alive]);
      setSparkles([...aliveSparkles]);

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
        <View style={styles.endSkyGradient} />
        <View style={[styles.sunGlow, { left: width / 2 - 110, top: height * 0.25 - 110 }]} />
        <View style={[styles.sun, { left: width / 2 - 80, top: height * 0.25 - 80 }]} />
        <View style={styles.endScoreWrap}>
          <Text style={styles.endScoreLabel}>Wisps Cleared</Text>
          <Text style={styles.endScoreValue}>{dissipated}</Text>
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
      {/* Mystical sky gradient */}
      <View style={styles.skyGradient} />
      <View style={styles.skyGradientTop} />

      {/* Decorative clouds */}
      <View style={[styles.bgCloud, { left: width * 0.08, top: 40, width: 100, height: 35 }]} />
      <View style={[styles.bgCloud, { left: width * 0.7, top: 60, width: 130, height: 45 }]} />

      {/* HUD */}
      <View style={styles.hud}>
        <TouchableOpacity style={styles.exitBtn} onPress={handleExit} activeOpacity={0.7}>
          <Text style={styles.exitBtnText}>{'\u2715'}</Text>
        </TouchableOpacity>
        <View style={styles.hudItem}>
          <Text style={styles.hudLabel}>Cleared</Text>
          <Text style={styles.hudValue}>{dissipated}</Text>
        </View>
        <View style={styles.livesContainer}>
          {Array.from({ length: MAX_LIVES }).map((_, i) => (
            <Animated.Text
              key={i}
              style={[
                styles.heartIcon,
                i < lives ? styles.heartFull : styles.heartEmpty,
                { transform: [{ scale: heartScales[i] }] },
              ]}
            >
              {'\u2764'}
            </Animated.Text>
          ))}
        </View>
      </View>

      {/* Drawing trail - solid line */}
      {trail.length > 1 && trail.map((point, i) => {
        if (i === 0) return null;
        const prev = trail[i - 1];
        const dx = point.x - prev.x;
        const dy = point.y - prev.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len < 1) return null;
        const angle = Math.atan2(dy, dx);
        const age = (performance.now() - point.timestamp) / 500;
        const opacity = Math.max(0, 1 - age);
        const midX = (prev.x + point.x) / 2;
        const midY = (prev.y + point.y) / 2;
        return (
          <View
            key={i}
            style={[
              styles.trailSegment,
              {
                left: midX - len / 2,
                top: midY - TRAIL_LINE_WIDTH / 2,
                width: len,
                opacity,
                transform: [{ rotate: `${angle}rad` }],
              },
            ]}
          />
        );
      })}

      {/* Hit flash overlay */}
      {hitFlash && <View style={styles.hitFlashOverlay} />}

      {/* Spell flash effect */}
      {spellFlash && (
        <View style={[styles.spellFlash, { left: spellFlash.x - 40, top: spellFlash.y - 40 }]} />
      )}

      {/* Sparkle particles */}
      {sparkles.map((p) => (
        <View
          key={p.id}
          style={[
            styles.sparkle,
            {
              left: p.x - 4,
              top: p.y - 4,
              opacity: p.life,
              backgroundColor: p.color,
              transform: [{ scale: p.life }],
            },
          ]}
        />
      ))}

      {/* Wisps */}
      {wisps.map((wisp) => {
        if (wisp.dissolved) {
          // Dissolving wisp — fading out
          const dissolveAge = (performance.now() - wisp.dissolveTimestamp) / 500;
          return (
            <View
              key={wisp.id}
              style={[
                styles.wisp,
                {
                  left: wisp.x - WISP_SIZE / 2,
                  top: wisp.y - WISP_SIZE / 2,
                  opacity: Math.max(0, 1 - dissolveAge),
                  transform: [{ scale: 1 + dissolveAge * 0.5 }],
                },
              ]}
            />
          );
        }

        return (
          <View key={wisp.id}>
            {/* Wisp body */}
            <View
              style={[
                styles.wisp,
                {
                  left: wisp.x - WISP_SIZE / 2,
                  top: wisp.y - WISP_SIZE / 2,
                },
              ]}
            >
              <View style={styles.wispInner} />
            </View>
            {/* Symbol label above wisp */}
            <View
              style={[
                styles.symbolContainer,
                {
                  left: wisp.x - 30,
                  top: wisp.y - WISP_SIZE / 2 - 30,
                },
              ]}
            >
              {wisp.symbolsRemaining.map((sym, i) => (
                <Text key={i} style={styles.symbolText}>{SYMBOL_ICONS[sym]}</Text>
              ))}
            </View>
          </View>
        );
      })}

      {/* Breeze kite at bottom center */}
      <View style={[styles.kite, { left: kiteX - KITE_WIDTH / 2, top: kiteY - KITE_HEIGHT / 2 }]}>
        <View style={styles.kiteDiamond} />
        <View style={styles.kiteTailLine} />
        <View style={[styles.kiteTailBow, { top: 42, left: 22, backgroundColor: Colors.grassGreen }]} />
        <View style={[styles.kiteTailBow, { top: 54, left: 32, backgroundColor: Colors.goldenYellow }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#6B8CC7',
  },
  skyGradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#87CEEB',
  },
  skyGradientTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '40%',
    backgroundColor: 'rgba(120, 100, 180, 0.3)',
  },
  endSkyGradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#A8D8EA',
  },
  bgCloud: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
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
  livesContainer: {
    flexDirection: 'row',
    gap: 6,
    marginLeft: 'auto',
  },
  heartIcon: {
    fontSize: 26,
  },
  heartFull: {
    color: '#FF4D6D',
  },
  heartEmpty: {
    color: 'rgba(255,255,255,0.3)',
  },
  // Trail
  trailSegment: {
    position: 'absolute',
    height: TRAIL_LINE_WIDTH,
    borderRadius: TRAIL_LINE_WIDTH / 2,
    backgroundColor: '#FFD700',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    zIndex: 15,
  },
  // Hit flash
  hitFlashOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 60, 60, 0.25)',
    zIndex: 18,
  },
  // Spell flash
  spellFlash: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 215, 0, 0.3)',
    zIndex: 14,
  },
  // Sparkles
  sparkle: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    zIndex: 16,
  },
  // Wisps
  wisp: {
    position: 'absolute',
    width: WISP_SIZE,
    height: WISP_SIZE,
    borderRadius: WISP_SIZE / 2,
    backgroundColor: 'rgba(130, 120, 160, 0.6)',
    shadowColor: '#8878A0',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 3,
    zIndex: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  wispInner: {
    width: WISP_SIZE * 0.5,
    height: WISP_SIZE * 0.5,
    borderRadius: WISP_SIZE * 0.25,
    backgroundColor: 'rgba(180, 170, 210, 0.5)',
  },
  symbolContainer: {
    position: 'absolute',
    width: 60,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
    zIndex: 6,
  },
  symbolText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    textShadowColor: 'rgba(255,255,255,0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
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
  // End screen
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
