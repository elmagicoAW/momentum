import AsyncStorage from '@react-native-async-storage/async-storage';

export type Appearance = 'light' | 'dark' | 'system';
export type Language = 'en' | 'ar';
export type Preferences = Readonly<{ appearance: Appearance; language: Language }>;
export const DEFAULT_PREFERENCES: Preferences = Object.freeze({ appearance: 'dark', language: 'en' });
// Device presentation only: deliberately outside the backup v1 allowlist.
export const PREFERENCES_KEY = 'momentum:preferences:v1';
export type PreferencesErrorCode = 'invalid-record' | 'unsupported-version' | 'read-failed' | 'write-failed' | 'not-loaded' | 'invalid-update';
export class PreferencesError extends Error {
  readonly code: PreferencesErrorCode;
  constructor(code: PreferencesErrorCode) {
    super(`Preferences: ${code}`);
    this.name = 'PreferencesError';
    this.code = code;
  }
}

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const own = (value: object, key: string) => Object.prototype.hasOwnProperty.call(value, key);
const appearance = (value: unknown): value is Appearance => value === 'light' || value === 'dark' || value === 'system';
const language = (value: unknown): value is Language => value === 'en' || value === 'ar';

/** Missing v1 fields default in memory; unexpected fields/present invalid values are never repaired. */
export function parsePreferencesStore(raw: string): Preferences {
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new PreferencesError('invalid-record'); }
  if (!record(value) || !own(value, 'version')) throw new PreferencesError('invalid-record');
  if (value.version !== 1) throw new PreferencesError('unsupported-version');
  if (Object.keys(value).sort().join(',') !== 'preferences,version' || !record(value.preferences)) {
    throw new PreferencesError('invalid-record');
  }
  const prefs = value.preferences;
  if (Object.keys(prefs).some((key) => key !== 'appearance' && key !== 'language') ||
    (own(prefs, 'appearance') && !appearance(prefs.appearance)) ||
    (own(prefs, 'language') && !language(prefs.language))) throw new PreferencesError('invalid-record');
  return Object.freeze({
    appearance: own(prefs, 'appearance') ? prefs.appearance as Appearance : DEFAULT_PREFERENCES.appearance,
    language: own(prefs, 'language') ? prefs.language as Language : DEFAULT_PREFERENCES.language,
  });
}

export function validatePreferencesPatch(value: unknown): Partial<Preferences> {
  if (!record(value) || Object.keys(value).some((key) => key !== 'appearance' && key !== 'language') ||
    (own(value, 'appearance') && !appearance(value.appearance)) ||
    (own(value, 'language') && !language(value.language))) throw new PreferencesError('invalid-update');
  // Copy at admission so caller mutation cannot change a queued request.
  return Object.freeze({
    ...(own(value, 'appearance') ? { appearance: value.appearance as Appearance } : {}),
    ...(own(value, 'language') ? { language: value.language as Language } : {}),
  });
}

export type PreferencesStorage = Pick<typeof AsyncStorage, 'getItem' | 'setItem'>;
export async function loadPreferences(storage: PreferencesStorage = AsyncStorage): Promise<Preferences> {
  let raw: string | null;
  try { raw = await storage.getItem(PREFERENCES_KEY); } catch { throw new PreferencesError('read-failed'); }
  return raw === null ? DEFAULT_PREFERENCES : parsePreferencesStore(raw);
}

export async function savePreferences(preferences: Preferences, storage: PreferencesStorage = AsyncStorage): Promise<void> {
  // Do not let JSON.stringify silently omit undefined or accept extra values from untyped callers.
  const patch = validatePreferencesPatch(preferences);
  if (!own(patch, 'appearance') || !own(patch, 'language')) throw new PreferencesError('invalid-update');
  const raw = JSON.stringify({ version: 1, preferences: patch });
  parsePreferencesStore(raw);
  try { await storage.setItem(PREFERENCES_KEY, raw); } catch { throw new PreferencesError('write-failed'); }
}
