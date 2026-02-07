import { Stack } from 'expo-router';

export default function EndLayout(): React.JSX.Element {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade' }} />
  );
}
