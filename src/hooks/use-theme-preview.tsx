import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { Appearance as NativeAppearance, AppState } from 'react-native';

import { Palettes, type AppPalette, type AppScheme } from '@/constants/palettes';
import type { Appearance } from '@/data/preferences-storage';
import { usePreferences } from '@/hooks/use-preferences';
import { startAppearanceSession } from '@/utils/appearance-session';

const ThemePreviewContext = createContext<{
  appearance: Appearance; requestedScheme: AppScheme; scheme: AppScheme; palette: AppPalette;
}>({
  appearance: 'dark', requestedScheme: 'dark', scheme: 'dark', palette: Palettes.dark,
});

/** Saved appearance is the sole authority. Keep this provider identity stable across switches. */
export function ThemePreviewProvider({ children }: PropsWithChildren) {
  const [resolved, setResolved] = useState<AppScheme>('dark');
  const { preferences } = usePreferences();
  const appearance = preferences.appearance;
  useEffect(() => startAppearanceSession(appearance, NativeAppearance, AppState, setResolved), [appearance]);
  useEffect(() => () => NativeAppearance.setColorScheme?.('auto'), []);
  const scheme = appearance === 'system' ? resolved : appearance;
  const value = useMemo(() => ({ appearance, requestedScheme: scheme, scheme, palette: Palettes[scheme] }),
    [appearance, scheme]);
  return <ThemePreviewContext.Provider value={value}>{children}</ThemePreviewContext.Provider>;
}

export const useThemePreview = () => useContext(ThemePreviewContext);
