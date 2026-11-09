/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://unistyl.es/), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

import { Palettes } from '@/constants/palettes';
export { Palettes, type AppPalette, type AppScheme } from '@/constants/palettes';

// Compatibility names for shared starter primitives, derived from the same palette authority.
const sharedColors = (palette: typeof Palettes.dark) => ({
  text: palette.text, background: palette.background, backgroundElement: palette.surfaceRaised,
  backgroundSelected: palette.ringTrack, textSecondary: palette.textSecondary,
});
export const Colors = { light: sharedColors(Palettes.light), dark: sharedColors(Palettes.dark) };

export const Radius = {
  sm: 10,
  md: 16,
  lg: 24,
  pill: 999,
} as const;

export type ThemeColor =keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
