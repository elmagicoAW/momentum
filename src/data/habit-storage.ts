import AsyncStorage from '@react-native-async-storage/async-storage';

import { listCompletionKeys } from '@/data/completion-storage';
import { LEGACY_DEMO_HABITS } from '@/data/demo-habits';

/** 0 = Sunday … 6 = Saturday, matching `Date#getDay()` in local time. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type HabitSchedule =
  | { kind: 'daily' }
  | { kind: 'weekdays'; days: Weekday[] }; // at least one day, sorted, unique

export type ChecklistStep = {
  /** Generated once, stable across renames. Daily progress references it. */
  id: string;
  label: string;
  /** Omitted = required. Optional steps never block completion. */
  optional?: true;
};

export type TrackingType = 'tick' | 'count' | 'checklist';

export type HabitTracking =
  | { type: 'tick' }
  /** `target`: integer 1–9999. `unit` may be empty. */
  | { type: 'count'; target: number; unit: string }
  /** 1–12 steps with unique IDs; validation requires at least one required step. */
  | { type: 'checklist'; steps: ChecklistStep[] };

export type Habit = {
  /** Generated once, never changed or reused. Completions and goals reference it. */
  id: string;
  name: string;
  description?: string;
  /** Key from `HABIT_ICONS`; unknown keys render a fallback icon. */
  icon: string;
  color: string;
  schedule: HabitSchedule;
  tracking: HabitTracking;
  /** ISO timestamp. */
  createdAt: string;
};

/** Everything the user edits; `id` and `createdAt` are managed by storage. */
export type HabitInput = Omit<Habit, 'id' | 'createdAt'>;

export const COUNT_TARGET_MAX = 9999;
export const CHECKLIST_MAX_STEPS = 12;

/**
 * Storage layout:
 * - `momentum:habits:v2` → `{ version: 2, habits: Habit[] }` — the only key written.
 * - `momentum:habits:v1` → `{ version: 1, habits }` (no `tracking`). Read once to
 *   migrate, then left frozen as the pre-migration backup. Never written or deleted.
 * - `momentum:backup:pre-habits-v1` → snapshot written once, before the legacy
 *   demo-habit migration, of all completion records that existed at that time.
 * Completion records are never written here.
 */
const HABITS_KEY = 'momentum:habits:v2';
const HABITS_V1_KEY = 'momentum:habits:v1';
const BACKUP_KEY = 'momentum:backup:pre-habits-v1';
const STORE_VERSION = 2;

// ---------------------------------------------------------------------------
// Parsing — strict, so corrupt data is reported instead of silently replaced.
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isWeekday(value: unknown): value is Weekday {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 6;
}

function parseSchedule(value: unknown): HabitSchedule | null {
  if (!isRecord(value)) return null;
  if (value.kind === 'daily') return { kind: 'daily' };
  if (value.kind === 'weekdays' && Array.isArray(value.days) && value.days.length > 0) {
    if (!value.days.every(isWeekday)) return null;
    return { kind: 'weekdays', days: normalizeDays(value.days) };
  }
  return null;
}

function parseStep(value: unknown): ChecklistStep | null {
  if (!isRecord(value)) return null;
  const { id, label, optional } = value;
  if (typeof id !== 'string' || id.length === 0 || typeof label !== 'string') return null;
  if (optional !== undefined && optional !== true) return null;
  return { id, label, ...(optional ? { optional: true as const } : {}) };
}

function parseTracking(value: unknown): HabitTracking | null {
  if (!isRecord(value)) return null;
  switch (value.type) {
    case 'tick':
      return { type: 'tick' };
    case 'count': {
      const { target, unit } = value;
      if (typeof target !== 'number' || !Number.isInteger(target)) return null;
      if (target < 1 || target > COUNT_TARGET_MAX || typeof unit !== 'string') return null;
      return { type: 'count', target, unit };
    }
    case 'checklist': {
      if (!Array.isArray(value.steps) || value.steps.length === 0) return null;
      const steps = value.steps.map(parseStep);
      if (steps.some((s) => s === null)) return null;
      const valid = steps as ChecklistStep[];
      if (new Set(valid.map((s) => s.id)).size !== valid.length) return null;
      return { type: 'checklist', steps: valid };
    }
    default:
      return null; // unknown (e.g. future) type → reported as invalid, never dropped
  }
}

/** Fields shared by v1 and v2 habits. */
function parseHabitBase(value: Record<string, unknown>): Omit<Habit, 'tracking'> | null {
  const { id, name, description, icon, color, schedule, createdAt } = value;
  if (typeof id !== 'string' || id.length === 0) return null;
  if (typeof name !== 'string' || typeof icon !== 'string' || typeof color !== 'string') return null;
  if (typeof createdAt !== 'string') return null;
  if (description !== undefined && typeof description !== 'string') return null;
  const parsedSchedule = parseSchedule(schedule);
  if (!parsedSchedule) return null;
  return {
    id,
    name,
    ...(description ? { description } : {}),
    icon,
    color,
    schedule: parsedSchedule,
    createdAt,
  };
}

function parseHabitV2(value: unknown): Habit | null {
  if (!isRecord(value)) return null;
  const base = parseHabitBase(value);
  const tracking = parseTracking(value.tracking);
  if (!base || !tracking) return null;
  return { ...base, tracking };
}

/** v1 habits had no tracking type: every one of them is a Tick habit. */
function parseHabitV1(value: unknown): Habit | null {
  if (!isRecord(value)) return null;
  const base = parseHabitBase(value);
  if (!base) return null;
  return { ...base, tracking: { type: 'tick' } };
}

