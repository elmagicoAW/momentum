// Compiled by the project's normal tsc check; never executed or bundled by the app.
import { formatMessage, translate, translateMessage } from '../../src/i18n/translate';
import type { MessageDescriptor, TemplateDictionary } from '../../src/i18n/types';

export function localizationTypeContract() {
  formatMessage('ar', 'today.progress', { completed: 1, total: 3 });
  formatMessage('ar', 'habits.count', { count: 2 });
  translate('en', 'navigation.today');
  translateMessage('ar', { key: 'accessibility.profileNamed', params: { name: 'اسم' } });
  // @ts-expect-error Both named progress parameters are required.
  formatMessage('en', 'today.progress', { completed: 1 });
  // @ts-expect-error Cardinal count is numeric, never preformatted display text.
  formatMessage('ar', 'habits.count', { count: '٢' });
  // @ts-expect-error Extra parameters are rejected on literal calls.
  formatMessage('en', 'habits.count', { count: 1, unused: true });
  // @ts-expect-error Names cannot be positional or misspelled.
  formatMessage('en', 'accessibility.profileNamed', { username: 'Name' });
  // @ts-expect-error Parameterized messages cannot use the fixed-label API.
  translate('en', 'today.progress');
  // @ts-expect-error Unknown semantic keys are rejected.
  translate('en', 'navigation.unknown');
  // @ts-expect-error Descriptors must pair a key with that key's required parameters.
  const invalidDescriptor: MessageDescriptor = { key: 'today.progress', params: { count: 1 } };
  // @ts-expect-error Arabic cardinal messages require all six forms.
  const incompleteArabic: TemplateDictionary<'ar'>['habits.count'] = { one: 'واحدة', other: 'عادات' };
  return { invalidDescriptor, incompleteArabic };
}
