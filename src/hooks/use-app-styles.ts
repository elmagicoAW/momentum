import type { AppPalette } from '@/constants/palettes';
import { useAppTheme } from '@/hooks/use-app-theme';
import { stylesForPalette } from '@/utils/theme-styles';
import { directionStyles } from '@/utils/direction-styles';
import { usePresentationLanguage } from './use-presentation-language';

export function useAppStyles<T extends object>(factory: (palette: AppPalette) => T) {
  const { palette, scheme } = useAppTheme();
  const language = usePresentationLanguage();
  return { palette, scheme, language, styles: directionStyles(stylesForPalette(factory, palette), language === 'ar') };
}
