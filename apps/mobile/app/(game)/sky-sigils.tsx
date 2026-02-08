import 'react-native-get-random-values';
import { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  PanResponder,
  useWindowDimensions,
} from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { Colors } from '../../src/constants/colors';
import { useSessionStore } from '../../src/stores/session-store';

const GAME_DURATION_MS = 150_000;
const HIT_RADIUS = 26;
const COMPLETION_THRESHOLD = 0.70;
const INITIAL_SCALE = 0.78;
const MIN_SCALE = 0.45;
const SHRINK_STEP = 0.045;

interface Pt { x: number; y: number }
interface TPt extends Pt { t: number; inBounds: boolean }

interface SymbolDef {
  name: string;
  emoji: string;
  path: Pt[];
  difficulty: number;
}

interface SymbolEvent {
  type: 'symbol_trace';
  symbolIndex: number;
  symbolName: string;
  difficulty: number;
  canvasScale: number;
  strokes: TPt[][];
  templateTotal: number;
  templateHit: number;
  completionRate: number;
  boundaryViolations: number;
  meanDeviationPx: number;
  initiationLatencyMs: number;
  totalDurationMs: number;
  correctiveStrokes: number;
  timestamp: number;
}

// ─── Symbol helpers ───────────────────────────────────────────────────

function linePts(a: Pt, b: Pt, n: number): Pt[] {
  const r: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    r.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  }
  return r;
}

function polyPts(verts: Pt[], n: number, closed: boolean): Pt[] {
  const r: Pt[] = [];
  const edges = closed ? verts.length : verts.length - 1;
  for (let i = 0; i < edges; i++) {
    const s = linePts(verts[i], verts[(i + 1) % verts.length], n);
    r.push(...(i === 0 ? s : s.slice(1)));
  }
  return r;
}

function circlePts(n: number): Pt[] {
  const r: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    r.push({ x: 0.5 + 0.38 * Math.cos(a), y: 0.5 + 0.38 * Math.sin(a) });
  }
  return r;
}

function starPts(): Pt[] {
  const v: Pt[] = [];
  for (let i = 0; i <= 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const rad = i % 2 === 0 ? 0.4 : 0.17;
    v.push({ x: 0.5 + rad * Math.cos(a), y: 0.5 + rad * Math.sin(a) });
  }
  return polyPts(v, 4, false);
}

function moonPts(): Pt[] {
  const r: Pt[] = [];
  for (let i = 0; i <= 20; i++) {
    const a = (i / 20) * Math.PI * 1.5 + Math.PI * 0.25;
    r.push({ x: 0.48 + 0.38 * Math.cos(a), y: 0.5 + 0.38 * Math.sin(a) });
  }
  for (let i = 20; i >= 0; i--) {
    const a = (i / 20) * Math.PI * 1.1 + Math.PI * 0.45;
    r.push({ x: 0.55 + 0.22 * Math.cos(a), y: 0.5 + 0.22 * Math.sin(a) });
  }
  return r;
}

// ─── Symbols (ordered by difficulty) ──────────────────────────────────

const SYMBOLS: SymbolDef[] = [
  { name: 'line', emoji: '〰️', difficulty: 1,
    path: linePts({ x: 0.12, y: 0.5 }, { x: 0.88, y: 0.5 }, 20) },
  { name: 'circle', emoji: '⭕', difficulty: 1,
    path: circlePts(28) },
  { name: 'square', emoji: '⬜', difficulty: 2,
    path: polyPts([{x:0.18,y:0.18},{x:0.82,y:0.18},{x:0.82,y:0.82},{x:0.18,y:0.82}], 8, true) },
  { name: 'triangle', emoji: '🔺', difficulty: 2,
    path: polyPts([{x:0.5,y:0.1},{x:0.9,y:0.85},{x:0.1,y:0.85}], 10, true) },
  { name: 'cross', emoji: '✚', difficulty: 3,
    path: [...linePts({x:0.15,y:0.5},{x:0.85,y:0.5},14), ...linePts({x:0.5,y:0.15},{x:0.5,y:0.85},14)] },
  { name: 'zigzag', emoji: '⚡', difficulty: 3,
    path: polyPts([{x:0.15,y:0.12},{x:0.65,y:0.35},{x:0.25,y:0.58},{x:0.75,y:0.75},{x:0.85,y:0.88}], 8, false) },
  { name: 'star', emoji: '⭐', difficulty: 4,
    path: starPts() },
  { name: 'moon', emoji: '🌙', difficulty: 4,
    path: moonPts() },
];

// ─── Component ────────────────────────────────────────────────────────

