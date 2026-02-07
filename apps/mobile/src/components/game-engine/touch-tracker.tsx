import { useCallback, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import type { PropsWithChildren } from 'react';

export interface TouchEvent {
  timestamp: number;
  x: number;
  y: number;
  phase: 'began' | 'moved' | 'ended';
  pressure: number | null;
}

interface TouchTrackerProps {
  onTouchEvent?: (event: TouchEvent) => void;
  enabled?: boolean;
}

export function TouchTracker({
  children,
  onTouchEvent,
  enabled = true,
}: PropsWithChildren<TouchTrackerProps>): React.JSX.Element {
  const startTimeRef = useRef<number>(0);

  const createEvent = useCallback(
    (x: number, y: number, phase: TouchEvent['phase']): TouchEvent => ({
      timestamp: performance.now(),
      x,
      y,
      phase,
      pressure: null,
    }),
    [],
  );

  const pan = Gesture.Pan()
    .enabled(enabled)
    .minDistance(0)
    .onBegin((e) => {
      startTimeRef.current = performance.now();
      onTouchEvent?.(createEvent(e.x, e.y, 'began'));
    })
    .onUpdate((e) => {
      onTouchEvent?.(createEvent(e.x, e.y, 'moved'));
    })
    .onEnd((e) => {
      onTouchEvent?.(createEvent(e.x, e.y, 'ended'));
    });

  const tap = Gesture.Tap()
    .enabled(enabled)
    .onEnd((e) => {
      onTouchEvent?.(createEvent(e.x, e.y, 'began'));
      // Tap fires began+ended together
      setTimeout(() => {
        onTouchEvent?.(createEvent(e.x, e.y, 'ended'));
      }, 0);
    });

  const composed = Gesture.Race(pan, tap);

  return (
    <GestureDetector gesture={composed}>
      <View style={styles.container}>
        {children}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
