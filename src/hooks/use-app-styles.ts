import type { AppPalette } from '@/constants/palettes';
import { useAppTheme } from '@/hooks/use-app-theme';
import { stylesForPalette } from '@/utils/theme-styles';

export function useAppStyles<T extends object>(factory: (palette: AppPalette) => T) {
  const { palette, scheme } = useAppTheme();
  return { palette, scheme, styles: stylesForPalette(factory, palette) };
}
