import { useSyncExternalStore } from 'react';
import { getPresentationLanguage, subscribePresentationLanguage } from '@/utils/presentation';
export function usePresentationLanguage() {
  return useSyncExternalStore(subscribePresentationLanguage, getPresentationLanguage, () => 'en' as const);
}
