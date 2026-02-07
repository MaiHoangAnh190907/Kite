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
import { v4 as uuid } from 'uuid';
import * as Haptics from 'expo-haptics';

import { Colors } from '../../src/constants/colors';
import { useSessionStore } from '../../src/stores/session-store';

const GAME_DURATION_MS = 150_000;
const PATH_WIDTH = 40;
const CHECKPOINT_RADIUS = 20;

interface PathPoint {
  x: number;
  y: number;
}

interface TraceEvent {
  type: 'trace';
  pathIndex: number;
  pathPoints: PathPoint[];
  tracePoints: PathPoint[];
  accuracy: number;
  completionRate: number;
  durationMs: number;
  timestamp: number;
}

function generatePath(width: number, height: number, difficulty: number): PathPoint[] {
  const points: PathPoint[] = [];
  const numPoints = 5 + Math.floor(difficulty * 3);
  const margin = 80;
  const usableW = width - margin * 2;
  const usableH = height * 0.6;
  const startY = height * 0.15;

  for (let i = 0; i < numPoints; i++) {
    const t = i / (numPoints - 1);
    const x = margin + t * usableW;
    const y = startY + usableH * 0.5 + Math.sin(t * Math.PI * (2 + difficulty)) * usableH * 0.35;
    points.push({ x, y });
  }
  return points;
}

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

export default function WindTrailsScreen(): React.JSX.Element {
  const { width, height } = useWindowDimensions();

  const recordEvents = useSessionStore((s) => s.recordEvents);
  const startGame = useSessionStore((s) => s.startGame);
  const endGame = useSessionStore((s) => s.endGame);

  const eventsRef = useRef<TraceEvent[]>([]);
  const gameStartRef = useRef(0);
  const traceStartRef = useRef(0);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION_MS);
  const [pathIdx, setPathIdx] = useState(0);
  const [difficulty, setDifficulty] = useState(0);
  const [path, setPath] = useState<PathPoint[]>([]);
  const [tracePoints, setTracePoints] = useState<PathPoint[]>([]);
  const [tracing, setTracing] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [showEndAnim, setShowEndAnim] = useState(false);
  const gameOverRef = useRef(false);

  useEffect(() => {
    startGame('wind_trails');
    gameStartRef.current = performance.now();
    setPath(generatePath(width, height, 0));
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

  const evaluateTrace = useCallback((trace: PathPoint[], target: PathPoint[]): number => {
    if (trace.length < 2 || target.length < 2) return 0;
    let totalDist = 0;
    for (const p of trace) {
      let minDist = Infinity;
      for (let i = 0; i < target.length - 1; i++) {
        const d = distToSegment(p.x, p.y, target[i].x, target[i].y, target[i + 1].x, target[i + 1].y);
        if (d < minDist) minDist = d;
      }
      totalDist += minDist;
    }
    const avgDist = totalDist / trace.length;
    return Math.max(0, Math.min(1, 1 - avgDist / 100));
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        if (gameOverRef.current) return;
        setTracing(true);
        traceStartRef.current = performance.now();
        const { locationX, locationY } = e.nativeEvent;
        setTracePoints([{ x: locationX, y: locationY }]);
      },
      onPanResponderMove: (e) => {
        if (gameOverRef.current) return;
        const { locationX, locationY } = e.nativeEvent;
        setTracePoints((prev) => [...prev, { x: locationX, y: locationY }]);
      },
      onPanResponderRelease: () => {
        if (gameOverRef.current) return;
        setTracing(false);
        const trace = tracePoints;
        const accuracy = evaluateTrace(trace, path);
        const lastTarget = path[path.length - 1];
        const lastTrace = trace[trace.length - 1];
        const endDist = lastTrace && lastTarget
          ? Math.sqrt((lastTrace.x - lastTarget.x) ** 2 + (lastTrace.y - lastTarget.y) ** 2)
          : 999;
        const completionRate = endDist < 60 ? 1 : Math.max(0, 1 - endDist / 300);

        eventsRef.current.push({
          type: 'trace',
          pathIndex: pathIdx,
          pathPoints: path,
          tracePoints: trace,
          accuracy,
          completionRate,
          durationMs: performance.now() - traceStartRef.current,
          timestamp: performance.now(),
        });

        if (accuracy > 0.5) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setFeedback('Nice!');
        } else {
          setFeedback('Try smoother!');
        }

        setTimeout(() => {
          setFeedback(null);
          const nextDiff = Math.min(difficulty + 0.3, 3);
          setDifficulty(nextDiff);
          setPath(generatePath(width, height, nextDiff));
          setTracePoints([]);
          setPathIdx((p) => p + 1);
        }, 1200);
      },
    })
  ).current;

  if (showEndAnim) {
    return (
      <View style={styles.container}>
        <View style={styles.endWrap}>
          <Text style={styles.endIcon}>🌈</Text>
          <View style={styles.starBadge}>
            <View style={[styles.starInner, { backgroundColor: Colors.grassGreen }]} />
          </View>
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

      <Text style={styles.hint}>Trace the path with your finger!</Text>

      {/* Target path rendered as dots */}
      {path.map((p, i) => (
        <View
          key={`path-${i}`}
          style={[
            styles.pathDot,
            {
              left: p.x - 6,
              top: p.y - 6,
              backgroundColor: i === 0 ? Colors.grassGreen : i === path.length - 1 ? Colors.sunsetOrange : 'rgba(255,255,255,0.5)',
              width: i === 0 || i === path.length - 1 ? 18 : 12,
              height: i === 0 || i === path.length - 1 ? 18 : 12,
              borderRadius: i === 0 || i === path.length - 1 ? 9 : 6,
            },
          ]}
        />
      ))}

      {/* Path lines */}
      {path.map((p, i) => {
        if (i === 0) return null;
        const prev = path[i - 1];
        const dx = p.x - prev.x;
        const dy = p.y - prev.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);
        return (
          <View
            key={`line-${i}`}
            style={[
              styles.pathLine,
              {
                left: prev.x,
                top: prev.y - 2,
                width: len,
                transform: [{ rotate: `${angle}deg` }],
                transformOrigin: 'left center',
              },
            ]}
          />
        );
      })}

      {/* Trace dots */}
      {tracePoints.filter((_, i) => i % 3 === 0).map((p, i) => (
        <View
          key={`trace-${i}`}
          style={[
            styles.traceDot,
            { left: p.x - 4, top: p.y - 4 },
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
    backgroundColor: 'rgba(0,0,0,0.1)',
    zIndex: 10,
  },
  timerBar: {
    height: 6,
    backgroundColor: Colors.grassGreen,
  },
  hint: {
    position: 'absolute',
    top: 20,
    alignSelf: 'center',
    fontSize: 20,
    fontWeight: '600',
    color: Colors.skyBlueDark,
  },
  pathDot: {
    position: 'absolute',
  },
  pathLine: {
    position: 'absolute',
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.45)',
    borderRadius: 2,
  },
  traceDot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.sunsetOrange,
    opacity: 0.8,
  },
  feedbackWrap: {
    position: 'absolute',
    bottom: 80,
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  feedbackText: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textDark,
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
    backgroundColor: 'rgba(76,175,80,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  starInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
});
