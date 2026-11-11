import { usePreferences } from '@/hooks/use-preferences';
import { translate } from '@/i18n/translate';
import type { MessageKey } from '@/i18n/types';
import { languageDirection } from '@/utils/presentation';
import { usePresentationLanguage } from './use-presentation-language';

/** Render the language applied only after validated hydration or a successful save. */
export function useLanguage() {
  const { preferences } = usePreferences();
  const language = usePresentationLanguage();
  return {
    selectedLanguage: preferences.language,
    requestedDirection: languageDirection(preferences.language),
    language,
    direction: languageDirection(language),
    t: (key: MessageKey) => translate(language, key),
  };
}
