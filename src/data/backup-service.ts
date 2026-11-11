import { appLabel, withErrorMessage } from '@/i18n/app-copy';
import { bytes, canonical, createBackup, inspectRecords, LIMITS, parseBackup, requireRestorable, strictJSON, validateRecords, type Backup, type Hash } from '@/data/backup-format';
import { isUserKey, type RawRecord } from '@/data/backup-keys';
import { persistence } from '@/data/persistence-coordinator';

export type BackupStorage = {
  getAllKeys(): Promise<readonly string[]>;
  multiGet(keys: string[]): Promise<readonly (readonly [string, string | null])[]>;
  setItem(key: string, raw: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};
/** Only internal generated names are accepted by adapters. Writes must be
 * exclusive-create; never overwrite journal evidence. */
export type JournalFiles = {
  list(): Promise<string[]>;
  read(name: string): Promise<string | null>;
  write(name: string, text: string): Promise<void>;
  remove(name: string): Promise<void>;
};
export class RecoveryBlocked extends Error {}
export function createBackupService(storage: BackupStorage, files: JournalFiles, hash: Hash, barrier = persistence) {
  let serial = false;
  const readVerified = async (name: string) => {
    const text = await files.read(name);
    if (text === null) throw withErrorMessage(new RecoveryBlocked('Recovery files are missing. Keep the app closed to editing and retry recovery.'), { key: "backup-service.recoveryFilesAreMissingKeepTheAppClosedToEditingAndRetryRecovery" });
    return parseBackup(text, hash);
  };
  const writeVerified = async (name: string, text: string) => {
    await files.write(name, text);
    if (await files.read(name) !== text) throw withErrorMessage(new RecoveryBlocked('Recovery file verification failed'), { key: "backup-service.recoveryFileVerificationFailed" });
  };
  const capture = async (): Promise<RawRecord[]> => {
    const keys = (await storage.getAllKeys()).filter(isUserKey).sort();
    if (keys.length > LIMITS.records) throw withErrorMessage(new Error('Too many stored records for a supported backup'), { key: "backup-service.tooManyStoredRecordsForASupportedBackup" });
    let total = 0;
    const result: RawRecord[] = [];
    for (let i = 0; i < keys.length; i += 64) {
      const entries = await storage.multiGet(keys.slice(i, i + 64));
      if (entries.length !== Math.min(64, keys.length - i)) throw withErrorMessage(new Error('Incomplete storage read'), { key: "backup-service.incompleteStorageRead" });
      for (let j = 0; j < entries.length; j++) {
        const [key, raw] = entries[j];
        if (key !== keys[i + j] || raw === null) throw withErrorMessage(new Error('Data changed while being read'), { key: "backup-service.dataChangedWhileBeingRead" });
        const keySize = bytes(key); const rawSize = bytes(raw); total += keySize + rawSize;
        if (keySize > LIMITS.key || rawSize > LIMITS.raw || total > LIMITS.total) throw withErrorMessage(new Error('Stored data exceeds supported backup limits; no data was truncated'), { key: "backup-service.storedDataExceedsSupportedBackupLimitsNoDataWasTruncated" });
        result.push({ key, raw });
      }
    }
    validateRecords(result);
    if (canonical((await storage.getAllKeys()).filter(isUserKey).sort()) !== canonical(keys)) throw withErrorMessage(new Error('Data changed while being read'), { key: "backup-service.dataChangedWhileBeingRead" });
    return result;
  };
  const verify = async (records: RawRecord[]) => {
    if (canonical(await capture()) !== canonical(validateRecords(records))) throw withErrorMessage(new RecoveryBlocked('Stored data did not match the verified snapshot'), { key: "backup-service.storedDataDidNotMatchTheVerifiedSnapshot" });
  };
  const replace = async (records: RawRecord[]) => {
    const incoming = new Set(records.map((r) => r.key));
    // Individual awaited operations intentionally expose interruption boundaries.
    // They are NOT a multi-key transaction.
    for (const { key, raw } of records) await storage.setItem(key, raw);
    for (const key of (await storage.getAllKeys()).filter(isUserKey)) if (!incoming.has(key)) await storage.removeItem(key);
    await verify(records);
  };
  const ids = async () => [...new Set((await files.list()).map((name) => /^(restore-\d{13}-[a-z0-9]+)\.(before|after|prepared|committed|settled|removed)$/.exec(name)?.[1]).filter((id): id is string => !!id))].sort();
  const marker = (id: string, before: Backup, after: Backup) => canonical({ version: 1, id, before: before.integrity.digest, after: after.integrity.digest });
  const settle = async (id: string, outcome: 'restored' | 'rolled-back', before: Backup, after: Backup) => {
    const text = canonical({ version: 1, id, outcome, before: before.integrity.digest, after: after.integrity.digest });
    const existing = await files.read(`${id}.settled`);
    if (existing !== null) {
      if (existing !== text) throw withErrorMessage(new RecoveryBlocked('Conflicting recovery completion marker'), { key: "backup-service.conflictingRecoveryCompletionMarker" });
    } else await writeVerified(`${id}.settled`, text);
  };
  const checkSettled = (text: string, id: string) => {
    let v: unknown;
    try { v = strictJSON(text); } catch { throw withErrorMessage(new RecoveryBlocked('Unreadable recovery completion marker'), { key: "backup-service.unreadableRecoveryCompletionMarker" }); }
    if (!v || typeof v !== 'object' || !('version' in v) || v.version !== 1 || !('id' in v) || v.id !== id || !('outcome' in v) || !['restored', 'rolled-back'].includes(String(v.outcome)) || !('before' in v) || !/^[a-f0-9]{64}$/.test(String(v.before)) || !('after' in v) || !/^[a-f0-9]{64}$/.test(String(v.after))) throw withErrorMessage(new RecoveryBlocked('Unreadable recovery completion marker'), { key: "backup-service.unreadableRecoveryCompletionMarker" });
  };
  return {
    /** Must only be used while exclusive (or by startup before providers mount). */
    capture,
    async exportBackup(version = '1.0.0') {
      barrier.freeze();
      try { await barrier.drain(); return await createBackup(await capture(), hash, version); }
      finally { barrier.release(); }
    },
    async preview(text: string) {
      const backup = await parseBackup(text, hash); const preview = requireRestorable(backup);
      const current = await this.exportBackup();
      return { backup, preview, current, currentPreview: inspectRecords(current.payload.records) };
    },
    async restore(text: string, expectedCurrent: RawRecord[]) {
      // Entire input validation precedes even freezing providers.
      const incoming = await parseBackup(text, hash); requireRestorable(incoming);
      if (serial) throw withErrorMessage(new Error('A restore is already active'), { key: "backup-service.aRestoreIsAlreadyActive" });
      barrier.freeze(); serial = true; let keepLocked = false; let armed = false; let id: string | null = null;
      try {
        await barrier.drain();
        const records = await capture();
        if (canonical(records) !== canonical(validateRecords(expectedCurrent))) throw withErrorMessage(new Error('Current data changed. Preview again and confirm the new comparison.'), { key: "backup-service.currentDataChangedPreviewAgainAndConfirmTheNewComparison" });
        // Future current versions must not be deleted by this app.
        if (records.some((r) => /^momentum:(habits|goals|routines|profile|achievements):v/.test(r.key) && !/^momentum:(habits:v[12]|goals:v1|routines:v1|profile:v1|achievements:v1)$/.test(r.key) || /^momentum:(checkins|completions):/.test(r.key) && !/^momentum:(checkins:v2|completions:v1):/.test(r.key))) throw withErrorMessage(new Error('Current data uses an unsupported schema; replacement is blocked.'), { key: "backup-service.currentDataUsesAnUnsupportedSchemaReplacementIsBlocked" });
        for (const record of records) {
          let value: unknown;
          try { value = strictJSON(record.raw); } catch { continue; } // corrupt known data remains recoverable as raw bytes
          if (value && typeof value === 'object' && 'version' in value && typeof value.version === 'number') {
            const expected = record.key.includes(':v2') ? 2 : 1;
            if (value.version !== expected) throw withErrorMessage(new Error('Current data contains an unsupported record version; replacement is blocked.'), { key: "backup-service.currentDataContainsAnUnsupportedRecordVersionReplacementIsBlocked" });
          }
        }
        const before = await createBackup(records, hash);
        id = `restore-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        await writeVerified(`${id}.before`, JSON.stringify(before));
        await writeVerified(`${id}.after`, JSON.stringify(incoming));
        const prepared = marker(id, before, incoming);
        await writeVerified(`${id}.prepared`, prepared);
        // Verify both durable snapshots again immediately before first mutation.
        if ((await readVerified(`${id}.before`)).integrity.digest !== before.integrity.digest ||
          (await readVerified(`${id}.after`)).integrity.digest !== incoming.integrity.digest) throw withErrorMessage(new Error('Recovery snapshots changed before replacement'), { key: "backup-service.recoverySnapshotsChangedBeforeReplacement" });
        armed = true;
        let settling = false;
        try {
          await replace(incoming.payload.records);
          await writeVerified(`${id}.committed`, prepared);
          settling = true;
          await settle(id, 'restored', before, incoming);
        } catch {
          // A completion marker may have been published even if its read-back
          // failed. Never start rollback after publication: startup trusts that
          // marker, and interrupted rollback could otherwise expose mixed data.
          if (settling && await files.read(`${id}.settled`) !== null) throw withErrorMessage(new RecoveryBlocked('Completion verification interrupted; startup recovery must resolve it.'), { key: "backup-service.completionVerificationInterruptedStartupRecoveryMustResolveIt" });
          // Retain a committed marker if present; settled rollback takes precedence.
          await replace(before.payload.records);
          await settle(id, 'rolled-back', before, incoming);
          barrier.advance(true);
          return { restored: false, message: appLabel("backup-service.restoreFailedYourExactPreviousDataWasRecoveredAndVerified") };
        }
        barrier.advance(true);
        return { restored: true, message: appLabel("backup-service.backupRestoredAndVerifiedALocalRecoveryCopyWasKept") };
      } catch (error) {
        if (armed) { keepLocked = true; throw withErrorMessage(new RecoveryBlocked('Recovery could not be verified. Editing is blocked. Retry recovery; do not uninstall or clear app data.'), { key: "backup-service.recoveryCouldNotBeVerifiedEditingIsBlockedRetryRecoveryDoNotUninstallOrClearAppData" }); }
        // No live mutation started. Remove only this operation's incomplete staging.
        if (id) {
          try { for (const suffix of ['prepared', 'after', 'before']) await files.remove(`${id}.${suffix}`); }
          catch { keepLocked = true; throw withErrorMessage(new RecoveryBlocked('Recovery preparation was interrupted. Retry recovery before editing.'), { key: "backup-service.recoveryPreparationWasInterruptedRetryRecoveryBeforeEditing" }); }
        }
        throw error;
      } finally { serial = false; if (!keepLocked) barrier.release(); }
    },
    /** Caller freezes first. No providers may mount until this resolves. */
    async recover() {
      if (barrier.available()) throw withErrorMessage(new Error('Recovery requires a locked app'), { key: "backup-service.recoveryRequiresALockedApp" });
      await barrier.drain(); let changed = false;
      for (const id of await ids()) {
        const settled = await files.read(`${id}.settled`);
        if (settled !== null) { checkSettled(settled, id); continue; }
        try {
          const before = await readVerified(`${id}.before`);
          const afterText = await files.read(`${id}.after`);
          // Before preparation there can be no live writes, but restoring verified
          // before bytes is safe and lets interrupted staging recover deterministically.
          let after = before;
          if (afterText !== null) {
            try { after = await parseBackup(afterText, hash); }
            catch { /* Invalid incoming staging must never prevent verified before-state rollback. */ }
          }
          const prepared = await files.read(`${id}.prepared`);
          const committed = await files.read(`${id}.committed`);
          const expected = marker(id, before, after);
          if (committed !== null && committed === expected && prepared === expected) {
            let matches = false;
            try { await verify(after.payload.records); matches = true; } catch { /* Roll back only before publishing completion. */ }
            if (matches) await settle(id, 'restored', before, after);
            else { await replace(before.payload.records); await settle(id, 'rolled-back', before, after); }
          } else {
            await replace(before.payload.records); await settle(id, 'rolled-back', before, after);
          }
          changed = true;
        } catch { throw withErrorMessage(new RecoveryBlocked('Recovery could not be verified. Retry recovery or save the available recovery copy. Do not clear app data.'), { key: "backup-service.recoveryCouldNotBeVerifiedRetryRecoveryOrSaveTheAvailableRecoveryCopyDoNotClearAppData" }); }
      }
      barrier.advance(changed);
      return changed;
    },
    async recoveryCopy() {
      for (const id of (await ids()).reverse()) {
        if (await files.read(`${id}.removed`) !== null) continue;
        const raw = await files.read(`${id}.before`);
        if (raw !== null) { await parseBackup(raw, hash); return raw; }
      }
      return null;
    },
    async removeRecoveryCopies() {
      if (!barrier.available() || serial) throw withErrorMessage(new RecoveryBlocked('Recovery copies cannot be removed while data is locked'), { key: "backup-service.recoveryCopiesCannotBeRemovedWhileDataIsLocked" });
      for (const id of await ids()) {
        const settled = await files.read(`${id}.settled`);
        if (settled === null) throw withErrorMessage(new RecoveryBlocked('An active recovery copy cannot be removed'), { key: "backup-service.anActiveRecoveryCopyCannotBeRemoved" });
        checkSettled(settled, id);
        if (await files.read(`${id}.removed`) === null) await writeVerified(`${id}.removed`, 'removed');
        // Completion marker stays: restart can distinguish intentional cleanup
        // from missing recovery evidence. Never remove a pending journal.
        await files.remove(`${id}.before`); await files.remove(`${id}.after`);
      }
    },
  };
}
