import type { JournalFiles } from '@/data/backup-service';
export const backupSupported = false;
const unavailable = async (): Promise<never> => { throw new Error('Manual Data & Backup is available in the Android/iOS app.'); };
export const hashBackup = unavailable;
export const pickBackup = unavailable;
export const saveBackup = unavailable;
export const shareBackup = unavailable;
export const journalFiles: JournalFiles = { list: unavailable, read: unavailable, write: unavailable, remove: unavailable };
