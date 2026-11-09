import { RoutineForm } from '@/components/routines/routine-form';
import { DEFAULT_HABIT_COLOR, DEFAULT_HABIT_ICON } from '@/data/habit-options';
import { useRoutines } from '@/hooks/use-routines';
import { closeRoutineEditor } from '@/utils/navigation';

export default function NewRoutineScreen() {
  const { createRoutine } = useRoutines();

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
        await createRoutine(input); // throws on failure → form stays open with an error
        closeRoutineEditor();
      }}
    />
  );
}
