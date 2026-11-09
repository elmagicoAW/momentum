import { HabitForm } from '@/components/habits/habit-form';
import { HabitReminderSection, reportReminderOutcome } from '@/components/reminders/editor-reminders';
import { useHabits } from '@/hooks/use-habits';
import { useReminderDraft } from '@/hooks/use-reminder-draft';
import { NEW_HABIT_DRAFT } from '@/utils/habit-validation';
import { closeHabitEditor } from '@/utils/navigation';
import { DEFAULT_HABIT_REMINDER_TIME } from '@/utils/reminder-time';

export default function NewHabitScreen() {
  const { createHabit } = useHabits();
  const reminder = useReminderDraft('habit', null);

  return (
    <HabitForm
      title="New habit"
      submitLabel="Create"
      initialDraft={NEW_HABIT_DRAFT}
      onCancel={closeHabitEditor}
      onSubmit={async (input) => {
        const habit = await createHabit(input); // throws on failure → form stays open with an error
        // The habit is saved from here on: never throw (a retry would create a duplicate).
        const outcome = await reminder.saveFor(habit.id);
        closeHabitEditor();
        reportReminderOutcome('habit', outcome);
      }}
      renderReminder={(draft, locked) => (
        <HabitReminderSection
          habitId={null}
          draft={draft}
          value={reminder.valueFor(DEFAULT_HABIT_REMINDER_TIME)}
          onChange={reminder.setDraft}
          locked={locked}
        />
      )}
    />
  );
}
