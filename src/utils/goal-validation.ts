import type { GoalInput, GoalStatus } from '@/data/goal-storage';

export const GOAL_TITLE_MAX_LENGTH = 60;
export const GOAL_DESCRIPTION_MAX_LENGTH = 200;

/** Raw form state, before trimming. */
export type GoalDraft = {
  title: string;
  description: string;
  /** "YYYY-MM-DD" or null when not picked yet. */
  targetDate: string | null;
  status: GoalStatus;
  habitIds: string[];
};

export type GoalDraftErrors = Partial<Record<'title' | 'description' | 'targetDate', string>>;

type Context = {
  todayKey: string;
  /** Edit mode: the goal's start date and the target date it was saved with. */
  startDate?: string;
  savedTargetDate?: string;
};

export function validateGoalDraft(draft: GoalDraft, { todayKey, startDate, savedTargetDate }: Context): GoalDraftErrors {
  const errors: GoalDraftErrors = {};
  const title = draft.title.trim();
  if (title.length === 0) errors.title = 'Give your goal a title.';
  else if (title.length > GOAL_TITLE_MAX_LENGTH) errors.title = `Keep the title under ${GOAL_TITLE_MAX_LENGTH} characters.`;

  if (draft.description.trim().length > GOAL_DESCRIPTION_MAX_LENGTH) {
    errors.description = `Keep the description under ${GOAL_DESCRIPTION_MAX_LENGTH} characters.`;
  }

  if (!draft.targetDate) {
    errors.targetDate = 'Pick a target date.';
  } else if (startDate && draft.targetDate < startDate) {
    errors.targetDate = 'The target date can’t be before the goal started.';
  } else if (draft.targetDate < todayKey && draft.targetDate !== savedTargetDate) {
    // A past date is only allowed if the goal was already saved with it.
    errors.targetDate = 'Pick today or a future date.';
  }
  return errors;
}

export function hasGoalErrors(errors: GoalDraftErrors): boolean {
  return Object.keys(errors).length > 0;
}

/**
 * Trimmed input ready to save. Call only after validation passes.
 * Links to habits that no longer exist are dropped here.
 */
export function goalDraftToInput(draft: GoalDraft, existingHabitIds: ReadonlySet<string>): GoalInput {
  const description = draft.description.trim();
  return {
    title: draft.title.trim(),
    ...(description ? { description } : {}),
    targetDate: draft.targetDate as string,
    status: draft.status,
    habitIds: [...new Set(draft.habitIds)].filter((id) => existingHabitIds.has(id)),
  };
}
