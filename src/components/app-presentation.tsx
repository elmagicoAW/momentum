import { DarkTheme, DefaultTheme, LocaleProvider, ThemeProvider, type Theme } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useMemo, type PropsWithChildren } from 'react';
import { View } from 'react-native';

import { useAppTheme } from '@/hooks/use-app-theme';
import { useLanguage } from '@/hooks/use-language';

/** Stable bridge above recovery; never waits for preference hydration or remounts descendants. */
export function AppPresentation({ children }: PropsWithChildren) {
  const { palette, scheme } = useAppTheme();
  const { direction } = useLanguage();
  const theme = useMemo<Theme>(() => {
    const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
    return { ...base, colors: { ...base.colors, primary: palette.accent, background: palette.background,
      card: palette.surface, text: palette.text, border: palette.border } };
  }, [palette, scheme]);
  useEffect(() => {
    // Root background only: do not unlock native appearance or activate System in this phase.
    void SystemUI.setBackgroundColorAsync(palette.background).catch((error: unknown) => {
      if (__DEV__) console.warn('[momentum] Could not update root presentation background', error);
    });
  }, [palette]);
  return (
    <ThemeProvider value={theme}>
      <LocaleProvider direction={direction}>
        <View style={{ flex: 1, direction, backgroundColor: palette.background }}>
          <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
          {children}
        </View>
      </LocaleProvider>
    </ThemeProvider>
  );
}
