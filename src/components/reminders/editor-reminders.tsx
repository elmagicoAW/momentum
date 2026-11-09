import { ReminderField, type OverlapNote, type ReminderDraft } from '@/components/reminders/reminder-field';
import type { Weekday } from '@/data/habit-storage';
import type { Routine } from '@/data/routine-storage';
import { useHabits } from '@/hooks/use-habits';
import type { ReminderSaveOutcome } from '@/hooks/use-reminder-draft';
import { useReminders } from '@/hooks/use-reminders';
import { useRoutines } from '@/hooks/use-routines';
import { showNotice } from '@/utils/alert';
import { routineDueWeekdays } from '@/utils/reminder-plan';
import { describeSchedule } from '@/utils/schedule';
import type { HabitDraft } from '@/utils/habit-validation';
import type { RoutineDraft } from '@/utils/routine-validation';

function describeDays(days: readonly Weekday[]): string | null {
  return days.length === 0 ? null : describeSchedule({ kind: 'weekdays', days: [...days] });
}

type SectionProps = {
  value: ReminderDraft;
  onChange: (value: ReminderDraft) => void;
  locked: boolean;
};

/** Reminder control inside the habit editor. Days follow the draft schedule live. */
export function HabitReminderSection({ habitId, draft, ...rest }: SectionProps & { habitId: string | null; draft: HabitDraft }) {
  const { routines } = useRoutines();
  const { settings } = useReminders();

  const days: Weekday[] = draft.scheduleKind === 'daily' ? [0, 1, 2, 3, 4, 5, 6] : draft.days;
  const overlaps: OverlapNote[] =
    habitId && settings.enabled
      ? routines
          .filter((r) => r.habitIds.includes(habitId) && settings.routines[r.id]?.enabled)
          .map((r) => ({ name: r.title, time: settings.routines[r.id].time }))
      : [];

  return (
    <ReminderField
      noun="habit"
      value={rest.value}
      onChange={rest.onChange}
      daysLabel={describeDays(days)}
      overlaps={overlaps}
      disabled={rest.locked}
    />
  );
}

/** Reminder control inside the routine editor. Days follow the draft's habits live. */
export function RoutineReminderSection({ draft, ...rest }: SectionProps & { draft: RoutineDraft }) {
  const { habits } = useHabits();
  const { settings } = useReminders();

  const habitsById = new Map(habits.map((h) => [h.id, h]));
  const days = routineDueWeekdays({ habitIds: draft.habitIds } as Routine, habitsById);
  const overlaps: OverlapNote[] = settings.enabled
    ? draft.habitIds
        .map((id) => habitsById.get(id))
        .filter((h) => h !== undefined && settings.habits[h.id]?.enabled)
        .map((h) => ({ name: h!.name, time: settings.habits[h!.id].time }))
    : [];

  return (
    <ReminderField
      noun="routine"
      value={rest.value}
      onChange={rest.onChange}
      daysLabel={describeDays(days)}
      overlaps={overlaps}
      disabled={rest.locked}
    />
  );
}

/**
 * After the habit/routine itself was saved: if its reminder couldn't be saved,
 * say so plainly instead of implying everything was saved.
 */
export function reportReminderOutcome(noun: 'habit' | 'routine', outcome: ReminderSaveOutcome) {
  if (outcome !== 'failed') return;
  const Noun = noun === 'habit' ? 'Habit' : 'Routine';
  showNotice(
    `${Noun} saved, reminder not saved`,
    `Your ${noun} was saved, but its reminder setting couldn’t be saved, so the previous reminder setting is still in place. ` +
      `Try again from Settings › Reminders or by editing the ${noun}.`,
  );
}
