import { ACTIVE_PRESENTATION } from '@/utils/presentation';

/** Pure presentation tokens: no native APIs or persisted data. Dark is the cbd23fa baseline. */
const dark = {
  background: '#08080D', surface: '#12121A', surfaceRaised: '#1A1A25', border: '#24243A',
  text: '#F4F4F8', textSecondary: '#9A9AB0', textMuted: '#5E5E75', controlBorder: '#24243A',
  accent: '#8B7CF6', accentSoft: 'rgba(139, 124, 246, 0.14)',
  accentBlue: '#5B8DEF', accentBlueSoft: 'rgba(91, 141, 239, 0.14)',
  success: '#4ADE9B', danger: '#F87171', dangerSoft: 'rgba(248, 113, 113, 0.12)',
  ring: '#8B7CF6', ringTrack: '#1F1F2E',
  // Foreground for solid app-accent controls, distinct from the page background.
  onAccent: '#08080D', onSuccess: '#08080D',
  ripple: 'rgba(255,255,255,0.06)', rippleSubtle: 'rgba(255,255,255,0.08)',
  rippleMedium: 'rgba(255,255,255,0.1)', rippleStrong: 'rgba(255,255,255,0.12)',
  rippleOnAccent: 'rgba(255,255,255,0.18)', rippleDanger: 'rgba(248,113,113,0.15)',
  accentBorder: 'rgba(139, 124, 246, 0.35)', accentBorderSubtle: 'rgba(139, 124, 246, 0.3)',
  accentBorderStrong: 'rgba(139, 124, 246, 0.4)', accentBorderChip: 'rgba(139, 124, 246, 0.45)',
  accentBorderFocus: 'rgba(139, 124, 246, 0.55)', blueBorder: 'rgba(91, 141, 239, 0.25)',
  blueFill: 'rgba(91, 141, 239, 0.18)', dangerBorder: 'rgba(248, 113, 113, 0.35)',
  pausedSoft: 'rgba(154, 154, 176, 0.14)', successSoft: 'rgba(74, 222, 155, 0.14)',
  planHighlight: '#15142A', achievementSummary: '#141322', achievementSummaryBorder: '#343052',
  achievementEncouragement: '#C5BCFF', achievementEarned: '#171424', achievementEarnedBorder: '#47406C',
  achievementHero: '#171329', achievementHeroBorder: '#37305B', achievementEyebrow: '#A9BFFB',
  achievementTotal: '#B9AAFF', link: '#3c87f7',
  // Existing JS splash artwork surface; native launch artwork/config remains separate.
  splashBackground: '#208AEF',
} as const;

export type AppPalette = Readonly<{ [Key in keyof typeof dark]: string }>;
const light: AppPalette = {
  background: '#F7F7FC', surface: '#FFFFFF', surfaceRaised: '#EEEEF6', border: '#CACADA',
  text: '#191925', textSecondary: '#505066', textMuted: '#626276', controlBorder: '#838396',
  accent: '#5842B6', accentSoft: 'rgba(88, 66, 182, 0.10)',
  accentBlue: '#2456A6', accentBlueSoft: 'rgba(36, 86, 166, 0.10)',
  success: '#146B43', danger: '#B22C3A', dangerSoft: 'rgba(178, 44, 58, 0.08)',
  ring: '#5842B6', ringTrack: '#E1E1EF', onAccent: '#FFFFFF', onSuccess: '#FFFFFF',
  ripple: 'rgba(25,25,37,0.06)', rippleSubtle: 'rgba(25,25,37,0.08)',
  rippleMedium: 'rgba(25,25,37,0.1)', rippleStrong: 'rgba(25,25,37,0.12)',
  rippleOnAccent: 'rgba(255,255,255,0.18)', rippleDanger: 'rgba(178,44,58,0.15)',
  accentBorder: 'rgba(88, 66, 182, 0.35)', accentBorderSubtle: 'rgba(88, 66, 182, 0.3)',
  accentBorderStrong: 'rgba(88, 66, 182, 0.4)', accentBorderChip: 'rgba(88, 66, 182, 0.45)',
  accentBorderFocus: 'rgba(88, 66, 182, 0.55)', blueBorder: 'rgba(36, 86, 166, 0.25)',
  blueFill: 'rgba(36, 86, 166, 0.18)', dangerBorder: 'rgba(178, 44, 58, 0.35)',
  pausedSoft: 'rgba(80, 80, 102, 0.10)', successSoft: 'rgba(20, 107, 67, 0.10)',
  planHighlight: '#ECE8FC', achievementSummary: '#F0EDFC', achievementSummaryBorder: '#CFC6EC',
  achievementEncouragement: '#51408A', achievementEarned: '#F0EDFC', achievementEarnedBorder: '#B5A7DD',
  achievementHero: '#ECE7FA', achievementHeroBorder: '#C9BDE7', achievementEyebrow: '#2456A6',
  achievementTotal: '#5842B6', link: '#2456A6', splashBackground: '#F7F7FC',
};

export type AppScheme = 'light' | 'dark';
export const Palettes: Readonly<Record<AppScheme, AppPalette>> = Object.freeze({
  dark: Object.freeze(dark), light: Object.freeze(light),
});

/** A preview never applies stored requests or device appearance while the release gate is closed. */
export function appliedScheme(preview: AppScheme | null, development: boolean): AppScheme {
  return development && preview ? preview : ACTIVE_PRESENTATION.scheme;
}
