import type { Appearance, Language } from '@/data/preferences-storage';

let appliedLanguage: Language = 'en';
const listeners = new Set<() => void>();
/** Changed only by the validated preferences store after hydration or successful persistence. */
export function applyPresentationLanguage(language: Language) {
  if (appliedLanguage === language) return;
  appliedLanguage = language;
  listeners.forEach(listener => listener());
}
export const getPresentationLanguage = () => appliedLanguage;
export const subscribePresentationLanguage = (listener: () => void) => {
  listeners.add(listener); return () => { listeners.delete(listener); };
};
export const ACTIVE_PRESENTATION = Object.freeze({ scheme: 'dark' as const,
  get language(): Language { return appliedLanguage; },
  get direction(): 'ltr' | 'rtl' { return languageDirection(appliedLanguage); },
});
export function resolveAppearance(appearance: Appearance, deviceScheme: 'light' | 'dark' | null | undefined): 'light' | 'dark' {
  return appearance === 'system' ? deviceScheme ?? 'dark' : appearance;
}
export function languageDirection(language: Language): 'ltr' | 'rtl' {
  return language === 'ar' ? 'rtl' : 'ltr';
}
