import { HabitForm } from '@/components/habits/habit-form';
import { useHabits } from '@/hooks/use-habits';
import { NEW_HABIT_DRAFT } from '@/utils/habit-validation';
import { closeHabitEditor } from '@/utils/navigation';

export default function NewHabitScreen() {
  const { createHabit } = useHabits();

  return (
    <HabitForm
      title="New habit"
      submitLabel="Create"
      initialDraft={NEW_HABIT_DRAFT}
      onCancel={closeHabitEditor}
      onSubmit={async (input) => {
        await createHabit(input); // throws on failure → form stays open with an error
        closeHabitEditor();
      }}
    />
  );
}
