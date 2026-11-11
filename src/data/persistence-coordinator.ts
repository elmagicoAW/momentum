import { withErrorMessage } from '@/i18n/app-copy';
/** One JS runtime owns the store. Admission is synchronous, before promises are
 * queued. A lease covers accepted work INCLUDING backoff and native writes. */
export function createPersistenceCoordinator() {
  let frozen = false;
  let generation = 0;
  let active = 0;
  let normalize = true;
  let awards = true;
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((fn) => fn());
  return {
    available: () => !frozen,
    generation: () => generation,
    automaticNormalization: () => normalize,
    automaticAwards: () => awards,
    enableUserChanges() { if (!frozen) { normalize = true; awards = true; } },
    enableAwards() { if (!frozen) awards = true; },
    accept(expected = generation): () => void {
      if (frozen || expected !== generation) throw withErrorMessage(new Error('Data is locked for backup/recovery. Please try again afterwards.'), {key: 'backup.validation.dataIsLockedForBackupRecoveryPleaseTryAgainAfterwards'});
      active++;
      let finished = false;
      return () => { if (!finished) { finished = true; active--; notify(); } };
    },
    run<T>(task: () => Promise<T>, expected = generation): Promise<T> {
      let finish: () => void;
      try { finish = this.accept(expected); } catch (error) { return Promise.reject(error); }
      try { return task().finally(finish); } catch (error) { finish(); return Promise.reject(error); }
    },
    freeze() {
      if (frozen) throw withErrorMessage(new Error('Another backup/recovery operation is active'), {key: 'backup.validation.anotherBackupRecoveryOperationIsActive'});
      frozen = true;
    },
    // A timeout is ONLY a failure. It never grants permission to mutate.
    async drain(timeoutMs = 15000): Promise<void> {
      if (!frozen) throw new Error('Freeze before draining');
      if (!active) return;
      await new Promise<void>((resolve, reject) => {
        const done = () => { if (!active) { clearTimeout(timer); listeners.delete(done); resolve(); } };
        const timer = setTimeout(() => { listeners.delete(done); reject(withErrorMessage(new Error('Latest changes are still saving. Nothing was replaced; retry after saving completes.'), {key: 'backup.validation.latestChangesAreStillSavingNothingWasReplacedRetryAfterSavingCompletes'})); }, timeoutMs);
        listeners.add(done); done();
      });
    },
    release() { frozen = false; },
    advance(restored: boolean) {
      if (!frozen || active) throw new Error('Cannot change generation with active work');
      generation++; normalize = !restored; awards = !restored;
    },
    active: () => active,
  };
}
export const persistence = createPersistenceCoordinator();
