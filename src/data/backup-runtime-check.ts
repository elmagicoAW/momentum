import type { Hash } from '@/data/backup-format';

export type BackupRuntimeState =
  | { kind: 'ready' }
  | { kind: 'unavailable'; message: string }
  | { kind: 'blocked'; message: string };
export const RUNTIME_INSTRUCTIONS = 'Update Expo Go in place to a compatible SDK 58 build, or use a newly compiled SDK 58 development build. Do not uninstall or clear app data.';

/** Check files even without crypto: optional backup must not bypass recovery.
 * This probe never writes/deletes a journal or touches live user storage. */
export async function checkBackupRuntime(list: () => Promise<string[]>, hash: Hash): Promise<BackupRuntimeState> {
  let evidence: string[];
  try { evidence = await list(); }
  catch {
    return { kind: 'blocked', message: `Recovery files cannot be inspected in this native runtime. Editing remains blocked to avoid exposing an interrupted replacement. ${RUNTIME_INSTRUCTIONS}` };
  }
  try {
    const digest = await hash('');
    if (digest !== 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855') throw new Error('SHA-256 self-check failed');
    return { kind: 'ready' };
  } catch {
    return evidence.length === 0
      ? { kind: 'unavailable', message: `Data & Backup is unavailable: native ExpoCrypto SHA-256 could not be loaded or verified. No recovery journal exists, so the rest of MOMENTUM can continue. ${RUNTIME_INSTRUCTIONS}` }
      : { kind: 'blocked', message: `Recovery evidence exists, but native ExpoCrypto SHA-256 could not be loaded or verified. Editing remains blocked; no recovery verification has been skipped. ${RUNTIME_INSTRUCTIONS}` };
  }
}
