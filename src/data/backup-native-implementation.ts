import { appLabel, withErrorMessage } from '@/i18n/app-copy';
import { Directory, File, Paths } from 'expo-file-system';

import { bytes, LIMITS, parseBackup } from '@/data/backup-format';
import { boundedText, pickedText } from '@/data/backup-io';
import type { JournalFiles } from '@/data/backup-service';

import { hashBackupNative as hashBackup, loadSharing } from '@/data/backup-native-loader';
const directory = () => {
  const dir = new Directory(Paths.document, 'momentum-backup-recovery');
  dir.create({ idempotent: true, intermediates: true }); return dir;
};
const internal = (name: string) => {
  if (!/^restore-\d{13}-[a-z0-9]+\.(before|after|prepared|committed|settled|removed)$/.test(name)) throw withErrorMessage(new Error('Invalid internal recovery filename'), { key: "backup-native-implementation.invalidInternalRecoveryFilename" });
  return new File(directory(), name);
};
export const journalFiles: JournalFiles = {
  async list() {
    // Unexpected contents in our dedicated directory are ambiguous; fail closed.
    return directory().list().map((entry) => { internal(entry.name); return entry.name; });
  },
  async read(name) { const file = internal(name); return file.exists ? boundedText(file.readableStream()) : null; },
  async write(name, text) {
    const size = bytes(text);
    if (size > LIMITS.file) throw withErrorMessage(new Error('Recovery copy exceeds supported size'), { key: "backup-native-implementation.recoveryCopyExceedsSupportedSize" });
    // Reserve headroom; writes/read-back remain authoritative, not this estimate.
    if (Paths.availableDiskSpace < size + 16 * 1024 * 1024) throw withErrorMessage(new Error('Not enough free space to keep a recovery copy; nothing can be replaced safely'), { key: "backup-native-implementation.notEnoughFreeSpaceToKeepARecoveryCopyNothingCanBeReplacedSafely" });
    const file = internal(name); file.create({ overwrite: false }); await file.write(text);
  },
  async remove(name) { const file = internal(name); if (file.exists) file.delete(); },
};
export async function pickBackup(): Promise<{ text: string; name: string } | null> {
  // All-files selection intentionally allows provider MIME misclassification.
  let name = appLabel("backup-native-implementation.backupFile");
  const text = await pickedText(() => File.pickFileAsync({ multipleFiles: false, mimeTypes: ['*/*'] }), async (file) => {
    if (!file) throw withErrorMessage(new Error('No backup file selected'), { key: "backup-native-implementation.noBackupFileSelected" });
    name = file.name.slice(0, 256);
    if (file.size > LIMITS.file) throw withErrorMessage(new Error('Backup exceeds the 8 MiB file limit'), { key: "backup-native-implementation.backupExceedsThe8MiBFileLimit" });
    return boundedText(file.readableStream());
  });
  return text === null ? null : { text, name };
}
const filename = () => `momentum-backup-${new Date().toISOString().replace(/[:.]/g, '-')}-${Math.random().toString(36).slice(2, 7)}.json`;
export async function saveBackup(text: string): Promise<boolean> {
  await parseBackup(text, hashBackup);
  // Directory picker cancellation is an SDK rejection. Inspect stable error codes,
  // never mistake a permission/write failure for a successful save.
  let dir: Directory;
  try { dir = await Directory.pickDirectoryAsync(); }
  catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
    if (/CANCEL/i.test(code)) return false;
    throw withErrorMessage(new Error('No save folder was selected or access was denied. Try again or use Share.'), { key: "backup-native-implementation.noSaveFolderWasSelectedOrAccessWasDeniedTryAgainOrUseShare" });
  }
  const file = dir.createFile(filename(), 'application/json'); await file.write(text);
  if (await boundedText(file.readableStream()) !== text) throw withErrorMessage(new Error('Saved file could not be verified. Try another local folder.'), { key: "backup-native-implementation.savedFileCouldNotBeVerifiedTryAnotherLocalFolder" });
  return true;
}
export async function shareBackup(text: string): Promise<void> {
  await parseBackup(text, hashBackup);
  const Sharing = await loadSharing();
  if (!await Sharing.isAvailableAsync()) throw withErrorMessage(new Error('Sharing is unavailable on this device. Use Save to device.'), { key: "backup-native-implementation.sharingIsUnavailableOnThisDeviceUseSaveToDevice" });
  const dir = new Directory(Paths.cache, 'momentum-backup-exports'); dir.create({ idempotent: true });
  // Only owned stale temporary JSON files. Keep recent files for receiving apps.
  for (const old of dir.list()) if (old instanceof File && /^momentum-backup-.*\.json$/.test(old.name) && old.modificationTime !== null && old.modificationTime < Date.now() - 7 * 86400000) old.delete();
  const file = new File(dir, filename()); file.create(); await file.write(text);
  if (await boundedText(file.readableStream()) !== text) throw withErrorMessage(new Error('Export verification failed'), { key: "backup-native-implementation.exportVerificationFailed" });
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: appLabel("backup-native-implementation.saveOrShareYourUnencryptedMOMENTUMBackup") });
}
