import { useAppTheme } from '@/hooks/use-app-theme';
import { Stack } from 'expo-router';

/** Stack inside the Insights tab: dashboard → habit history. Screens draw their own headers. */
export default function InsightsLayout() {
  const { palette: Palette } = useAppTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Palette.background },
      }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="habit/[id]" options={{ animation: 'slide_from_right' }} />
    </Stack>
  );
}
