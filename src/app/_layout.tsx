import { DataBackupProvider } from '@/hooks/use-data-backup';
import { DarkTheme, Stack, ThemeProvider, type Theme } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { Palette } from '@/constants/theme';
import { AchievementsProvider } from '@/hooks/use-achievements';
import { DailyProgressProvider } from '@/hooks/use-daily-progress';
import { GoalsProvider } from '@/hooks/use-goals';
import { HabitsProvider } from '@/hooks/use-habits';
import { ProfileProvider } from '@/hooks/use-profile';
import { RoutinesProvider } from '@/hooks/use-routines';

SplashScreen.preventAutoHideAsync();

// MOMENTUM is dark-only for now.
const MomentumTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: Palette.accent,
    background: Palette.background,
    card: Palette.surface,
    text: Palette.text,
    border: Palette.border,
  },
};

/** Deep links into a routine screen still get the tabs underneath, so Back always has somewhere to go. */
export const unstable_settings = {
  anchor: '(tabs)',
};

/**
 * Root Stack above the five tabs (`(tabs)/_layout.tsx`).
 *
 * Routine screens and the profile editor live here, not inside a tab, so they are pushed OVER whichever
 * tab opened them: Back (header button or Android hardware back) always returns
 * to that tab — Today's plan → Today, Habits › Routines → the routine list.
 * This is the pattern the Expo Router docs recommend for "returning to the
 * originating screen" with native tabs.
 */
export default function RootLayout() {
  return (
    <ThemeProvider value={MomentumTheme}>
      <DataBackupProvider>
      <ProfileProvider>
        <HabitsProvider>
          <DailyProgressProvider>
            <AchievementsProvider>
              <GoalsProvider>
                <RoutinesProvider>
                  <StatusBar style="light" />
                  <AnimatedSplashOverlay />
                  <Stack
                    screenOptions={{
                      headerShown: false,
                      contentStyle: { backgroundColor: Palette.background },
                    }}>
                    <Stack.Screen name="(tabs)" />
                    <Stack.Screen name="routine/[id]" options={{ animation: 'slide_from_right' }} />
                    <Stack.Screen name="routine/new" options={{ animation: 'slide_from_bottom' }} />
                    <Stack.Screen name="routine/edit/[id]" options={{ animation: 'slide_from_bottom' }} />
                    <Stack.Screen name="profile/edit" options={{ animation: 'slide_from_bottom' }} />
                    <Stack.Screen name="data-backup" options={{ animation: 'slide_from_right' }} />
                    <Stack.Screen name="achievements" options={{ animation: 'slide_from_right' }} />
                  </Stack>
                </RoutinesProvider>
              </GoalsProvider>
            </AchievementsProvider>
          </DailyProgressProvider>
        </HabitsProvider>
      </ProfileProvider>
      </DataBackupProvider>
    </ThemeProvider>
  );
}
