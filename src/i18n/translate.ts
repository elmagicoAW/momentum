import type { Language } from '@/data/preferences-storage';
import { ar } from '@/i18n/ar';
import { en } from '@/i18n/en';
import { enMessages } from '@/i18n/en-messages';
import { arMessages } from '@/i18n/ar-messages';
import { entryParameters, templateParameters, type CatalogInput, type TemplateEntry } from '@/i18n/catalog';
import { formatNumber, pluralCategory } from '@/i18n/format';
import type { MessageDescriptor, MessageKey, MessageParams, TemplateKey } from '@/i18n/types';

export type LocalizationIssue = 'missing-key' | 'invalid-language' | 'missing-parameter' |
  'unexpected-parameter' | 'invalid-parameter' | 'invalid-template' | 'missing-plural-form';
export class LocalizationError extends Error {
  readonly code: LocalizationIssue;
  constructor(code: LocalizationIssue) { super(`Localization: ${code}`); this.name = 'LocalizationError'; this.code = code; }
}
const numericParameters = new Set(['count', 'completed', 'total', 'position', 'limit', 'minimum', 'maximum']);
const own = (object: object, key: string) => Object.hasOwn(object, key);

/** Injection is for catalog tests; no persistence, locale discovery or native/global state. */
export function createTranslator(options: {
  strict?: boolean;
  onDiagnostic?: (issue: LocalizationIssue) => void;
  labels?: Partial<Record<Language, Readonly<Record<string, string>>>>;
  messages?: Partial<Record<Language, CatalogInput>>;
} = {}) {
  const labels = options.labels ?? { en, ar };
  const messages = options.messages ?? { en: enMessages, ar: arMessages };
  const problem = (code: LocalizationIssue) => {
    options.onDiagnostic?.(code);
    if (typeof __DEV__ !== 'undefined' && __DEV__) console.warn(`[momentum:i18n] ${code}`);
    if (options.strict) throw new LocalizationError(code);
  };
  const locale = (language: Language): Language => {
    if (language === 'en' || language === 'ar') return language;
    problem('invalid-language'); return 'en';
  };
  const fallback = () => en['errors.unexpected'];
  const label = (language: Language, key: MessageKey): string => {
    const requested = labels[locale(language)];
    if (requested && own(requested, key) && typeof requested[key] === 'string' && requested[key].trim()) return requested[key];
    problem('missing-key');
    return own(en, key) ? en[key] : fallback();
  };
  const render = (language: Language, key: TemplateKey, input: unknown): string => {
    let displayLanguage = locale(language);
    if (!own(enMessages, key)) { problem('missing-key'); return fallback(); }
    const reference: TemplateEntry = enMessages[key];
    const expected = entryParameters(reference);
    if (!input || typeof input !== 'object' || Array.isArray(input)) { problem('missing-parameter'); return fallback(); }
    const params = input as Record<string, unknown>;
    if (expected.some((name) => !own(params, name))) { problem('missing-parameter'); return fallback(); }
    if (Object.keys(params).some((name) => !expected.includes(name))) { problem('unexpected-parameter'); return fallback(); }
    for (const name of expected) {
      const value = params[name];
      if (numericParameters.has(name) ? typeof value !== 'number' || !Number.isFinite(value) : typeof value !== 'string') {
        problem('invalid-parameter'); return fallback();
      }
    }
    if (typeof reference !== 'string' && (params.count as number) < 0) { problem('invalid-parameter'); return fallback(); }
    let entry: TemplateEntry | undefined = messages[displayLanguage]?.[key];
    if (!messages[displayLanguage] || !own(messages[displayLanguage]!, key) || typeof entry !== typeof reference) {
      problem('missing-key'); entry = reference; displayLanguage = 'en';
    }
    try {
      if (!entry || entryParameters(entry).join() !== expected.join()) {
        problem('invalid-template'); entry = reference; displayLanguage = 'en';
      }
    } catch (error) {
      if (error instanceof LocalizationError) throw error;
      problem('invalid-template'); entry = reference; displayLanguage = 'en';
    }
    let text: string | undefined;
    if (typeof entry === 'string') text = entry;
    else {
      const category = pluralCategory(displayLanguage, params.count as number);
      text = entry?.[category];
      if (!text) {
        problem('missing-plural-form'); displayLanguage = 'en';
        text = (reference as Exclude<TemplateEntry, string>)[pluralCategory('en', params.count as number)];
      }
    }
    try {
      if (!text?.trim() || templateParameters(text).some((name) => !expected.includes(name))) {
        problem('invalid-template'); return fallback();
      }
    } catch (error) {
      if (error instanceof LocalizationError) throw error;
      problem('invalid-template'); return fallback();
    }
    // A callback replacement inserts text literally ($&, braces and markup are never evaluated).
    return text.replace(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (_, name: string) =>
      typeof params[name] === 'number' ? formatNumber(displayLanguage, params[name]) : params[name] as string);
  };
  function message<K extends TemplateKey>(language: Language, key: K, params: MessageParams<NoInfer<K>>): string {
    return render(language, key, params);
  }
  const descriptor = (language: Language, value: MessageDescriptor): string => {
    if (!value || typeof value !== 'object' || typeof value.key !== 'string') { problem('missing-key'); return fallback(); }
    if (own(enMessages, value.key)) return render(language, value.key as TemplateKey, value.params);
    if (value.params !== undefined) { problem('unexpected-parameter'); return fallback(); }
    return label(language, value.key as MessageKey);
  };
  return { label, message, descriptor };
}
const translator = createTranslator();
export const translate = translator.label;
export const formatMessage = translator.message;
export const translateMessage = translator.descriptor;
