"use no memo"; // Keep external locale reads live; explicit domain memos remain intact.
import { appLabel } from '@/i18n/app-copy';
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
      title={appLabel("goals.new.newGoal")}
      submitLabel={appLabel("goals.new.create")}
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
