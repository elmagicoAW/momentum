import type { Language } from '@/data/preferences-storage';
import { ar } from '@/i18n/ar';
import { en } from '@/i18n/en';
import type { Dictionary, MessageDescriptor, MessageKey } from '@/i18n/types';

const dictionaries: Record<Language, Dictionary> = { en, ar };
export function translate(language: Language, key: MessageKey): string {
  return dictionaries[language][key] ?? en[key];
}
export function translateMessage(language: Language, message: MessageDescriptor): string {
  return translate(language, message.key);
}