function parseStore(raw: string, version: 1 | 2): Habit[] {
  const data: unknown = JSON.parse(raw);
  if (!isRecord(data) || !Array.isArray(data.habits)) {
    throw new Error('Saved habits have an unexpected format');
  }
  if (data.version !== version) {
    throw new Error(`Saved habits use unsupported version ${String(data.version)}`);
  }
  const habits = data.habits.map(version === 2 ? parseHabitV2 : parseHabitV1);
  if (habits.some((habit) => habit === null)) {
    throw new Error('Saved habits contain an invalid entry');
  }
  const valid = habits as Habit[];
  if (new Set(valid.map((h) => h.id)).size !== valid.length) {
    throw new Error('Saved habits contain duplicate IDs');
  }
  return valid;
}

export function normalizeDays(days: readonly Weekday[]): Weekday[] {
  return [...new Set(days)].sort((a, b) => a - b);
}

// ---------------------------------------------------------------------------
// IDs
// ---------------------------------------------------------------------------

function uniqueId(prefix: string, existingIds: Iterable<string>): string {
  const taken = new Set(existingIds);
  let id: string;
  do {
    const random = Math.random().toString(36).slice(2, 8).padEnd(6, '0');
    id = `${prefix}_${Date.now().toString(36)}_${random}`;
  } while (taken.has(id));
  return id;
}

/** e.g. `h_mh9x2k1a_4f8z0q`. Checked against existing IDs so it can't clash. */
export function createHabitId(existingIds: Iterable<string>): string {
  return uniqueId('h', existingIds);
}

/** e.g. `s_mh9x2k1a_4f8z0q`. Unique within its habit. */
export function createStepId(existingIds: Iterable<string>): string {
  return uniqueId('s', existingIds);
}

// ---------------------------------------------------------------------------
// Load / save
// ---------------------------------------------------------------------------

export async function saveHabits(habits: readonly Habit[]): Promise<void> {
  await AsyncStorage.setItem(HABITS_KEY, JSON.stringify({ version: STORE_VERSION, habits }));
}

/**
 * Loads habits. Throws on any read/parse/write failure so the caller can show
 * an error — it never falls back to an empty list over existing data.
 *
 * 1. v2 saved → return it (an empty saved list stays empty).
 * 2. Only v1 saved → migrate it to v2 (every habit becomes a Tick habit).
 * 3. Nothing saved, but completion records exist → existing user from before
 *    habits were editable: run the legacy demo migration.
 * 4. Nothing saved at all → new install: return an empty list (nothing written).
 */
export async function loadHabits(): Promise<Habit[]> {
  const raw = await AsyncStorage.getItem(HABITS_KEY);
  if (raw != null) return parseStore(raw, 2);

  const rawV1 = await AsyncStorage.getItem(HABITS_V1_KEY);
  if (rawV1 != null) return migrateV1ToV2(rawV1);

  const completionKeys = await listCompletionKeys();
  if (completionKeys.length === 0) return [];

  return migrateLegacyDemoHabits(completionKeys);
}

/**
 * v1 → v2. Retryable and non-destructive:
 * - v1 is parsed strictly first; if it is corrupt this throws and writes nothing.
 * - IDs, names, schedules, `createdAt` and order are kept; `tracking` = tick.
 * - v2 is re-checked right before writing so a list saved meanwhile is never replaced.
 * - v1 is never written or removed, so it stays as the pre-migration backup.
 * If the v2 write fails, this throws and the next launch retries from v1.
 */
async function migrateV1ToV2(rawV1: string): Promise<Habit[]> {
  const habits = parseStore(rawV1, 1);
  const savedMeanwhile = await AsyncStorage.getItem(HABITS_KEY);
  if (savedMeanwhile != null) return parseStore(savedMeanwhile, 2);
  await saveHabits(habits);
  return habits;
}

/**
 * Recreates the four original demo habits with their original IDs so every
 * saved completion stays linked.
 *
 * Idempotent and recoverable:
 * 1. A backup of all completion records is written first, only if no backup
 *    exists yet (a retry never overwrites the original backup).
 * 2. The habits key is re-checked right before writing, so a habit list
 *    saved in the meantime is never replaced.
 * 3. If any step fails, it throws and the next launch simply retries.
 * Completion records are only read, never written.
 */
async function migrateLegacyDemoHabits(completionKeys: string[]): Promise<Habit[]> {
  const existingBackup = await AsyncStorage.getItem(BACKUP_KEY);
  if (existingBackup == null) {
    const entries = await AsyncStorage.multiGet(completionKeys);
    const completions: Record<string, string> = {};
    for (const [key, value] of entries) {
      if (value != null) completions[key] = value;
    }
    const backup = {
      version: 1,
      reason: 'Before migrating demo habits to editable habits',
      createdAt: new Date().toISOString(),
      legacyHabitIds: LEGACY_DEMO_HABITS.map((h) => h.id),
      completions,
    };
    await AsyncStorage.setItem(BACKUP_KEY, JSON.stringify(backup));
  }

  const savedMeanwhile = await AsyncStorage.getItem(HABITS_KEY);
  if (savedMeanwhile != null) return parseStore(savedMeanwhile, 2);

  const base = Date.now();
  const habits: Habit[] = LEGACY_DEMO_HABITS.map((demo, index) => ({
    id: demo.id,
    name: demo.name,
    description: demo.description,
    icon: demo.icon,
    color: demo.color,
    schedule: { kind: 'daily' },
    tracking: { type: 'tick' },
    // Staggered so creation order matches the original list order.
    createdAt: new Date(base + index).toISOString(),
  }));

  await saveHabits(habits);
  return habits;
}
