import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export { ErrorBoundary } from 'expo-router';

export default function RootLayout(): React.JSX.Element {
  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
        <Stack.Screen name="(staff)" />
        <Stack.Screen name="(consent)" />
        <Stack.Screen name="(game)" />
        <Stack.Screen name="(end)" />
      </Stack>
    </>
  );
}
