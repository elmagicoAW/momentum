import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * DAILY PROGRESS STORAGE
 * ======================
 * One key per local calendar date. Writing one day never touches another day.
 *
 * - v2 (written): `momentum:checkins:v2:2026-11-09` →
 *     `{ version: 2, entries: { [habitId]: HabitEntry } }`
 * - v1 (read-only, legacy): `momentum:completions:v1:2026-11-09` → `["water","read"]`
 *
 * v1 records are never written or deleted. A day without a v2 record is read
 * from its v1 record (each ID = a completed Tick). The first write for that day
 * saves the full record — including the carried-over v1 ticks — to v2, and from
 * then on v2 wins for that date.
 *
 * Each entry stores the rule it was recorded under (count target, required
 * checklist steps), so past days keep their meaning after a habit is edited.
 */
const V2_PREFIX = 'momentum:checkins:v2:';
const V1_PREFIX = 'momentum:completions:v1:';
const RECORD_VERSION = 2;

export const COUNT_VALUE_MAX = 9999;

export type HabitEntry =
  | { type: 'tick'; done: true }
  /** `target` = the habit's target when last recorded. */
  | { type: 'count'; value: number; target: number }
  /** Step IDs. `required` = the habit's required steps when last recorded. */
  | { type: 'checklist'; done: string[]; required: string[] };

/** A habit with no entry has no progress that day. */
export type DayRecord = { entries: Record<string, HabitEntry> };

export const EMPTY_DAY: DayRecord = Object.freeze({ entries: Object.freeze({}) }) as DayRecord;

const v2Key = (dateKey: string) => `${V2_PREFIX}${dateKey}`;
const v1Key = (dateKey: string) => `${V1_PREFIX}${dateKey}`;

// ---------------------------------------------------------------------------
// Parsing — strict. Anything unexpected (including a future version or entry
// type) throws, so the caller treats the day as unreadable and never overwrites it.
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((v) => typeof v === 'string');

const isIntIn = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;

function parseEntry(value: unknown): HabitEntry {
  if (isRecord(value)) {
    if (value.type === 'tick' && value.done === true) return { type: 'tick', done: true };
    if (value.type === 'count' && isIntIn(value.value, 0, COUNT_VALUE_MAX) && isIntIn(value.target, 1, COUNT_VALUE_MAX)) {
      return { type: 'count', value: value.value, target: value.target };
    }
    if (value.type === 'checklist' && isStringArray(value.done) && isStringArray(value.required)) {
      return { type: 'checklist', done: [...new Set(value.done)], required: [...new Set(value.required)] };
    }
  }
  throw new Error('Unexpected progress entry');
}

export function parseV2(raw: string): DayRecord {
  const data: unknown = JSON.parse(raw);
  if (!isRecord(data) || data.version !== RECORD_VERSION || !isRecord(data.entries)) {
    throw new Error('Unexpected daily progress format');
  }
  const entries: Record<string, HabitEntry> = {};
  for (const [habitId, entry] of Object.entries(data.entries)) {
    entries[habitId] = parseEntry(entry);
  }
  return { entries };
}

/** Legacy list of completed habit IDs → Tick entries. */
export function parseV1(raw: string): DayRecord {
  const parsed: unknown = JSON.parse(raw);
  if (!isStringArray(parsed)) throw new Error('Unexpected saved completions');
  const entries: Record<string, HabitEntry> = {};
  for (const id of parsed) entries[id] = { type: 'tick', done: true };
  return { entries };
}

// ---------------------------------------------------------------------------
// Load / save
// ---------------------------------------------------------------------------

/**
 * Loads one day's progress (v2, else v1, else empty). Throws if storage can't
 * be read or the saved value is corrupt, so callers can avoid overwriting it.
 */
export async function loadDay(dateKey: string): Promise<DayRecord> {
  const raw = await AsyncStorage.getItem(v2Key(dateKey));
  if (raw != null) return parseV2(raw);
  const rawV1 = await AsyncStorage.getItem(v1Key(dateKey));
  if (rawV1 != null) return parseV1(rawV1);
  return { entries: {} };
}

/** Writes the full record for one day to v2 in a single `setItem`. */
export async function saveDay(dateKey: string, record: DayRecord): Promise<void> {
  await AsyncStorage.setItem(v2Key(dateKey), JSON.stringify({ version: RECORD_VERSION, entries: record.entries }));
}

/**
 * Lists every saved per-day key (v1 and v2). Read-only — used to detect users
 * who already have saved progress before habits were stored.
 */
export async function listCompletionKeys(): Promise<string[]> {
  const keys = await AsyncStorage.getAllKeys();
  return keys.filter((key) => key.startsWith(V2_PREFIX) || key.startsWith(V1_PREFIX));
}

export type CompletionHistory = {
  /** Local date key → that day's progress. Days with nothing saved are absent. */
  days: Map<string, DayRecord>;
  /** Date keys whose saved value couldn't be read. They are skipped, never rewritten. */
  unreadableDays: string[];
};

/**
 * Reads every saved day of progress. Strictly read-only.
 * For each date the v2 record wins; v1 is used only when no v2 record exists.
 * Throws only if storage itself can't be read; a single corrupt day is
 * reported in `unreadableDays` instead of failing the whole history (a corrupt
 * v2 record never falls back to the stale v1 record).
 */
export async function loadCompletionHistory(): Promise<CompletionHistory> {
  const keys = await listCompletionKeys();
  const entries = keys.length > 0 ? await AsyncStorage.multiGet(keys) : [];
  const v2 = new Map<string, string>();
  const v1 = new Map<string, string>();
  for (const [key, raw] of entries) {
    if (raw == null) continue;
    if (key.startsWith(V2_PREFIX)) v2.set(key.slice(V2_PREFIX.length), raw);
    else v1.set(key.slice(V1_PREFIX.length), raw);
  }

  const days = new Map<string, DayRecord>();
  const unreadableDays: string[] = [];
  for (const dateKey of new Set([...v2.keys(), ...v1.keys()])) {
    const rawV2 = v2.get(dateKey);
    try {
      days.set(dateKey, rawV2 != null ? parseV2(rawV2) : parseV1(v1.get(dateKey)!));
    } catch {
      unreadableDays.push(dateKey);
    }
  }
  return { days, unreadableDays };
}
