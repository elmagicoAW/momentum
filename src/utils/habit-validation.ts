import { normalizeDays, type HabitInput, type Weekday } from '@/data/habit-storage';

export const NAME_MAX_LENGTH = 40;
export const DESCRIPTION_MAX_LENGTH = 120;

/** Raw form state, before trimming and normalization. */
export type HabitDraft = {
  name: string;
  description: string;
  icon: string;
  color: string;
  scheduleKind: 'daily' | 'weekdays';
  days: Weekday[];
};

export type HabitDraftErrors = Partial<Record<'name' | 'description' | 'schedule', string>>;

export function validateHabitDraft(draft: HabitDraft): HabitDraftErrors {
  const errors: HabitDraftErrors = {};
  const name = draft.name.trim();
  if (name.length === 0) errors.name = 'Give your habit a name.';
  else if (name.length > NAME_MAX_LENGTH) errors.name = `Keep the name under ${NAME_MAX_LENGTH} characters.`;

  if (draft.description.trim().length > DESCRIPTION_MAX_LENGTH) {
    errors.description = `Keep the description under ${DESCRIPTION_MAX_LENGTH} characters.`;
  }

  if (draft.scheduleKind === 'weekdays' && draft.days.length === 0) {
    errors.schedule = 'Pick at least one day.';
  }
  return errors;
}

export function hasErrors(errors: HabitDraftErrors): boolean {
  return Object.keys(errors).length > 0;
}

/** Trimmed, normalized input ready to save. Call only after validation passes. */
export function draftToInput(draft: HabitDraft): HabitInput {
  const description = draft.description.trim();
  return {
    name: draft.name.trim(),
    ...(description ? { description } : {}),
    icon: draft.icon,
    color: draft.color,
    schedule:
      draft.scheduleKind === 'daily'
        ? { kind: 'daily' }
        : { kind: 'weekdays', days: normalizeDays(draft.days) },
  };
}
