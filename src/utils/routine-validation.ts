import { appLabel, appMessage } from '@/i18n/app-copy';
import {
  MAX_HABITS_PER_ROUTINE,
  ROUTINE_DESCRIPTION_MAX_LENGTH,
  ROUTINE_TITLE_MAX_LENGTH,
  type RoutineInput,
  type TimeOfDay,
} from '@/data/routine-storage';

/** Raw form state, before trimming. */
export type RoutineDraft = {
  title: string;
  description: string;
  icon: string;
  color: string;
  timeOfDay: TimeOfDay;
  habitIds: string[];
};

export type RoutineDraftErrors = Partial<Record<'title' | 'description' | 'habitIds', string>>;

/** Only habits that still exist count toward the limit (deleted ones are dropped on save). */
export function validateRoutineDraft(draft: RoutineDraft, existingHabitIds: ReadonlySet<string>): RoutineDraftErrors {
  const errors: RoutineDraftErrors = {};
  const title = draft.title.trim();
  if (title.length === 0) errors.title = appLabel("routine-validation.giveYourRoutineATitle");
  else if (title.length > ROUTINE_TITLE_MAX_LENGTH) {
    errors.title = appMessage("validation.routine.titleLength", { limit: (ROUTINE_TITLE_MAX_LENGTH) });
  }
  if (draft.description.trim().length > ROUTINE_DESCRIPTION_MAX_LENGTH) {
    errors.description = appMessage("validation.routine.descriptionLength", { limit: (ROUTINE_DESCRIPTION_MAX_LENGTH) });
  }
  const linked = new Set(draft.habitIds.filter((id) => existingHabitIds.has(id)));
  if (linked.size > MAX_HABITS_PER_ROUTINE) {
    errors.habitIds = appMessage("validation.routine.habitLimitSentence", { limit: (MAX_HABITS_PER_ROUTINE) });
  }
  return errors;
}

export function hasRoutineErrors(errors: RoutineDraftErrors): boolean {
  return Object.keys(errors).length > 0;
}

/**
 * Trimmed input ready to save. Call only after validation passes.
 * IDs of habits that no longer exist are dropped here (stale-reference cleanup).
 */
export function routineDraftToInput(draft: RoutineDraft, existingHabitIds: ReadonlySet<string>): RoutineInput {
  const description = draft.description.trim();
  return {
    title: draft.title.trim(),
    ...(description ? { description } : {}),
    icon: draft.icon,
    color: draft.color,
    timeOfDay: draft.timeOfDay,
    habitIds: [...new Set(draft.habitIds)].filter((id) => existingHabitIds.has(id)),
  };
}
