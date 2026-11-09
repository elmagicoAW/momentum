import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Habit completions are stored one key per local calendar date, e.g.
 * `momentum:completions:v1:2026-11-09` -> `["water","read"]`.
 * Writing one day never touches another day's data.
 */
const KEY_PREFIX = 'momentum:completions:v1:';

const keyFor = (dateKey: string) => `${KEY_PREFIX}${dateKey}`;

/**
 * Loads the completed habit IDs for a date. Returns an empty list when nothing
 * has been saved yet. Throws if storage can't be read or the saved value is
 * corrupt, so callers can avoid overwriting it.
 */
export async function loadCompletions(dateKey: string): Promise<string[]> {
  const raw = await AsyncStorage.getItem(keyFor(dateKey));
  if (raw == null) return [];

  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed) || !parsed.every((id) => typeof id === 'string')) {
    throw new Error(`Unexpected saved completions for ${dateKey}`);
  }
  return parsed;
}

/**
 * Lists every saved per-day completion key. Read-only — used to detect users
 * who already have saved progress before habits were stored.
 */
export async function listCompletionKeys(): Promise<string[]> {
  const keys = await AsyncStorage.getAllKeys();
  return keys.filter((key) => key.startsWith(KEY_PREFIX));
}

export async function saveCompletions(dateKey: string, habitIds: Iterable<string>) {
  await AsyncStorage.setItem(keyFor(dateKey), JSON.stringify([...habitIds]));
}
