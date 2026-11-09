import type { AppPalette } from '@/constants/palettes';

// Each module factory is evaluated once per immutable palette, shared by its components.
const cache = new WeakMap<object, WeakMap<AppPalette, object>>();
export function stylesForPalette<T extends object>(factory: (palette: AppPalette) => T, palette: AppPalette): T {
  let palettes = cache.get(factory);
  if (!palettes) { palettes = new WeakMap(); cache.set(factory, palettes); }
  let styles = palettes.get(palette) as T | undefined;
  if (!styles) { styles = factory(palette); palettes.set(palette, styles); }
  return styles;
}
