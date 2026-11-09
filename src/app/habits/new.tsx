import { HabitForm } from '@/components/habits/habit-form';
import { DEFAULT_HABIT_COLOR, DEFAULT_HABIT_ICON } from '@/data/habit-options';
import { useHabits } from '@/hooks/use-habits';
import { closeHabitEditor } from '@/utils/navigation';

export default function NewHabitScreen() {
  const { createHabit } = useHabits();

  return (
    <HabitForm
      title="New habit"
      submitLabel="Create"
      initialDraft={{
        name: '',
        description: '',
        icon: DEFAULT_HABIT_ICON,
        color: DEFAULT_HABIT_COLOR,
        scheduleKind: 'daily',
        days: [1, 2, 3, 4, 5],
      }}
      onCancel={closeHabitEditor}
      onSubmit={async (input) => {
        await createHabit(input); // throws on failure → form stays open with an error
        closeHabitEditor();
      }}
    />
  );
}
