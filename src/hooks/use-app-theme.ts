import { useThemePreview } from '@/hooks/use-theme-preview';

/** One applied theme authority. Public requests remain gated; dev preview is memory-only. */
export function useAppTheme() {
  const { appearance, requestedScheme, scheme, palette } = useThemePreview();
  return { appearance, requestedScheme, scheme, palette };
}
