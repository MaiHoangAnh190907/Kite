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
const TOTAL_PATHS = 6;

interface PathPoint {
  x: number;
  y: number;
}

// ─── Path specs per games.md ──────────────────────────────────────────
// Path widths: wide=44pt, medium=33pt, narrow=22pt
const PATH_WIDTHS = [44, 44, 33, 33, 22, 22];

interface TraceFrameEvent {
  type: 'trace';
  pathIndex: number;
  timestamp: number;
  fingerPosition: { x: number; y: number };
  idealPosition: { x: number; y: number };
  deviation: number;
  pressure: number | null;
  speed: number;
}

interface PathCompleteEvent {
  type: 'path_complete';
  pathIndex: number;
  duration: number;
  meanDeviation: number;
  maxDeviation: number;
  completionPercent: number;
  smoothnessScore: number;
}

type GameEvent = TraceFrameEvent | PathCompleteEvent;

// ─── Generate predefined paths per spec ───────────────────────────────
// 1: gentle S-curve, 2: tighter S-curve, 3: loop+curve, 4: zigzag
// 5: spiral inward, 6: complex (all elements)
function generatePath(w: number, h: number, pathIdx: number): PathPoint[] {
  const points: PathPoint[] = [];
  const margin = 80;
  const usableW = w - margin * 2;
  const usableH = h * 0.65;
  const startY = h * 0.12;
  const numPoints = 30;

  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints;
    let x: number;
    let y: number;

    switch (pathIdx) {
      case 0: // Gentle S-curve
        x = margin + t * usableW;
        y = startY + usableH * 0.5 + Math.sin(t * Math.PI * 2) * usableH * 0.2;
        break;
      case 1: // Tighter S-curve, longer
        x = margin + t * usableW;
        y = startY + usableH * 0.5 + Math.sin(t * Math.PI * 3) * usableH * 0.25;
        break;
      case 2: // Loop + curve
        x = margin + t * usableW;
        y = startY + usableH * 0.5 + Math.sin(t * Math.PI * 2) * usableH * 0.3 +
            Math.sin(t * Math.PI * 6) * usableH * 0.1;
        break;
      case 3: // Zigzag
        x = margin + t * usableW;
        y = startY + usableH * 0.5 + ((Math.floor(t * 8) % 2 === 0) ? -1 : 1) * usableH * 0.25 *
            (1 - 2 * Math.abs(t * 8 - Math.floor(t * 8) - 0.5));
        break;
      case 4: // Spiral inward
        {
          const angle = t * Math.PI * 4;
          const radius = usableW * 0.35 * (1 - t * 0.6);
          x = w / 2 + Math.cos(angle) * radius;
          y = startY + usableH * 0.5 + Math.sin(angle) * radius * 0.6;
        }
        break;
      case 5: // Complex: S-curves + loops + zigzag
      default:
        x = margin + t * usableW;
        y = startY + usableH * 0.5 +
            Math.sin(t * Math.PI * 3) * usableH * 0.2 +
            Math.sin(t * Math.PI * 8) * usableH * 0.08 +
            Math.cos(t * Math.PI * 5) * usableH * 0.1;
        break;
    }

    points.push({ x, y });
  }
  return points;
}

// Distance from point to line segment
function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.sqrt((px - ax) ** 2 + (py - ay) ** 2);
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const projX = ax + t * dx;
  const projY = ay + t * dy;
  return Math.sqrt((px - projX) ** 2 + (py - projY) ** 2);
}

