import { createContext, useContext, useMemo, useState, type PropsWithChildren } from 'react';

import { appliedScheme, Palettes, type AppPalette, type AppScheme } from '@/constants/palettes';
import type { Appearance } from '@/data/preferences-storage';
import { usePreferences } from '@/hooks/use-preferences';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { resolveAppearance } from '@/utils/presentation';

const ThemePreviewContext = createContext<{
  appearance: Appearance; requestedScheme: AppScheme; scheme: AppScheme; palette: AppPalette;
  setPreview: (scheme: AppScheme) => void;
}>({
  appearance: 'dark', requestedScheme: 'dark', scheme: 'dark', palette: Palettes.dark, setPreview: () => undefined,
});

/** Stable theme authority with a memory-only preview; never writes preferences/domain records. */
export function ThemePreviewProvider({ children }: PropsWithChildren) {
  const [preview, setPreview] = useState<AppScheme | null>(null);
  const { preferences } = usePreferences();
  const deviceScheme = useColorScheme();
  const appearance = preferences.appearance;
  const requestedScheme = resolveAppearance(appearance, deviceScheme);
  const scheme = appliedScheme(preview, __DEV__);
  const value = useMemo(() => ({ appearance, requestedScheme, scheme, palette: Palettes[scheme], setPreview }),
    [appearance, requestedScheme, scheme]);
  return <ThemePreviewContext.Provider value={value}>{children}</ThemePreviewContext.Provider>;
}

export const useThemePreview = () => useContext(ThemePreviewContext);
