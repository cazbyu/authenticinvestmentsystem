import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="calendar" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="coach" />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}