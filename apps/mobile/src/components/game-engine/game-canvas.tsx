import { View, StyleSheet } from 'react-native';
import type { PropsWithChildren } from 'react';

export function GameCanvas({ children }: PropsWithChildren): React.JSX.Element {
  return (
    <View style={styles.canvas}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: {
    flex: 1,
  },
});
