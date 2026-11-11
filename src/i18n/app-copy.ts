import { ACTIVE_PRESENTATION } from '@/utils/presentation';
import { createTranslator, translate, translateMessage } from './translate';
import type { MessageDescriptor, MessageKey, MessageParams, TemplateKey } from './types';
import { formatNumber as localizedNumber } from './format';

// Single existing language gate, also safe before preferences mount during recovery.
const translator = createTranslator({ numberFormat: (language, value) => language === 'en' ? String(value) : localizedNumber(language, value) });
export const appLabel = (key: MessageKey) => translate(ACTIVE_PRESENTATION.language, key);
export const appNumber = (value: number) => ACTIVE_PRESENTATION.language === 'en' ? String(value) : localizedNumber(ACTIVE_PRESENTATION.language, value);
export const appMessage = <K extends TemplateKey>(key: K, params: MessageParams<NoInfer<K>>) => translator.message(ACTIVE_PRESENTATION.language, key, params);
/** One styled Text slot, inserted literally and allowed to move with the sentence. */
export function appRich<K extends TemplateKey>(key: K, params: MessageParams<NoInfer<K>>, slot: keyof MessageParams<K>) {
  const slotValue = params[slot];
  if (typeof slotValue !== 'string') throw new TypeError('Rich message slot must be text');
  let token = '\u0000localized-slot\u0000';
  while (Object.values(params).some(value => typeof value === 'string' && value.includes(token))) token += '\u0000';
  return { parts: appMessage(key, { ...params, [slot]: token }).split(token), slotValue };
}

// Attach a descriptor to the original exception: class, message, identity and safety classification survive.
const descriptors = new WeakMap<Error, MessageDescriptor>();
export function withErrorMessage<T extends Error>(error: T, descriptor: MessageDescriptor): T {
  descriptors.set(error, descriptor);
  return error;
}
export function displayError(error: unknown, fallback: string): string {
  const descriptor = error instanceof Error ? descriptors.get(error) : undefined;
  return descriptor ? translateMessage(ACTIVE_PRESENTATION.language, descriptor) : fallback;
}
