import { useThemePreview } from '@/hooks/use-theme-preview';

/** One applied theme authority, driven only by successfully loaded/saved preferences. */
export function useAppTheme() {
  const { appearance, requestedScheme, scheme, palette } = useThemePreview();
  return { appearance, requestedScheme, scheme, palette };
}
