import { appLabel, appMessage } from '@/i18n/app-copy';
import { DEFAULT_HABIT_COLOR, DEFAULT_HABIT_ICON } from '@/data/habit-options';
import {
  CHECKLIST_MAX_STEPS,
  COUNT_TARGET_MAX,
  normalizeDays,
  type Habit,
  type HabitInput,
  type HabitTracking,
  type TrackingType,
  type Weekday,
} from '@/data/habit-storage';

export const NAME_MAX_LENGTH = 40;
export const DESCRIPTION_MAX_LENGTH = 120;
export const UNIT_MAX_LENGTH = 16;
export const STEP_LABEL_MAX_LENGTH = 40;

export type StepDraft = { id: string; label: string; optional: boolean };

/** Raw form state, before trimming and normalization. */
export type HabitDraft = {
  name: string;
  description: string;
  icon: string;
  color: string;
  scheduleKind: 'daily' | 'weekdays';
  days: Weekday[];
  trackingType: TrackingType;
  /** Kept as typed text so the field can be empty while editing. */
  countTarget: string;
  countUnit: string;
  steps: StepDraft[];
};

export type HabitDraftErrors = Partial<
  Record<'name' | 'description' | 'schedule' | 'countTarget' | 'countUnit' | 'steps', string>
>;

export const NEW_HABIT_DRAFT: HabitDraft = {
  name: '',
  description: '',
  icon: DEFAULT_HABIT_ICON,
  color: DEFAULT_HABIT_COLOR,
  scheduleKind: 'daily',
  days: [1, 2, 3, 4, 5],
  trackingType: 'tick',
  countTarget: '8',
  countUnit: '',
  steps: [],
};

export function habitToDraft(habit: Habit): HabitDraft {
  const t = habit.tracking;
  return {
    name: habit.name,
    description: habit.description ?? '',
    icon: habit.icon,
    color: habit.color,
    scheduleKind: habit.schedule.kind,
    days: habit.schedule.kind === 'weekdays' ? habit.schedule.days : [1, 2, 3, 4, 5],
    trackingType: t.type,
    countTarget: t.type === 'count' ? String(t.target) : NEW_HABIT_DRAFT.countTarget,
    countUnit: t.type === 'count' ? t.unit : '',
    steps: t.type === 'checklist' ? t.steps.map((s) => ({ id: s.id, label: s.label, optional: !!s.optional })) : [],
  };
}

/** Whole number 1–9999, or null. */
export function parseCountTarget(text: string): number | null {
  if (!/^\d{1,4}$/.test(text.trim())) return null;
  const n = Number(text.trim());
  return n >= 1 && n <= COUNT_TARGET_MAX ? n : null;
}

export function validateHabitDraft(draft: HabitDraft): HabitDraftErrors {
  const errors: HabitDraftErrors = {};
  const name = draft.name.trim();
  if (name.length === 0) errors.name = appLabel("habit-validation.giveYourHabitAName");
  else if (name.length > NAME_MAX_LENGTH) errors.name = appMessage("validation.habit.nameLength", { limit: (NAME_MAX_LENGTH) });

  if (draft.description.trim().length > DESCRIPTION_MAX_LENGTH) {
    errors.description = appMessage("validation.habit.descriptionLength", { limit: (DESCRIPTION_MAX_LENGTH) });
  }

  if (draft.scheduleKind === 'weekdays' && draft.days.length === 0) {
    errors.schedule = appLabel("habit-validation.pickAtLeastOneDay");
  }

  if (draft.trackingType === 'count') {
    if (parseCountTarget(draft.countTarget) === null) {
      errors.countTarget = appMessage("validation.habit.countRange", { maximum: (COUNT_TARGET_MAX) });
    }
    if (draft.countUnit.trim().length > UNIT_MAX_LENGTH) {
      errors.countUnit = appMessage("validation.habit.unitLength", { limit: (UNIT_MAX_LENGTH) });
    }
  }

  if (draft.trackingType === 'checklist') {
    const steps = draft.steps;
    if (steps.length === 0) errors.steps = appLabel("habit-validation.addAtLeastOneStep");
    else if (steps.length > CHECKLIST_MAX_STEPS) errors.steps = appMessage("validation.habit.stepLimit", { limit: (CHECKLIST_MAX_STEPS) });
    else if (steps.some((s) => s.label.trim().length === 0)) errors.steps = appLabel("habit-validation.nameEveryStepOrRemoveEmptyOnes");
    else if (steps.some((s) => s.label.trim().length > STEP_LABEL_MAX_LENGTH)) {
      errors.steps = appMessage("validation.habit.stepLength", { limit: (STEP_LABEL_MAX_LENGTH) });
    } else if (steps.every((s) => s.optional)) errors.steps = appLabel("habit-validation.atLeastOneStepMustBeRequired");
  }
  return errors;
}

export function hasErrors(errors: HabitDraftErrors): boolean {
  return Object.keys(errors).length > 0;
}

function draftToTracking(draft: HabitDraft): HabitTracking {
  switch (draft.trackingType) {
    case 'tick':
      return { type: 'tick' };
    case 'count':
      return { type: 'count', target: parseCountTarget(draft.countTarget) ?? 1, unit: draft.countUnit.trim() };
    case 'checklist':
      return {
        type: 'checklist',
        steps: draft.steps.map((s) => ({
          id: s.id,
          label: s.label.trim(),
          ...(s.optional ? { optional: true as const } : {}),
        })),
      };
  }
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
    tracking: draftToTracking(draft),
  };
}
