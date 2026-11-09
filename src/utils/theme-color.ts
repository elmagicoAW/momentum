import { Palettes, type AppPalette } from '@/constants/palettes';

const rgb = (color: string) => /^#[0-9a-f]{6}$/i.test(color)
  ? [1, 3, 5].map((offset) => parseInt(color.slice(offset, offset + 2), 16)) : null;
export function contrastRatio(a: string, b: string): number {
  const luminance = (color: string) => {
    const channels = rgb(color);
    if (!channels) throw new Error('Contrast requires #RRGGBB');
    return channels.map((n) => n / 255).map((n) => n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4)
      .reduce((sum, n, index) => sum + n * [0.2126, 0.7152, 0.0722][index], 0);
  };
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** Keep stored swatches/fills intact; adapt only their displayed foreground in light mode. */
export function readableAccent(color: string, palette: AppPalette): string {
  if (palette === Palettes.dark) return color;
  const channels = rgb(color);
  if (!channels) return palette.accent;
  const backdrop = rgb(palette.surfaceRaised)!;
  const tinted = '#' + channels.map((n, index) => Math.round(n * 0.2 + backdrop[index] * 0.8)
    .toString(16).padStart(2, '0')).join('');
  let result = color;
  // Cover neutral and tinted icon/card backgrounds (up to the existing 20% fill).
  for (let step = 0; step <= 20; step++) {
    result = '#' + channels.map((n) => Math.round(n * (1 - step / 20)).toString(16).padStart(2, '0')).join('');
    if (contrastRatio(result, palette.surfaceRaised) >= 4.5 && contrastRatio(result, tinted) >= 4.5) break;
  }
  return result;
}

export function foregroundOnColor(color: string): string {
  const dark = Palettes.dark.background, light = '#FFFFFF';
  return rgb(color) && contrastRatio(light, color) > contrastRatio(dark, color) ? light : dark;
}

export function withAlpha(color: string, alpha: number, fallback: string): string {
  const base = rgb(color) ? color : fallback;
  const a = Math.round(Math.min(Math.max(alpha, 0), 1) * 255).toString(16).padStart(2, '0');
  return `${base}${a}`;
}

/** Contrast against the actual translucent heatmap fill rather than the page color. */
export function heatmapForeground(color: string, alpha: number, palette: AppPalette, darkBaseline: string): string {
  if (palette === Palettes.dark) return darkBaseline;
  const channels = rgb(color) ?? rgb(palette.accent)!;
  const backdrop = rgb(palette.surface)!;
  const composite = '#' + channels.map((n, index) => Math.round(n * alpha + backdrop[index] * (1 - alpha))
    .toString(16).padStart(2, '0')).join('');
  return foregroundOnColor(composite);
}
