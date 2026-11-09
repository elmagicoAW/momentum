import {
  DEFAULT_PREFERENCES, loadPreferences, PreferencesError, savePreferences, validatePreferencesPatch,
  type Preferences, type PreferencesErrorCode,
} from '@/data/preferences-storage';

export type PreferencesSnapshot = Readonly<{
  preferences: Preferences;
  status: 'loading' | 'ready' | 'load-error';
  saving: boolean;
  error: PreferencesErrorCode | null;
}>;

/** Independent of domain persistence generations, admission, normalization and awards. */
export function createPreferencesStore(options: {
  load?: () => Promise<Preferences>;
  save?: (preferences: Preferences) => Promise<void>;
} = {}) {
  let snapshot: PreferencesSnapshot = Object.freeze({ preferences: DEFAULT_PREFERENCES, status: 'loading', saving: false, error: null });
  const listeners = new Set<() => void>();
  const publish = (change: Partial<PreferencesSnapshot>) => {
    snapshot = Object.freeze({ ...snapshot, ...change });
    listeners.forEach((listener) => listener());
  };
  let loading: Promise<Preferences> | null = null;
  let queue: Promise<unknown> = Promise.resolve();
  let pending = 0;
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    /** Initialize/retry only. Successful hydration is retained across domain restores. */
    load(): Promise<Preferences> {
      if (loading) return loading;
      if (snapshot.status === 'ready') return Promise.resolve(snapshot.preferences);
      publish({ status: 'loading', error: null });
      loading = Promise.resolve().then(() => (options.load ?? loadPreferences)()).then((preferences) => {
        // Copy/freeze even an injected loader's value; production loader already validates.
        const value = Object.freeze({ ...preferences });
        publish({ preferences: value, status: 'ready', error: null });
        return value;
      }).catch((error: unknown) => {
        publish({ status: 'load-error', error: error instanceof PreferencesError ? error.code : 'read-failed' });
        throw error;
      }).finally(() => { loading = null; });
      return loading;
    },
    update(input: Partial<Preferences>): Promise<void> {
      // Refuse at admission: a pending/failed read can never authorize an overwrite.
      if (snapshot.status !== 'ready') return Promise.reject(new PreferencesError('not-loaded'));
      let patch: Partial<Preferences>;
      try { patch = validatePreferencesPatch(input); } catch (error) { return Promise.reject(error); }
      pending++;
      publish({ saving: true, error: null });
      const task = queue.then(async () => {
        const current = snapshot.preferences;
        const next: Preferences = Object.freeze({ ...current, ...patch });
        if (next.appearance !== current.appearance || next.language !== current.language) {
          await (options.save ?? savePreferences)(next);
          publish({ preferences: next });
        }
        publish({ error: null });
      }).catch((error: unknown) => {
        publish({ error: error instanceof PreferencesError ? error.code : 'write-failed' });
        throw error;
      }).finally(() => { pending--; publish({ saving: pending > 0 }); });
      queue = task.catch(() => undefined);
      return task;
    },
  };
}
