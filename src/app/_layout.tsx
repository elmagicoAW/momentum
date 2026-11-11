"use no memo"; // Keep external locale reads live; explicit domain memos remain intact.
import { ACTIVE_PRESENTATION } from '@/utils/presentation';
import { useAppTheme } from '@/hooks/use-app-theme';
import { DataBackupProvider } from '@/hooks/use-data-backup';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AppPresentation } from '@/components/app-presentation';
import { DevThemePreviewControls } from '@/components/dev-theme-preview';
import { DevQaTools } from '@/components/dev-qa-tools';

import { AchievementsProvider } from '@/hooks/use-achievements';
import { DailyProgressProvider } from '@/hooks/use-daily-progress';
import { GoalsProvider } from '@/hooks/use-goals';
import { HabitsProvider } from '@/hooks/use-habits';
import { ProfileProvider } from '@/hooks/use-profile';
import { PreferencesProvider } from '@/hooks/use-preferences';
import { ThemePreviewProvider } from '@/hooks/use-theme-preview';
import { RoutinesProvider } from '@/hooks/use-routines';

SplashScreen.preventAutoHideAsync();

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
    <PreferencesProvider>
      <ThemePreviewProvider>
        <AppPresentation>
          <RootNavigator />
        </AppPresentation>
      </ThemePreviewProvider>
    </PreferencesProvider>
  );
}

function RootNavigator() {
  const { palette: Palette } = useAppTheme();
  return (
      <DataBackupProvider>
      <DevThemePreviewControls />
      <ProfileProvider>
        <HabitsProvider>
          <DailyProgressProvider>
            <AchievementsProvider>
              <GoalsProvider>
                <RoutinesProvider>
                  <AnimatedSplashOverlay />
                  <Stack
                    screenOptions={{
                      headerShown: false,
                      contentStyle: { backgroundColor: Palette.background },
                    }}>
                    <Stack.Screen name="(tabs)" />
                    <Stack.Screen name="routine/[id]" options={{ animation: ACTIVE_PRESENTATION.direction === 'rtl' ? 'slide_from_left' : 'slide_from_right' }} />
                    <Stack.Screen name="routine/new" options={{ animation: 'slide_from_bottom' }} />
                    <Stack.Screen name="routine/edit/[id]" options={{ animation: 'slide_from_bottom' }} />
                    <Stack.Screen name="profile/edit" options={{ animation: 'slide_from_bottom' }} />
                    <Stack.Screen name="data-backup" options={{ animation: ACTIVE_PRESENTATION.direction === 'rtl' ? 'slide_from_left' : 'slide_from_right' }} />
                    <Stack.Screen name="achievements" options={{ animation: ACTIVE_PRESENTATION.direction === 'rtl' ? 'slide_from_left' : 'slide_from_right' }} />
                  </Stack>
                </RoutinesProvider>
              </GoalsProvider>
            </AchievementsProvider>
          </DailyProgressProvider>
        </HabitsProvider>
      </ProfileProvider>
      <DevQaTools />
      </DataBackupProvider>
  );
}
