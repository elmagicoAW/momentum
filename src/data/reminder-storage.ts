import AsyncStorage from '@react-native-async-storage/async-storage';

import { isValidReminderTime, type ReminderTime } from '@/utils/reminder-time';

export type { ReminderTime } from '@/utils/reminder-time';

export type ReminderSetting = {
  enabled: boolean;
  time: ReminderTime;
  /** ISO timestamp of the last change. */
  updatedAt: string;
};

export type ReminderSettings = {
  /** Master switch. false = nothing is scheduled; per-item settings are kept as they are. */
  enabled: boolean;
  /**
   * Keyed by habit ID. Entries for deleted habits are ignored everywhere and
   * dropped the next time settings are saved (IDs are never reused).
   */
  habits: Record<string, ReminderSetting>;
  /** Keyed by routine ID. Same orphan rule. */
  routines: Record<string, ReminderSetting>;
};

/**
 * Storage layout: `momentum:reminders:v1` → `{ version: 1, enabled, habits, routines }`.
 *
 * This is the ONLY key reminders write. Habits, routines, goals and check-ins
 * are never read or written here. The OS notification schedule is derived from
 * this plus habits and routines, and is never treated as a source of truth.
 */
export const REMINDERS_KEY = 'momentum:reminders:v1';
const STORE_VERSION = 1;

export function defaultReminderSettings(): ReminderSettings {
  return { enabled: true, habits: {}, routines: {} };
}

// ---------------------------------------------------------------------------
// Parsing — strict, so corrupt or newer data is reported instead of replaced.
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseSetting(value: unknown): ReminderSetting | null {
  if (!isRecord(value)) return null;
  const { enabled, time, updatedAt } = value;
  if (typeof enabled !== 'boolean' || !isValidReminderTime(time) || typeof updatedAt !== 'string') return null;
  return { enabled, time: { hour: time.hour, minute: time.minute }, updatedAt };
}

function parseMap(value: unknown): Record<string, ReminderSetting> | null {
  if (!isRecord(value)) return null;
  const out: Record<string, ReminderSetting> = {};
  for (const [id, raw] of Object.entries(value)) {
    if (id.length === 0) return null;
    const setting = parseSetting(raw);
    if (!setting) return null;
    out[id] = setting;
  }
  return out;
}

/** Parses a saved reminders value. Throws on anything unexpected. Exported for tests. */
export function parseReminderStore(raw: string): ReminderSettings {
  const data: unknown = JSON.parse(raw);
  if (!isRecord(data)) throw new Error('Saved reminders have an unexpected format');
  if (data.version !== STORE_VERSION) {
    throw new Error(`Saved reminders use unsupported version ${String(data.version)}`);
  }
  if (typeof data.enabled !== 'boolean') throw new Error('Saved reminders have an invalid switch');
  const habits = parseMap(data.habits);
  const routines = parseMap(data.routines);
  if (!habits || !routines) throw new Error('Saved reminders contain an invalid entry');
  return { enabled: data.enabled, habits, routines };
}

// ---------------------------------------------------------------------------
// Load / save
// ---------------------------------------------------------------------------

/**
 * Nothing saved yet → defaults (nothing is written).
 * Throws on any read/parse failure so the caller can show an error — it never
 * falls back to defaults over existing data.
 */
export async function loadReminderSettings(): Promise<ReminderSettings> {
  const raw = await AsyncStorage.getItem(REMINDERS_KEY);
  if (raw == null) return defaultReminderSettings();
  return parseReminderStore(raw);
}

/** Writes the full value in one `setItem`. */
export async function saveReminderSettings(settings: ReminderSettings): Promise<void> {
  await AsyncStorage.setItem(REMINDERS_KEY, JSON.stringify({ version: STORE_VERSION, ...settings }));
}

// ---------------------------------------------------------------------------
// Pure updates (used by the provider; tested in isolation)
// ---------------------------------------------------------------------------

export type ReminderKind = 'habit' | 'routine';

const mapKey = (kind: ReminderKind) => (kind === 'habit' ? 'habits' : 'routines');

/**
 * Sets one item's reminder. Entries for IDs that no longer exist are dropped
 * at the same time — but only when the caller knows the full ID lists
 * (`existing` provided). Unknown → nothing is pruned.
 */
export function withItemReminder(
  settings: ReminderSettings,
  kind: ReminderKind,
  id: string,
  value: { enabled: boolean; time: ReminderTime },
  now: Date,
  existing?: { habitIds: ReadonlySet<string>; routineIds: ReadonlySet<string> },
): ReminderSettings {
  const key = mapKey(kind);
  const next: ReminderSettings = {
    ...settings,
    [key]: {
      ...settings[key],
      [id]: { enabled: value.enabled, time: { ...value.time }, updatedAt: now.toISOString() },
    },
  };
  return existing ? pruneOrphans(next, existing, { keep: { kind, id } }) : next;
}

/** Drops entries whose habit/routine no longer exists. `keep` is never dropped. */
export function pruneOrphans(
  settings: ReminderSettings,
  existing: { habitIds: ReadonlySet<string>; routineIds: ReadonlySet<string> },
  options: { keep?: { kind: ReminderKind; id: string } } = {},
): ReminderSettings {
  const filter = (map: Record<string, ReminderSetting>, ids: ReadonlySet<string>, kind: ReminderKind) =>
    Object.fromEntries(
      Object.entries(map).filter(
        ([id]) => ids.has(id) || (options.keep?.kind === kind && options.keep.id === id),
      ),
    );
  return {
    ...settings,
    habits: filter(settings.habits, existing.habitIds, 'habit'),
    routines: filter(settings.routines, existing.routineIds, 'routine'),
  };
}