function nearestPointOnPath(px: number, py: number, path: PathPoint[]): PathPoint {
  let minDist = Infinity;
  let nearest = path[0];
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const b = path[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    let t = len2 === 0 ? 0 : ((px - a.x) * dx + (py - a.y) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const projX = a.x + t * dx;
    const projY = a.y + t * dy;
    const dist = Math.sqrt((px - projX) ** 2 + (py - projY) ** 2);
    if (dist < minDist) {
      minDist = dist;
      nearest = { x: projX, y: projY };
    }
  }
  return nearest;
}

// Checkpoint positions along path (every ~20%)
function getCheckpoints(path: PathPoint[]): PathPoint[] {
  const checkpoints: PathPoint[] = [];
  const interval = Math.floor(path.length / 5);
  for (let i = interval; i < path.length - interval; i += interval) {
    checkpoints.push(path[i]);
  }
  return checkpoints;
}

export default function WindTrailsScreen(): React.JSX.Element {
  const { width, height } = useWindowDimensions();

  const recordEvents = useSessionStore((s) => s.recordEvents);
  const startGame = useSessionStore((s) => s.startGame);
  const endGame = useSessionStore((s) => s.endGame);

  const eventsRef = useRef<GameEvent[]>([]);
  const frameEventsRef = useRef<TraceFrameEvent[]>([]);
  const gameStartRef = useRef(0);
  const traceStartRef = useRef(0);
  const lastPosRef = useRef<PathPoint | null>(null);
  const lastTimeRef = useRef(0);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION_MS);
  const [pathIdx, setPathIdx] = useState(0);
  const [path, setPath] = useState<PathPoint[]>([]);
  const [tracePoints, setTracePoints] = useState<PathPoint[]>([]);
  const [tracing, setTracing] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [showEndAnim, setShowEndAnim] = useState(false);
  const [reachedCheckpoints, setReachedCheckpoints] = useState<boolean[]>([]);
  const gameOverRef = useRef(false);

  const checkpoints = path.length > 0 ? getCheckpoints(path) : [];
  const pathWidth = PATH_WIDTHS[Math.min(pathIdx, PATH_WIDTHS.length - 1)];

  useEffect(() => {
    startGame('wind_trails');
    gameStartRef.current = performance.now();
    setPath(generatePath(width, height, 0));
    setReachedCheckpoints([]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Timer
  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = performance.now() - gameStartRef.current;
      const remaining = GAME_DURATION_MS - elapsed;
      if (remaining <= 0 && !gameOverRef.current) {
        gameOverRef.current = true;
        clearInterval(interval);
        recordEvents('wind_trails', eventsRef.current);
        endGame('wind_trails');
        setShowEndAnim(true);
        setTimeout(() => router.replace('/(game)/transition'), 3000);
        return;
      }
      setTimeLeft(remaining);
    }, 200);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finishPath = useCallback((trace: PathPoint[]) => {
    if (trace.length < 2 || path.length < 2) return;

    // Calculate metrics
    let totalDev = 0;
    let maxDev = 0;
    let onPathCount = 0;

    for (const p of trace) {
      let minDist = Infinity;
      for (let i = 0; i < path.length - 1; i++) {
        const d = distToSegment(p.x, p.y, path[i].x, path[i].y, path[i + 1].x, path[i + 1].y);
        if (d < minDist) minDist = d;
      }
      totalDev += minDist;
      if (minDist > maxDev) maxDev = minDist;
      if (minDist <= pathWidth) onPathCount++;
    }

    const meanDev = totalDev / trace.length;
    const completionPct = onPathCount / trace.length;
    const duration = performance.now() - traceStartRef.current;

    // Smoothness: calculate jerk approximation
    let jerkSum = 0;
    for (let i = 2; i < trace.length; i++) {
      const ax = trace[i].x - 2 * trace[i - 1].x + trace[i - 2].x;
      const ay = trace[i].y - 2 * trace[i - 1].y + trace[i - 2].y;
      jerkSum += Math.sqrt(ax * ax + ay * ay);
    }
    const smoothness = trace.length > 2 ? jerkSum / (trace.length - 2) : 0;

    eventsRef.current.push({
      type: 'path_complete',
      pathIndex: pathIdx,
      duration,
      meanDeviation: meanDev,
      maxDeviation: maxDev,
      completionPercent: completionPct,
      smoothnessScore: smoothness,
    });

    // Also add frame events
    eventsRef.current.push(...frameEventsRef.current);
    frameEventsRef.current = [];

    const good = completionPct > 0.5;
    if (good) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setFeedback('✨');
    } else {
      setFeedback('💫');
    }

    setTimeout(() => {
      setFeedback(null);
      if (pathIdx + 1 >= TOTAL_PATHS) {
        // All paths done
        if (!gameOverRef.current) {
          gameOverRef.current = true;
          recordEvents('wind_trails', eventsRef.current);
          endGame('wind_trails');
          setShowEndAnim(true);
          setTimeout(() => router.replace('/(game)/transition'), 3000);
        }
        return;
      }
      const nextIdx = pathIdx + 1;
      setPathIdx(nextIdx);
      setPath(generatePath(width, height, nextIdx));
      setTracePoints([]);
      setReachedCheckpoints([]);
    }, 1200);
  }, [pathIdx, path, pathWidth, width, height, recordEvents, endGame]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        if (gameOverRef.current) return;
        setTracing(true);
        traceStartRef.current = performance.now();
        lastTimeRef.current = performance.now();
        const { pageX, pageY } = e.nativeEvent;
        lastPosRef.current = { x: pageX, y: pageY };
        setTracePoints([{ x: pageX, y: pageY }]);
        setReachedCheckpoints([]);
      },
      onPanResponderMove: (e) => {
        if (gameOverRef.current) return;
        const { pageX, pageY } = e.nativeEvent;
        const now = performance.now();
        const dt = now - lastTimeRef.current;
        const speed = lastPosRef.current && dt > 0
          ? Math.sqrt((pageX - lastPosRef.current.x) ** 2 + (pageY - lastPosRef.current.y) ** 2) / dt
          : 0;

        lastPosRef.current = { x: pageX, y: pageY };
        lastTimeRef.current = now;

        setTracePoints((prev) => [...prev, { x: pageX, y: pageY }]);

        // Record frame event (per-frame trace data)
        const ideal = path.length > 0 ? nearestPointOnPath(pageX, pageY, path) : { x: pageX, y: pageY };
        const deviation = Math.sqrt((pageX - ideal.x) ** 2 + (pageY - ideal.y) ** 2);

        frameEventsRef.current.push({
          type: 'trace',
          pathIndex: pathIdx,
          timestamp: now,
          fingerPosition: { x: pageX, y: pageY },
          idealPosition: ideal,
          deviation,
          pressure: null,
          speed,
        });

        // Check checkpoints
        if (checkpoints.length > 0) {
          setReachedCheckpoints((prev) => {
            const next = [...prev];
            checkpoints.forEach((cp, idx) => {
              if (!next[idx]) {
                const dist = Math.sqrt((pageX - cp.x) ** 2 + (pageY - cp.y) ** 2);
                if (dist < 30) {
                  next[idx] = true;
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
              }
            });
            return next;
          });
        }
      },
      onPanResponderRelease: () => {
        if (gameOverRef.current) return;
        setTracing(false);
        setTracePoints((currentTrace) => {
          finishPath(currentTrace);
          return currentTrace;
        });
      },
    })
  ).current;

  if (showEndAnim) {
    return (
      <View style={styles.container}>
        <View style={styles.endWrap}>
          <Text style={styles.endIcon}>🌈</Text>
          <Text style={styles.endText}>✨</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      {/* Timer */}
      <View style={styles.timerBg}>
        <View style={[styles.timerBar, { width: `${(timeLeft / GAME_DURATION_MS) * 100}%` }]} />
      </View>

      {/* Path counter */}
      <View style={styles.pathCounter}>
        {Array.from({ length: TOTAL_PATHS }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.pathDotIndicator,
              i < pathIdx && styles.pathDotComplete,
              i === pathIdx && styles.pathDotCurrent,
            ]}
          />
        ))}
      </View>

      {/* Start circle (green) */}
      {path.length > 0 && (
        <View
          style={[
            styles.startMarker,
            { left: path[0].x - 12, top: path[0].y - 12 },
          ]}
        />
      )}

      {/* End marker (golden star) */}
      {path.length > 0 && (
        <View style={{ position: 'absolute', left: path[path.length - 1].x - 14, top: path[path.length - 1].y - 14 }}>
          <Text style={{ fontSize: 28 }}>⭐</Text>
        </View>
      )}

      {/* Dashed path rendered as spaced dots */}
      {path.map((p, i) => {
        if (i % 2 !== 0) return null; // Dashed effect
        return (
          <View
            key={`path-${i}`}
            style={[
              styles.pathDash,
              {
                left: p.x - 3,
                top: p.y - 3,
                width: 6,
                height: 6,
              },
            ]}
          />
        );
      })}

      {/* Cloud checkpoints */}
      {checkpoints.map((cp, i) => (
        <View key={`cp-${i}`} style={{ position: 'absolute', left: cp.x - 16, top: cp.y - 16 }}>
          <Text style={{ fontSize: reachedCheckpoints[i] ? 32 : 24, opacity: reachedCheckpoints[i] ? 1 : 0.6 }}>
            ☁️
          </Text>
        </View>
      ))}

      {/* Trace trail — golden on-path, light blue off-path */}
      {tracePoints.filter((_, i) => i % 2 === 0).map((p, i) => {
        // Check if on path
        let onPath = false;
        if (path.length > 1) {
          let minDist = Infinity;
          for (let j = 0; j < path.length - 1; j++) {
            const d = distToSegment(p.x, p.y, path[j].x, path[j].y, path[j + 1].x, path[j + 1].y);
            if (d < minDist) minDist = d;
          }
          onPath = minDist <= pathWidth;
        }
        return (
          <View
            key={`trace-${i}`}
            style={[
              styles.traceDot,
              {
                left: p.x - 5,
                top: p.y - 5,
                backgroundColor: onPath ? Colors.goldenYellow : Colors.skyBlueLight,
                shadowColor: onPath ? Colors.goldenYellow : 'transparent',
                shadowOpacity: onPath ? 0.5 : 0,
                shadowRadius: onPath ? 6 : 0,
              },
            ]}
          />
        );
      })}

      {/* Breeze follows finger */}
      {tracing && tracePoints.length > 0 && (
        <View style={{
          position: 'absolute',
          left: tracePoints[tracePoints.length - 1].x - 20,
          top: tracePoints[tracePoints.length - 1].y - 30,
          zIndex: 15,
        }}>
          <Text style={{ fontSize: 32 }}>🪁</Text>
        </View>
      )}

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
    backgroundColor: 'rgba(0,0,0,0.1)',
    zIndex: 10,
  },
  timerBar: {
    height: 6,
    backgroundColor: Colors.grassGreen,
  },
  pathCounter: {
    position: 'absolute',
    top: 20,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 8,
    zIndex: 10,
  },
  pathDotIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  pathDotComplete: {
    backgroundColor: Colors.grassGreen,
  },
  pathDotCurrent: {
    backgroundColor: Colors.goldenYellow,
  },
  startMarker: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.grassGreen,
    zIndex: 5,
  },
  pathDash: {
    position: 'absolute',
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  traceDot: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    zIndex: 8,
  },
  feedbackWrap: {
    position: 'absolute',
    bottom: 80,
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
    zIndex: 20,
  },
  feedbackText: {
    fontSize: 36,
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
