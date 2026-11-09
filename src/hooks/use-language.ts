import { usePreferences } from '@/hooks/use-preferences';
import { translate } from '@/i18n/translate';
import type { MessageKey } from '@/i18n/types';
import { ACTIVE_PRESENTATION, languageDirection } from '@/utils/presentation';

const t = (key: MessageKey) => translate(ACTIVE_PRESENTATION.language, key);
/** Stored language is not applied until whole-app localization and QA are approved. */
export function useLanguage() {
  const { preferences } = usePreferences();
  return {
    selectedLanguage: preferences.language,
    requestedDirection: languageDirection(preferences.language),
    language: ACTIVE_PRESENTATION.language,
    direction: ACTIVE_PRESENTATION.direction,
    t,
  };
}
