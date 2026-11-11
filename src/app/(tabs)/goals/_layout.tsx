"use no memo"; // Keep external locale reads live; explicit domain memos remain intact.
import { ACTIVE_PRESENTATION } from '@/utils/presentation';
import { useAppTheme } from '@/hooks/use-app-theme';
import { Stack } from 'expo-router';

/** Stack inside the Goals tab: list → create / edit. Screens draw their own headers. */
export default function GoalsLayout() {
  const { palette: Palette } = useAppTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Palette.background },
      }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="new" options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="[id]" options={{ animation: ACTIVE_PRESENTATION.direction === 'rtl' ? 'slide_from_left' : 'slide_from_right' }} />
    </Stack>
  );
}
