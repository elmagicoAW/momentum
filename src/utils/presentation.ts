import type { Appearance, Language } from '@/data/preferences-storage';

// Phase 2 release gate: stored requests MUST NOT activate unfinished UI migrations.
export const ACTIVE_PRESENTATION = Object.freeze({ scheme: 'dark', language: 'en', direction: 'ltr' } as const);
export function resolveAppearance(appearance: Appearance, deviceScheme: 'light' | 'dark' | null | undefined): 'light' | 'dark' {
  return appearance === 'system' ? deviceScheme ?? 'dark' : appearance;
}
export function languageDirection(language: Language): 'ltr' | 'rtl' {
  return language === 'ar' ? 'rtl' : 'ltr';
}
