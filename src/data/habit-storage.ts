import AsyncStorage from '@react-native-async-storage/async-storage';

import { listCompletionKeys } from '@/data/completion-storage';
import { LEGACY_DEMO_HABITS } from '@/data/demo-habits';

/** 0 = Sunday … 6 = Saturday, matching `Date#getDay()` in local time. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type HabitSchedule =
  | { kind: 'daily' }
  | { kind: 'weekdays'; days: Weekday[] }; // at least one day, sorted, unique

export type Habit = {
  /** Generated once, never changed or reused. Completions reference it. */
  id: string;
  name: string;
  description?: string;
  /** Key from `HABIT_ICONS`; unknown keys render a fallback icon. */
  icon: string;
  color: string;
  schedule: HabitSchedule;
  /** ISO timestamp. */
  createdAt: string;
};

/** Everything the user edits; `id` and `createdAt` are managed by storage. */
export type HabitInput = Omit<Habit, 'id' | 'createdAt'>;

/**
 * Storage layout:
 * - `momentum:habits:v1` → `{ version: 1, habits: Habit[] }`
 * - `momentum:backup:pre-habits-v1` → snapshot written once, before the
 *   one-time migration, of all completion records that existed at that time.
 * Completion records (`momentum:completions:v1:<date>`) are never written here.
 */
const HABITS_KEY = 'momentum:habits:v1';
const BACKUP_KEY = 'momentum:backup:pre-habits-v1';
const STORE_VERSION = 1;

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

function parseHabit(value: unknown): Habit | null {
  if (!isRecord(value)) return null;
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

function parseHabitStore(raw: string): Habit[] {
  const data: unknown = JSON.parse(raw);
  if (!isRecord(data) || !Array.isArray(data.habits)) {
    throw new Error('Saved habits have an unexpected format');
  }
  if (data.version !== STORE_VERSION) {
    throw new Error(`Saved habits use unsupported version ${String(data.version)}`);
  }
  const habits = data.habits.map(parseHabit);
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

/** e.g. `h_mh9x2k1a_4f8z0q`. Checked against existing IDs so it can't clash. */
export function createHabitId(existingIds: Iterable<string>): string {
  const taken = new Set(existingIds);
  let id: string;
  do {
    const random = Math.random().toString(36).slice(2, 8).padEnd(6, '0');
    id = `h_${Date.now().toString(36)}_${random}`;
  } while (taken.has(id));
  return id;
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
 * - Habits saved → return them (an empty saved list stays empty).
 * - Nothing saved, but completion records exist → existing user from before
 *   habits were editable: run the one-time migration.
 * - Nothing saved at all → new install: return an empty list (nothing written).
 */
export async function loadHabits(): Promise<Habit[]> {
  const raw = await AsyncStorage.getItem(HABITS_KEY);
  if (raw != null) return parseHabitStore(raw);

  const completionKeys = await listCompletionKeys();
  if (completionKeys.length === 0) return [];

  return migrateLegacyDemoHabits(completionKeys);
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
      reason: 'Before migrating demo habits to editable habits (momentum:habits:v1)',
      createdAt: new Date().toISOString(),
      legacyHabitIds: LEGACY_DEMO_HABITS.map((h) => h.id),
      completions,
    };
    await AsyncStorage.setItem(BACKUP_KEY, JSON.stringify(backup));
  }

  const savedMeanwhile = await AsyncStorage.getItem(HABITS_KEY);
  if (savedMeanwhile != null) return parseHabitStore(savedMeanwhile);

  const base = Date.now();
  const habits: Habit[] = LEGACY_DEMO_HABITS.map((demo, index) => ({
    id: demo.id,
    name: demo.name,
    description: demo.description,
    icon: demo.icon,
    color: demo.color,
    schedule: { kind: 'daily' },
    // Staggered so creation order matches the original list order.
    createdAt: new Date(base + index).toISOString(),
  }));

  await saveHabits(habits);
  return habits;
}
