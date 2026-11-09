import type { PreferencesErrorCode } from '@/data/preferences-storage';
import type { en } from '@/i18n/en';

export type MessageKey = keyof typeof en;
export type Dictionary = Readonly<Record<MessageKey, string>>;
export type MessageDescriptor = Readonly<{ key: MessageKey }>;
export const preferenceErrorMessage = (code: PreferencesErrorCode): MessageDescriptor => ({ key: `preferences.${code}` });
