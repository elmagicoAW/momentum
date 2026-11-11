import { en } from '@/i18n/en';
import { ar } from '@/i18n/ar';
import { enMessages } from '@/i18n/en-messages';
import { arMessages } from '@/i18n/ar-messages';

export type TemplateEntry = string | Readonly<Partial<Record<'zero' | 'one' | 'two' | 'few' | 'many' | 'other', string>>>;
export type CatalogInput = Readonly<Record<string, TemplateEntry>>;
export const pluralCategories = Object.freeze(['zero', 'one', 'two', 'few', 'many', 'other'] as const);

/** Only simple named placeholders are supported; no evaluation, ICU parser or recursive substitution. */
export function templateParameters(template: string): string[] {
  const names = [...template.matchAll(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g)].map((match) => match[1]);
  if (/[{}]/.test(template.replace(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g, ''))) throw new Error('Invalid message placeholder');
  return [...new Set(names)].sort();
}
export function entryParameters(entry: TemplateEntry): string[] {
  return typeof entry === 'string' ? templateParameters(entry) :
    [...new Set(['count', ...Object.values(entry).flatMap((text) => templateParameters(text))])].sort();
}

/** Test/build-time contract validation. Never rewrites a catalog or user record. */
export function catalogIssues(
  englishLabels: Readonly<Record<string, string>> = en,
  arabicLabels: Readonly<Record<string, string>> = ar,
  englishMessages: CatalogInput = enMessages,
  arabicMessages: CatalogInput = arMessages,
): string[] {
  const issues: string[] = [];
  const parity = (a: object, b: object, group: string) => {
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (!Object.hasOwn(a, key) || !Object.hasOwn(b, key)) issues.push(`${group}:${key}:key-parity`);
    }
  };
  parity(englishLabels, arabicLabels, 'label'); parity(englishMessages, arabicMessages, 'message');
  for (const labels of [englishLabels, arabicLabels]) for (const [key, text] of Object.entries(labels)) {
    if (typeof text !== 'string' || !text.trim()) issues.push(`label:${key}:empty`);
    else if (/[{}]/.test(text)) issues.push(`label:${key}:use-parameterized-message`);
    if (Object.hasOwn(englishMessages, key) || Object.hasOwn(arabicMessages, key)) issues.push(`${key}:duplicate-key`);
  }
  for (const key of Object.keys(englishMessages)) {
    const reference = englishMessages[key];
    if (!Object.hasOwn(arabicMessages, key)) continue;
    const translated = arabicMessages[key];
    if (typeof reference !== typeof translated) { issues.push(`message:${key}:shape`); continue; }
    try {
      const expected = entryParameters(reference);
      if (expected.join() !== entryParameters(translated).join()) issues.push(`message:${key}:parameter-parity`);
      for (const [language, entry] of [['en', reference], ['ar', translated]] as const) {
        if (typeof entry === 'string') {
          if (!entry.trim()) issues.push(`message:${key}:empty`);
        } else {
          const required = language === 'ar' ? pluralCategories : ['one', 'other'];
          if (required.some((category) => !Object.hasOwn(entry, category))) issues.push(`message:${key}:${language}:plural-forms`);
          for (const [category, text] of Object.entries(entry)) {
            if (!pluralCategories.includes(category as typeof pluralCategories[number])) issues.push(`message:${key}:unknown-plural-form`);
            if (typeof text !== 'string' || !text.trim()) issues.push(`message:${key}:${category}:empty`);
            else if (templateParameters(text).some((name) => !expected.includes(name))) issues.push(`message:${key}:${category}:unexpected-parameter`);
          }
        }
      }
    } catch { issues.push(`message:${key}:invalid-template`); }
  }
  return issues;
}
