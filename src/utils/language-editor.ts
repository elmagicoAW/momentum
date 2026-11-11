import type { Language } from '@/data/preferences-storage';
import type { PreferencesSnapshot } from '@/data/preferences-store';

/** Dialog drafts never reach persistence until Save; admission is synchronous across rapid taps. */
export function createLanguageEditor(ports: {
  getPreferences: () => PreferencesSnapshot;
  save: (language: Language) => Promise<void>;
}) {
  let backupBusy = false;
  let snapshot: Readonly<{ open: boolean; choice: Language; saving: boolean; failed: boolean }> =
    Object.freeze({ open: false, choice: 'en', saving: false, failed: false });
  const listeners = new Set<() => void>();
  const publish = (patch: Partial<typeof snapshot>) => {
    snapshot = Object.freeze({ ...snapshot, ...patch });
    listeners.forEach((fn) => fn());
  };
  const blocked = () => snapshot.saving || backupBusy ||
    ports.getPreferences().saving || ports.getPreferences().status !== 'ready';
  return {
    setBackupBusy(value: boolean) { backupBusy = value; },
    getSnapshot: () => snapshot,
    subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
    open() {
      if (!blocked()) publish({ open: true, choice: ports.getPreferences().preferences.language, failed: false });
    },
    choose(choice: Language) {
      if (snapshot.open && !blocked()) publish({ choice, failed: false });
    },
    cancel() {
      if (!snapshot.saving) publish({ open: false, failed: false });
    },
    async save() {
      if (!snapshot.open || blocked()) return;
      const choice = snapshot.choice;
      publish({ saving: true, failed: false });
      try {
        await ports.save(choice);
        publish({ open: false });
      } catch {
        publish({ failed: true });
      } finally {
        publish({ saving: false });
      }
    },
  };
}
