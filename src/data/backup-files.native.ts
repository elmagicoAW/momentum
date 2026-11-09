import { loadBackupFiles } from '@/data/backup-native-loader';
import type { JournalFiles } from '@/data/backup-service';

// Platform eligibility only; the provider also probes native capability and
// recovery evidence before mounting any data provider.
export const backupSupported = true;
export { hashBackupNative as hashBackup } from '@/data/backup-native-loader';
export const journalFiles: JournalFiles = {
  async list() { return (await loadBackupFiles()).journalFiles.list(); },
  async read(name) { return (await loadBackupFiles()).journalFiles.read(name); },
  async write(name, text) { return (await loadBackupFiles()).journalFiles.write(name, text); },
  async remove(name) { return (await loadBackupFiles()).journalFiles.remove(name); },
};
export async function pickBackup() { return (await loadBackupFiles()).pickBackup(); }
export async function saveBackup(text: string) { return (await loadBackupFiles()).saveBackup(text); }
export async function shareBackup(text: string) { return (await loadBackupFiles()).shareBackup(text); }
