import { Canvas } from '@shopify/react-native-skia';
import { StyleSheet } from 'react-native';
import type { PropsWithChildren } from 'react';

export function GameCanvas({ children }: PropsWithChildren): React.JSX.Element {
  return (
    <Canvas style={styles.canvas}>
      {children}
    </Canvas>
  );
}

const styles = StyleSheet.create({
  canvas: {
    flex: 1,
  },
});
