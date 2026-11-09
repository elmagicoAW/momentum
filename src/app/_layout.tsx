import { DarkTheme, ThemeProvider, type Theme } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { Palette } from '@/constants/theme';
import { HabitsProvider } from '@/hooks/use-habits';

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

export default function TabLayout() {
  return (
    <ThemeProvider value={MomentumTheme}>
      <HabitsProvider>
        <StatusBar style="light" />
        <AnimatedSplashOverlay />
        <AppTabs />
      </HabitsProvider>
    </ThemeProvider>
  );
}
