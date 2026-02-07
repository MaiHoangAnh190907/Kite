import 'react-native-get-random-values';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export { ErrorBoundary } from 'expo-router';

export default function RootLayout(): React.JSX.Element {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
        <Stack.Screen name="(staff)" />
        <Stack.Screen name="(consent)" />
        <Stack.Screen name="(game)" />
        <Stack.Screen name="(end)" />
      </Stack>
    </GestureHandlerRootView>
  );
}
