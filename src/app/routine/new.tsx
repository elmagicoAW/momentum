import { reportReminderOutcome, RoutineReminderSection } from '@/components/reminders/editor-reminders';
import { RoutineForm } from '@/components/routines/routine-form';
import { DEFAULT_HABIT_COLOR, DEFAULT_HABIT_ICON } from '@/data/habit-options';
import { useReminderDraft } from '@/hooks/use-reminder-draft';
import { useRoutines } from '@/hooks/use-routines';
import { closeRoutineEditor } from '@/utils/navigation';
import { ROUTINE_DEFAULT_TIMES } from '@/utils/reminder-time';

export default function NewRoutineScreen() {
  const { createRoutine } = useRoutines();
  const reminder = useReminderDraft('routine', null);

  return (
    <RoutineForm
      title="New routine"
      submitLabel="Create"
      initialDraft={{
        title: '',
        description: '',
        icon: DEFAULT_HABIT_ICON,
        color: DEFAULT_HABIT_COLOR,
        timeOfDay: 'anytime',
        habitIds: [],
      }}
      onCancel={closeRoutineEditor}
      onSubmit={async (input) => {
        const routine = await createRoutine(input); // throws on failure → form stays open with an error
        // The routine is saved from here on: never throw (a retry would create a duplicate).
        const outcome = await reminder.saveFor(routine.id);
        closeRoutineEditor();
        reportReminderOutcome('routine', outcome);
      }}
      renderReminder={(draft, locked) => (
        <RoutineReminderSection
          draft={draft}
          value={reminder.valueFor(ROUTINE_DEFAULT_TIMES[draft.timeOfDay])}
          onChange={reminder.setDraft}
          locked={locked}
        />
      )}
    />
  );
}
