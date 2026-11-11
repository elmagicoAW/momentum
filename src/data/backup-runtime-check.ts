import { appLabel, appMessage, withErrorMessage } from '@/i18n/app-copy';
import type { Hash } from '@/data/backup-format';

export type BackupRuntimeState =
  | { kind: 'ready' }
  | { kind: 'unavailable'; message: string }
  | { kind: 'blocked'; message: string };
export const RUNTIME_INSTRUCTIONS = appLabel("backup-runtime-check.updateExpoGoInPlaceToACompatibleSDK58BuildOrUseANewlyCompiledSDK58DevelopmentBuildDoNotUninstallOrClearAppData");

/** Check files even without crypto: optional backup must not bypass recovery.
 * This probe never writes/deletes a journal or touches live user storage. */
export async function checkBackupRuntime(list: () => Promise<string[]>, hash: Hash): Promise<BackupRuntimeState> {
  let evidence: string[];
  try { evidence = await list(); }
  catch {
    return { kind: 'blocked', message: appMessage("backup.runtime.inspectionBlocked", { instructions: (RUNTIME_INSTRUCTIONS) }) };
  }
  try {
    const digest = await hash('');
    if (digest !== 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855') throw withErrorMessage(new Error('SHA-256 self-check failed'), { key: "backup-runtime-check.sHA256SelfCheckFailed" });
    return { kind: 'ready' };
  } catch {
    return evidence.length === 0
      ? { kind: 'unavailable', message: appMessage("backup.runtime.cryptoUnavailable", { instructions: (RUNTIME_INSTRUCTIONS) }) }
      : { kind: 'blocked', message: appMessage("backup.runtime.cryptoBlocked", { instructions: (RUNTIME_INSTRUCTIONS) }) };
  }
}
