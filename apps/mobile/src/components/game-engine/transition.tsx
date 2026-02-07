import { useEffect } from 'react';
import { useWindowDimensions } from 'react-native';
import {
  Canvas,
  Path,
  Skia,
  Group,
  Circle,
  Line,
  vec,
} from '@shopify/react-native-skia';
import {
  useSharedValue,
  withTiming,
  withSequence,
  withDelay,
  Easing,
  runOnJS,
  useDerivedValue,
} from 'react-native-reanimated';

const TRANSITION_DURATION_MS = 3000;

interface TransitionProps {
  onComplete: () => void;
}

export function Transition({ onComplete }: TransitionProps): React.JSX.Element {
  const { width, height } = useWindowDimensions();
  const progress = useSharedValue(0);

  // Kite position derived from progress (0 → 1 across screen)
  const kiteX = useDerivedValue(() => {
    return -80 + progress.value * (width + 160);
  });

  const kiteY = useDerivedValue(() => {
    // Sine wave path as kite flies across
    const centerY = height * 0.4;
    const amplitude = height * 0.12;
    return centerY + Math.sin(progress.value * Math.PI * 3) * amplitude;
  });

  // Kite body path (diamond shape)
  const kiteBodyPath = useDerivedValue(() => {
    const x = kiteX.value;
    const y = kiteY.value;
    const path = Skia.Path.Make();
    path.moveTo(x, y - 30);       // top
    path.lineTo(x + 20, y);       // right
    path.lineTo(x, y + 30);       // bottom
    path.lineTo(x - 20, y);       // left
    path.close();
    return path;
  });

  // Tail control points
  const tailPath = useDerivedValue(() => {
    const x = kiteX.value;
    const y = kiteY.value;
    const path = Skia.Path.Make();
    path.moveTo(x, y + 30);
    const wave = Math.sin(progress.value * Math.PI * 8) * 15;
    path.cubicTo(
      x - 10 + wave, y + 50,
      x + 10 - wave, y + 70,
      x + wave, y + 90,
    );
    return path;
  });

  useEffect(() => {
    progress.value = withSequence(
      withDelay(
        200,
        withTiming(1, {
          duration: TRANSITION_DURATION_MS - 400,
          easing: Easing.inOut(Easing.ease),
        }),
      ),
    );

    const timer = setTimeout(() => {
      onComplete();
    }, TRANSITION_DURATION_MS);

    return () => clearTimeout(timer);
  }, [onComplete, progress]);

  // Sparkle positions along the trail
  const sparkle1X = useDerivedValue(() => kiteX.value - 30);
  const sparkle1Y = useDerivedValue(() => kiteY.value + 10);
  const sparkle2X = useDerivedValue(() => kiteX.value - 60);
  const sparkle2Y = useDerivedValue(() => kiteY.value + 5);
  const sparkleOpacity = useDerivedValue(() => {
    return Math.max(0, Math.sin(progress.value * Math.PI * 12) * 0.6 + 0.2);
  });

  return (
    <Canvas style={{ flex: 1, backgroundColor: '#87CEEB' }}>
      {/* Background clouds */}
      <Circle cx={width * 0.2} cy={height * 0.25} r={40} color="rgba(248,249,250,0.4)" />
      <Circle cx={width * 0.6} cy={height * 0.15} r={50} color="rgba(248,249,250,0.3)" />
      <Circle cx={width * 0.8} cy={height * 0.35} r={35} color="rgba(248,249,250,0.5)" />

      {/* Sparkle trail */}
      <Circle cx={sparkle1X} cy={sparkle1Y} r={4} color="#FFD700" opacity={sparkleOpacity} />
      <Circle cx={sparkle2X} cy={sparkle2Y} r={3} color="#FFD700" opacity={sparkleOpacity} />

      {/* Kite body */}
      <Path path={kiteBodyPath} color="#FF8C42" style="fill" />
      <Path path={kiteBodyPath} color="#FFFFFF" style="stroke" strokeWidth={2} />

      {/* Kite tail */}
      <Path path={tailPath} color="#FF8C42" style="stroke" strokeWidth={3} />
    </Canvas>
  );
}
