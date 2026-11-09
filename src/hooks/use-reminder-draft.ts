import { useState } from 'react';

import type { ReminderDraft } from '@/components/reminders/reminder-field';
import type { ReminderKind } from '@/data/reminder-storage';
import { useReminders } from '@/hooks/use-reminders';
import { sameTime, type ReminderTime } from '@/utils/reminder-time';

export type ReminderSaveOutcome = 'unchanged' | 'saved' | 'failed';

/**
 * Reminder draft for a habit/routine editor.
 *
 * Untouched → shows the stored setting (or "off" + a default time) and saves
 * nothing. Only an actual change is written, and only AFTER the habit/routine
 * itself was saved (the caller passes the saved ID). A failed write is
 * reported as 'failed' instead of throwing, so the caller can show a
 * partial-success message without re-saving (and duplicating) the item.
 */
export function useReminderDraft(kind: ReminderKind, id: string | null) {
  const { settings, status, supported, setItemReminder } = useReminders();
  const [draft, setDraft] = useState<ReminderDraft | null>(null);

  const stored = id ? (kind === 'habit' ? settings.habits[id] : settings.routines[id]) : undefined;

  const valueFor = (defaultTime: ReminderTime): ReminderDraft =>
    draft ?? (stored ? { enabled: stored.enabled, time: stored.time } : { enabled: false, time: defaultTime });

  const changed =
    draft !== null &&
    (stored
      ? draft.enabled !== stored.enabled || !sameTime(draft.time, stored.time)
      : draft.enabled); // nothing stored + still off → nothing to save

  const saveFor = async (targetId: string): Promise<ReminderSaveOutcome> => {
    if (!supported || status !== 'ready' || !changed || !draft) return 'unchanged';
    try {
      await setItemReminder(kind, targetId, draft);
      return 'saved';
    } catch (error) {
      console.warn('[momentum] Failed to save reminder', error);
      return 'failed';
    }
  };

  return { valueFor, setDraft, saveFor, changed };
}
