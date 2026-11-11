import type { PreferencesErrorCode } from '@/data/preferences-storage';
import type { en } from '@/i18n/en';
import type { enMessages } from '@/i18n/en-messages';

export type MessageKey = keyof typeof en;
export type Dictionary = Readonly<Record<MessageKey, string>>;
export type PluralCategory = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other';
export type TemplateKey = keyof typeof enMessages;
type Placeholders<T extends string> = T extends `${string}{${infer Name}}${infer Rest}` ? Name | Placeholders<Rest> : never;
type Entry = (typeof enMessages)[TemplateKey];
type EntryText<T extends Entry> = T extends string ? T : T[keyof T] & string;
type ParameterNames<K extends TemplateKey> = Placeholders<EntryText<(typeof enMessages)[K]>> |
  ((typeof enMessages)[K] extends string ? never : 'count');
export const NUMERIC_PARAMETERS = ['count', 'completed', 'total', 'position', 'limit', 'minimum', 'maximum',
  'value', 'target', 'percent', 'requiredDone', 'requiredTotal', 'done', 'steps'] as const;
type NumericParameter = typeof NUMERIC_PARAMETERS[number];
export type MessageParams<K extends TemplateKey> = Readonly<{
  [P in ParameterNames<K>]: P extends NumericParameter ? number : string;
}>;
export type TemplateDictionary<L extends 'en' | 'ar'> = Readonly<{
  [K in TemplateKey]: (typeof enMessages)[K] extends string ? string :
    Readonly<Record<L extends 'ar' ? PluralCategory : 'one' | 'other', string>>;
}>;
export type StaticMessageDescriptor = Readonly<{ key: MessageKey; params?: never }>;
export type TemplateMessageDescriptor = {
  [K in TemplateKey]: Readonly<{ key: K; params: MessageParams<K> }>;
}[TemplateKey];
export type MessageDescriptor = StaticMessageDescriptor | TemplateMessageDescriptor;
export const preferenceErrorMessage = (code: PreferencesErrorCode): StaticMessageDescriptor => ({ key: `preferences.${code}` });
