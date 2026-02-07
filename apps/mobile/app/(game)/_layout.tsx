import { Stack } from 'expo-router';

export default function GameLayout(): React.JSX.Element {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade' }} />
  );
}
