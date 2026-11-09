import { Stack } from 'expo-router';

import { Palette } from '@/constants/theme';

/**
 * Stack inside the Habits tab: list → create / edit, and list → Routines.
 * Routine detail / forms are root-stack screens (see src/app/_layout.tsx).
 * Screens draw their own headers.
 */

/**
 * The habit list always sits at the bottom of this stack — also when another tab
 * jumps straight to Habits › Routines (Today's plan "Manage") — so Back from the
 * routine list lands on the habit list instead of leaving the tab.
 */
export const unstable_settings = {
  anchor: 'index',
};

export default function HabitsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Palette.background },
      }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="new" options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="[id]" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="routines" options={{ animation: 'slide_from_right' }} />
    </Stack>
  );
}
