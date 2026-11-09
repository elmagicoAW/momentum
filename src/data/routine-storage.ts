import AsyncStorage from '@react-native-async-storage/async-storage';

export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'anytime';

export const TIME_OF_DAY_VALUES: readonly TimeOfDay[] = ['morning', 'afternoon', 'evening', 'anytime'];

export type Routine = {
  /** Generated once, never changed or reused. */
  id: string;
  /** Trimmed, 1–40 characters. */
  title: string;
  /** Trimmed, at most 140 characters; omitted when empty. */
  description?: string;
  /** Key from `HABIT_ICONS`; unknown keys render a fallback icon. */
  icon: string;
  color: string;
  /** Preferred time of day. Affects ordering and highlighting only — never availability. */
  timeOfDay: TimeOfDay;
  /**
   * Habit IDs in routine order, unique. Only IDs — habit definitions and progress
   * are never copied. May contain IDs of habits deleted since: those are ignored
   * everywhere and dropped the next time the routine is saved.
   */
  habitIds: string[];
  /** ISO timestamps. */
  createdAt: string;
  updatedAt: string;
};

/** Everything the user edits; the rest is managed by `useRoutines`. */
export type RoutineInput = Pick<Routine, 'title' | 'description' | 'icon' | 'color' | 'timeOfDay' | 'habitIds'>;

export const ROUTINE_TITLE_MAX_LENGTH = 40;
export const ROUTINE_DESCRIPTION_MAX_LENGTH = 140;
export const MAX_ROUTINES = 20;
export const MAX_HABITS_PER_ROUTINE = 20;

/**
 * Storage layout: `momentum:routines:v1` → `{ version: 1, routines: Routine[] }`.
 * Array order = the user's routine order.
 * Habits, goals and daily progress are never read or written here.
 */
export const ROUTINES_KEY = 'momentum:routines:v1';
const STORE_VERSION = 1;

// ---------------------------------------------------------------------------
// Parsing — strict, so corrupt or newer data is reported instead of replaced.
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTimeOfDay(value: unknown): value is TimeOfDay {
  return typeof value === 'string' && (TIME_OF_DAY_VALUES as readonly string[]).includes(value);
}

function parseRoutine(value: unknown): Routine | null {
  if (!isRecord(value)) return null;
  const { id, title, description, icon, color, timeOfDay, habitIds, createdAt, updatedAt } = value;
  if (typeof id !== 'string' || id.length === 0) return null;
  if (typeof title !== 'string' || typeof icon !== 'string' || typeof color !== 'string') return null;
  if (description !== undefined && typeof description !== 'string') return null;
  // Missing = 'anytime'. An unknown value (e.g. from a newer app version) is rejected, never rewritten.
  if (timeOfDay !== undefined && !isTimeOfDay(timeOfDay)) return null;
  if (!Array.isArray(habitIds) || !habitIds.every((h) => typeof h === 'string')) return null;
  if (typeof createdAt !== 'string' || typeof updatedAt !== 'string') return null;
  return {
    id,
    title,
    ...(description ? { description } : {}),
    icon,
    color,
    timeOfDay: timeOfDay ?? 'anytime',
    habitIds: [...new Set(habitIds as string[])],
    createdAt,
    updatedAt,
  };
}

/** Parses a saved routines value. Throws on anything unexpected. Exported for tests. */
export function parseRoutineStore(raw: string): Routine[] {
  const data: unknown = JSON.parse(raw);
  if (!isRecord(data) || !Array.isArray(data.routines)) {
    throw new Error('Saved routines have an unexpected format');
  }
  if (data.version !== STORE_VERSION) {
    throw new Error(`Saved routines use unsupported version ${String(data.version)}`);
  }
  const routines = data.routines.map(parseRoutine);
  if (routines.some((r) => r === null)) {
    throw new Error('Saved routines contain an invalid entry');
  }
  const valid = routines as Routine[];
  if (new Set(valid.map((r) => r.id)).size !== valid.length) {
    throw new Error('Saved routines contain duplicate IDs');
  }
  return valid;
}

// ---------------------------------------------------------------------------
// IDs
// ---------------------------------------------------------------------------

/** e.g. `r_mh9x2k1a_4f8z0q`. Checked against existing IDs so it can't clash. */
export function createRoutineId(existingIds: Iterable<string>): string {
  const taken = new Set(existingIds);
  let id: string;
  do {
    const random = Math.random().toString(36).slice(2, 8).padEnd(6, '0');
    id = `r_${Date.now().toString(36)}_${random}`;
  } while (taken.has(id));
  return id;
}

// ---------------------------------------------------------------------------
// Load / save
// ---------------------------------------------------------------------------

/**
 * Loads routines. Nothing saved yet → empty list (nothing is written).
 * Throws on any read/parse failure so the caller can show an error — it never
 * falls back to an empty list over existing data.
 */
export async function loadRoutines(): Promise<Routine[]> {
  const raw = await AsyncStorage.getItem(ROUTINES_KEY);
  if (raw == null) return [];
  return parseRoutineStore(raw);
}

/** Writes the full list in one `setItem`. */
export async function saveRoutines(routines: readonly Routine[]): Promise<void> {
  await AsyncStorage.setItem(ROUTINES_KEY, JSON.stringify({ version: STORE_VERSION, routines }));
}