export default function SkySigilsScreen(): React.JSX.Element {
  const { width, height } = useWindowDimensions();

  const recordEvents = useSessionStore((s) => s.recordEvents);
  const startGame = useSessionStore((s) => s.startGame);
  const endGame = useSessionStore((s) => s.endGame);

  const eventsRef = useRef<SymbolEvent[]>([]);
  const gameStartRef = useRef(0);
  const symbolShownRef = useRef(0);
  const firstTouchRef = useRef(0);
  const gameOverRef = useRef(false);

  // Mutable state for PanResponder
  const symbolIdxRef = useRef(0);
  const scaleRef = useRef(INITIAL_SCALE);
  const hitRef = useRef<Set<number>>(new Set());
  const strokesRef = useRef<TPt[][]>([]);
  const curStrokeRef = useRef<TPt[]>([]);
  const violRef = useRef(0);
  const devSumRef = useRef(0);
  const devCountRef = useRef(0);
  const completedRef = useRef(false);

  // Display state
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION_MS);
  const [, setTick] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [showEndAnim, setShowEndAnim] = useState(false);

  const rerender = useCallback(() => setTick((t) => t + 1), []);

  // Compute scaled path from current refs
  const idx = symbolIdxRef.current;
  const scale = scaleRef.current;
  const sym = SYMBOLS[idx % SYMBOLS.length];
  const cSize = Math.min(width * 0.85, height * 0.5) * scale;
  const cLeft = (width - cSize) / 2;
  const cTop = height * 0.2;
  const scaledPath = sym.path.map((p) => ({
    x: cLeft + p.x * cSize,
    y: cTop + p.y * cSize,
  }));
  const scaledPathRef = useRef(scaledPath);
  scaledPathRef.current = scaledPath;

  // ─── Init ──────────────────────────────────────────────────────────

  useEffect(() => {
    startGame('sky_sigils');
    gameStartRef.current = performance.now();
    symbolShownRef.current = performance.now();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Timer ─────────────────────────────────────────────────────────

  useEffect(() => {
    const interval = setInterval(() => {
      if (gameOverRef.current) { clearInterval(interval); return; }
      const remaining = GAME_DURATION_MS - (performance.now() - gameStartRef.current);
      if (remaining <= 0) {
        gameOverRef.current = true;
        clearInterval(interval);
        recordEvents('sky_sigils', eventsRef.current);
        endGame('sky_sigils');
        setShowEndAnim(true);
        setTimeout(() => router.replace('/(game)/transition'), 3000);
      }
      setTimeLeft(Math.max(0, remaining));
    }, 200);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Process a touch point ─────────────────────────────────────────

  const processPoint = useCallback((px: number, py: number): boolean => {
    const path = scaledPathRef.current;
    if (path.length === 0 || completedRef.current) return false;

    let minDist = Infinity;
    let closestIdx = 0;
    for (let i = 0; i < path.length; i++) {
      const dx = px - path[i].x;
      const dy = py - path[i].y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < minDist) { minDist = d; closestIdx = i; }
    }

    devSumRef.current += minDist;
    devCountRef.current += 1;

    const inBounds = minDist <= HIT_RADIUS;

    if (inBounds) {
      // Mark this + nearby template points as hit
      for (let j = Math.max(0, closestIdx - 2); j <= Math.min(path.length - 1, closestIdx + 2); j++) {
        const dx = px - path[j].x;
        const dy = py - path[j].y;
        if (Math.sqrt(dx * dx + dy * dy) <= HIT_RADIUS * 1.4) {
          hitRef.current.add(j);
        }
      }
    } else {
      violRef.current += 1;
    }

    // Check completion
    const rate = hitRef.current.size / path.length;
    if (rate >= COMPLETION_THRESHOLD) {
      completedRef.current = true;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      const now = performance.now();
      const allStrokes = [...strokesRef.current];
      if (curStrokeRef.current.length > 0) {
        allStrokes.push([...curStrokeRef.current]);
      }

      const sIdx = symbolIdxRef.current;
      const sDef = SYMBOLS[sIdx % SYMBOLS.length];

      eventsRef.current.push({
        type: 'symbol_trace',
        symbolIndex: sIdx,
        symbolName: sDef.name,
        difficulty: sDef.difficulty,
        canvasScale: scaleRef.current,
        strokes: allStrokes,
        templateTotal: path.length,
        templateHit: hitRef.current.size,
        completionRate: rate,
        boundaryViolations: violRef.current,
        meanDeviationPx: devCountRef.current > 0 ? devSumRef.current / devCountRef.current : 0,
        initiationLatencyMs: firstTouchRef.current > 0 ? firstTouchRef.current - symbolShownRef.current : 0,
        totalDurationMs: now - symbolShownRef.current,
        correctiveStrokes: Math.max(0, allStrokes.length - 1),
        timestamp: now,
      });

      setFeedback('✨');
      setTimeout(() => {
        if (gameOverRef.current) return;
        setFeedback(null);
        // Reset for next symbol
        hitRef.current = new Set();
        strokesRef.current = [];
        curStrokeRef.current = [];
        violRef.current = 0;
        devSumRef.current = 0;
        devCountRef.current = 0;
        firstTouchRef.current = 0;
        completedRef.current = false;
        symbolIdxRef.current += 1;
        scaleRef.current = Math.max(MIN_SCALE, scaleRef.current - SHRINK_STEP);
        symbolShownRef.current = performance.now();
        rerender();
      }, 1200);
    }

    return inBounds;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── PanResponder ──────────────────────────────────────────────────

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        if (gameOverRef.current || completedRef.current) return;
        const { pageX, pageY } = e.nativeEvent;
        const t = performance.now();
        if (firstTouchRef.current === 0) firstTouchRef.current = t;
        const inBounds = processPoint(pageX, pageY);
        curStrokeRef.current = [{ x: pageX, y: pageY, t, inBounds }];
        rerender();
      },
      onPanResponderMove: (e) => {
        if (gameOverRef.current || completedRef.current) return;
        const { pageX, pageY } = e.nativeEvent;
        const inBounds = processPoint(pageX, pageY);
        curStrokeRef.current.push({ x: pageX, y: pageY, t: performance.now(), inBounds });
        rerender();
      },
      onPanResponderRelease: () => {
        if (curStrokeRef.current.length > 0) {
          strokesRef.current.push([...curStrokeRef.current]);
        }
        curStrokeRef.current = [];
        rerender();
      },
    })
  ).current;

  // ─── End animation ─────────────────────────────────────────────────

  if (showEndAnim) {
    return (
      <View style={styles.container}>
        <View style={styles.endWrap}>
          <Text style={styles.endIcon}>✨</Text>
          <View style={styles.starBadge}>
            <View style={[styles.starInner, { backgroundColor: Colors.softPurple }]} />
          </View>
        </View>
      </View>
    );
  }

  // ─── Main game ─────────────────────────────────────────────────────

  const hitSet = hitRef.current;
  const completedStrokes = strokesRef.current;
  const activeStroke = curStrokeRef.current;

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      {/* Timer */}
      <View style={styles.timerBg}>
        <View style={[styles.timerBar, { width: `${(timeLeft / GAME_DURATION_MS) * 100}%` }]} />
      </View>

      {/* Symbol label */}
      <View style={styles.labelWrap}>
        <Text style={styles.labelEmoji}>{sym.emoji}</Text>
      </View>

      {/* Cloud container background */}
      <View style={[styles.cloudBg, {
        left: cLeft - 16,
        top: cTop - 16,
        width: cSize + 32,
        height: cSize + 32,
        borderRadius: (cSize + 32) * 0.12,
      }]} />

      {/* Template dots */}
      {scaledPath.map((p, i) => {
        const isHit = hitSet.has(i);
        if (!isHit && i % 2 !== 0) return null;
        const isStart = i === 0;
        return (
          <View
            key={`t-${i}`}
            style={[
              styles.templateDot,
              isHit && styles.templateDotHit,
              isStart && styles.startDot,
              { left: p.x - (isStart ? 7 : 4), top: p.y - (isStart ? 7 : 4) },
            ]}
          />
        );
      })}

      {/* Completed strokes */}
      {completedStrokes.map((stroke, si) =>
        stroke.filter((_, i) => i % 3 === 0).map((p, pi) => (
          <View
            key={`s-${si}-${pi}`}
            style={[
              styles.strokeDot,
              !p.inBounds && styles.strokeDotFaded,
              { left: p.x - 5, top: p.y - 5 },
            ]}
          />
        ))
      )}

      {/* Active stroke */}
      {activeStroke.filter((_, i) => i % 2 === 0).map((p, i) => (
        <View
          key={`a-${i}`}
          style={[
            styles.strokeDot,
            !p.inBounds && styles.strokeDotFaded,
            { left: p.x - 5, top: p.y - 5 },
          ]}
        />
      ))}

      {/* Feedback */}
      {feedback && (
        <View style={styles.feedbackWrap}>
          <Text style={styles.feedbackText}>{feedback}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.skyBlueLight,
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
    backgroundColor: Colors.softPurple,
  },
  labelWrap: {
    position: 'absolute',
    top: 20,
    alignSelf: 'center',
    zIndex: 10,
  },
  labelEmoji: {
    fontSize: 36,
  },
  cloudBg: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  templateDot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  templateDotHit: {
    backgroundColor: Colors.grassGreen,
    opacity: 0.85,
  },
  startDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.grassGreen,
  },
  strokeDot: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.sunsetOrange,
    opacity: 0.85,
  },
  strokeDotFaded: {
    opacity: 0.2,
  },
  feedbackWrap: {
    position: 'absolute',
    top: '45%',
    alignSelf: 'center',
    zIndex: 20,
  },
  feedbackText: {
    fontSize: 64,
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
