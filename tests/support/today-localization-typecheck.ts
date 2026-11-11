// Compile-time coverage for migrated Today messages; never executed by the application.
import { todayMessage, todayRich } from '../../src/i18n/today';

export function todayLocalizationTypes() {
  todayMessage('en', 'today.countValueUnit', { value: 1, target: 8, unit: 'glasses' });
  todayRich('en', 'today.greetingLine', { greeting: 'Good morning', name: 'Name' }, 'name');
  // @ts-expect-error Count target is numeric, never a preformatted string.
  todayMessage('ar', 'today.countValueUnit', { value: 1, target: '٨', unit: 'أكواب' });
  // @ts-expect-error All required named parameters must be provided.
  todayMessage('en', 'today.plan.summary', { count: 1, action: 'Manage' });
  // @ts-expect-error Numeric values cannot be selected as rich text string slots.
  todayRich('en', 'today.ringCounter', { completed: 1, denominator: '/2' }, 'completed');
}
