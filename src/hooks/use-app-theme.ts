import { useThemePreview } from '@/hooks/use-theme-preview';
import { usePresentationLanguage } from './use-presentation-language';

/** One applied theme authority, driven only by successfully loaded/saved preferences. */
export function useAppTheme() {
  usePresentationLanguage();
  const { appearance, requestedScheme, scheme, palette } = useThemePreview();
  return { appearance, requestedScheme, scheme, palette };
}
