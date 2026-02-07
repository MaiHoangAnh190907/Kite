import { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, useWindowDimensions } from 'react-native';

const TRANSITION_DURATION_MS = 3000;

interface TransitionProps {
  onComplete: () => void;
}

export function Transition({ onComplete }: TransitionProps): React.JSX.Element {
  const { width, height } = useWindowDimensions();
  const progress = useRef(new Animated.Value(0)).current;

  const kiteX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-80, width + 80],
  });

  const kiteY = progress.interpolate({
    inputRange: [0, 0.17, 0.33, 0.5, 0.67, 0.83, 1],
    outputRange: [
      height * 0.4,
      height * 0.4 - height * 0.12,
      height * 0.4,
      height * 0.4 + height * 0.12,
      height * 0.4,
      height * 0.4 - height * 0.12,
      height * 0.4,
    ],
  });

  const sparkleOpacity = progress.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [0.2, 0.8, 0.2, 0.8, 0.2],
  });

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: TRANSITION_DURATION_MS - 400,
      delay: 200,
      useNativeDriver: true,
    }).start();

    const timer = setTimeout(() => {
      onComplete();
    }, TRANSITION_DURATION_MS);

    return () => clearTimeout(timer);
  }, [onComplete, progress]);

  return (
    <View style={styles.container}>
      {/* Background clouds */}
      <View style={[styles.bgCloud, { left: width * 0.2, top: height * 0.25, width: 80, height: 80 }]} />
      <View style={[styles.bgCloud, { left: width * 0.6, top: height * 0.15, width: 100, height: 100, opacity: 0.3 }]} />
      <View style={[styles.bgCloud, { left: width * 0.8, top: height * 0.35, width: 70, height: 70, opacity: 0.5 }]} />

      {/* Sparkle trail */}
      <Animated.View
        style={[
          styles.sparkle,
          {
            opacity: sparkleOpacity,
            transform: [
              { translateX: Animated.subtract(kiteX, 40) },
              { translateY: Animated.add(kiteY, 10) },
            ],
          },
        ]}
      />

      {/* Kite */}
      <Animated.View
        style={[
          styles.kite,
          {
            transform: [{ translateX: kiteX }, { translateY: kiteY }],
          },
        ]}
      >
        <View style={styles.kiteDiamond} />
        <View style={styles.kiteTail} />
        <View style={styles.kiteBow1} />
        <View style={styles.kiteBow2} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#87CEEB',
  },
  bgCloud: {
    position: 'absolute',
    borderRadius: 50,
    backgroundColor: 'rgba(248,249,250,0.4)',
  },
  sparkle: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFD700',
  },
  kite: {
    position: 'absolute',
    alignItems: 'center',
  },
  kiteDiamond: {
    width: 40,
    height: 40,
    backgroundColor: '#FF8C42',
    borderRadius: 4,
    transform: [{ rotate: '45deg' }],
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  kiteTail: {
    width: 3,
    height: 60,
    backgroundColor: '#FF8C42',
    marginTop: -4,
  },
  kiteBow1: {
    position: 'absolute',
    top: 50,
    left: -5,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
  },
  kiteBow2: {
    position: 'absolute',
    top: 65,
    left: 5,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFD700',
  },
});
