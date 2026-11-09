import { GoalForm } from '@/components/goals/goal-form';
import { useCurrentDate } from '@/hooks/use-current-date';
import { useGoals } from '@/hooks/use-goals';
import { addMonths, toLocalDateKey } from '@/utils/date';
import { closeGoalEditor } from '@/utils/navigation';

export default function NewGoalScreen() {
  const { createGoal } = useGoals();
  const now = useCurrentDate();

  return (
    <GoalForm
      title="New goal"
      submitLabel="Create"
      todayKey={toLocalDateKey(now)}
      initialDraft={{
        title: '',
        description: '',
        targetDate: toLocalDateKey(addMonths(now, 3)),
        status: 'active',
        habitIds: [],
      }}
      onCancel={closeGoalEditor}
      onSubmit={async (input) => {
        await createGoal(input); // throws on failure → form stays open with an error
        closeGoalEditor();
      }}
    />
  );
}
