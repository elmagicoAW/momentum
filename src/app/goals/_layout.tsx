import { Stack } from 'expo-router';

import { Palette } from '@/constants/theme';

/** Stack inside the Goals tab: list → create / edit. Screens draw their own headers. */
export default function GoalsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Palette.background },
      }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="new" options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="[id]" options={{ animation: 'slide_from_right' }} />
    </Stack>
  );
}
