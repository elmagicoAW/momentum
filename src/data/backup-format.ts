import { appLabel, appMessage, withErrorMessage } from '@/i18n/app-copy';
import { parseAchievements } from '@/data/achievement-storage';
import { compareKeys, isUserKey, schemaVersions, type RawRecord } from '@/data/backup-keys';
import { parseV1, parseV2 } from '@/data/completion-storage';
import { parseGoalStore } from '@/data/goal-storage';
import { parseStore } from '@/data/habit-storage';
import { parseProfileStore } from '@/data/profile-storage';
import { parseRoutineStore } from '@/data/routine-storage';
import { isLocalDateKey } from '@/utils/date';

export const LIMITS = { file: 8 * 1024 * 1024, raw: 1024 * 1024, total: 4 * 1024 * 1024, records: 20000, key: 256, depth: 32 };
export type Hash = (text: string) => Promise<string>;
export type Backup = {
  format: 'momentum.local-backup'; backupVersion: 1; createdAt: string;
  app: { id: 'momentum'; version: string; expoSdkMajor: number };
  schemaVersions: typeof schemaVersions;
  payload: { scope: 'all-user-data'; records: RawRecord[] };
  integrity: { algorithm: 'SHA-256'; digest: string };
};
export const bytes = (text: string) => new TextEncoder().encode(text).length;
export const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (object(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  if (value === null || typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) return JSON.stringify(value);
  throw withErrorMessage(new Error('Invalid JSON value'), {key: 'backup.validation.invalidJSONValue'});
}

/** JSON.parse alone accepts duplicate member names. Scan first, bounded by depth.
 * String contents (including raw storage JSON) are opaque here. */
export function strictJSON(text: string): unknown {
  let i = 0;
  const ws = () => { while (/\s/.test(text[i] ?? '') && i < text.length) i++; };
  const string = () => {
    const start = i++;
    while (i < text.length) {
      if (text[i] === '\\') { i += 2; continue; }
      if (text[i++] === '"') return JSON.parse(text.slice(start, i)) as string;
    }
    throw withErrorMessage(new Error('Incomplete JSON string'), {key: 'backup.validation.incompleteJSONString'});
  };
  const value = (depth: number): void => {
    if (depth > LIMITS.depth) throw withErrorMessage(new Error('Backup nesting is too deep'), { key: "backup-format.backupNestingIsTooDeep" });
    ws();
    if (text[i] === '"') { string(); return; }
    if (text[i] === '{' || text[i] === '[') {
      const obj = text[i++] === '{'; const end = obj ? '}' : ']'; const keys = new Set<string>();
      ws(); if (text[i] === end) { i++; return; }
      for (;;) {
        ws();
        if (obj) {
          if (text[i] !== '"') throw withErrorMessage(new Error('Invalid JSON member'), {key: 'backup.validation.invalidJSONMember'});
          const key = string();
          if (keys.has(key)) throw withErrorMessage(new Error('Duplicate JSON member'), { key: "backup-format.duplicateJSONMember" });
          keys.add(key); ws(); if (text[i++] !== ':') throw withErrorMessage(new Error('Invalid JSON member'), {key: 'backup.validation.invalidJSONMember'});
        }
        value(depth + 1); ws();
        if (text[i] === end) { i++; return; }
        if (text[i++] !== ',') throw withErrorMessage(new Error('Invalid JSON structure'), {key: 'backup.validation.invalidJSONStructure'});
      }
    }
    const match = /^(?:null|true|false|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(text.slice(i));
    if (!match) throw withErrorMessage(new Error('Invalid JSON'), {key: 'backup.validation.invalidJSON'});
    i += match[0].length;
  };
  value(0); ws(); if (i !== text.length) throw withErrorMessage(new Error('Unexpected JSON content'), { key: "backup-format.unexpectedJSONContent" });
  return JSON.parse(text);
}

export function validateRecords(value: unknown): RawRecord[] {
  if (!Array.isArray(value) || value.length > LIMITS.records) throw withErrorMessage(new Error('Too many backup records'), { key: "backup-format.tooManyBackupRecords" });
  const seen = new Set<string>(); let total = 0;
  for (const record of value) {
    if (!object(record) || Object.keys(record).sort().join(',') !== 'key,raw' || typeof record.key !== 'string' || typeof record.raw !== 'string' || !isUserKey(record.key)) throw withErrorMessage(new Error('Backup contains unrelated or invalid storage keys'), { key: "backup-format.backupContainsUnrelatedOrInvalidStorageKeys" });
    if (seen.has(record.key)) throw withErrorMessage(new Error('Duplicate backup key'), { key: "backup-format.duplicateBackupKey" });
    seen.add(record.key);
    const keySize = bytes(record.key); const rawSize = bytes(record.raw); total += keySize + rawSize;
    if (keySize > LIMITS.key || rawSize > LIMITS.raw || total > LIMITS.total) throw withErrorMessage(new Error('Backup data exceeds supported size limits'), { key: "backup-format.backupDataExceedsSupportedSizeLimits" });
  }
  return (value as RawRecord[]).map((r) => ({ ...r })).sort(compareKeys);
}

export async function createBackup(records: RawRecord[], hash: Hash, appVersion = '1.0.0', date = new Date()): Promise<Backup> {
  const body = {
    format: 'momentum.local-backup' as const, backupVersion: 1 as const, createdAt: date.toISOString(),
    app: { id: 'momentum' as const, version: appVersion, expoSdkMajor: 58 as const }, schemaVersions,
    payload: { scope: 'all-user-data' as const, records: validateRecords(records) },
  };
  const backup: Backup = { ...body, integrity: { algorithm: 'SHA-256', digest: await hash(canonical(body)) } };
  if (bytes(JSON.stringify(backup)) > LIMITS.file) throw withErrorMessage(new Error('Backup exceeds the 8 MiB file limit'), { key: "backup-format.backupExceedsThe8MiBFileLimit" });
  return backup;
}
export async function parseBackup(text: string, hash: Hash): Promise<Backup> {
  if (bytes(text) > LIMITS.file) throw withErrorMessage(new Error('Backup exceeds the 8 MiB file limit'), { key: "backup-format.backupExceedsThe8MiBFileLimit" });
  const v = strictJSON(text);
  if (!object(v) || v.format !== 'momentum.local-backup') throw withErrorMessage(new Error('Not a MOMENTUM backup'), { key: "backup-format.notAMOMENTUMBackup" });
  if (v.backupVersion !== 1 || canonical(v.schemaVersions) !== canonical(schemaVersions)) throw withErrorMessage(new Error('Unsupported backup/schema version; use a compatible MOMENTUM version'), { key: "backup-format.unsupportedBackupSchemaVersionUseACompatibleMOMENTUMVersion" });
  if (Object.keys(v).sort().join(',') !== 'app,backupVersion,createdAt,format,integrity,payload,schemaVersions' ||
    !object(v.app) || Object.keys(v.app).sort().join(',') !== 'expoSdkMajor,id,version' || v.app.id !== 'momentum' || typeof v.app.version !== 'string' || !v.app.version.length || v.app.version.length > 80 || typeof v.app.expoSdkMajor !== 'number' || !Number.isSafeInteger(v.app.expoSdkMajor) || v.app.expoSdkMajor < 1 || v.app.expoSdkMajor > 10000 ||
    typeof v.createdAt !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v.createdAt) || !Number.isFinite(Date.parse(v.createdAt)) || new Date(v.createdAt).toISOString() !== v.createdAt ||
    !object(v.payload) || v.payload.scope !== 'all-user-data' || Object.keys(v.payload).sort().join(',') !== 'records,scope' ||
    !object(v.integrity) || Object.keys(v.integrity).sort().join(',') !== 'algorithm,digest' || v.integrity.algorithm !== 'SHA-256' || typeof v.integrity.digest !== 'string' || !/^[a-f0-9]{64}$/.test(v.integrity.digest)) throw withErrorMessage(new Error('Invalid backup metadata'), { key: "backup-format.invalidBackupMetadata" });
  validateRecords(v.payload.records);
  const { integrity, ...body } = v;
  if (await hash(canonical(body)) !== integrity.digest) throw withErrorMessage(new Error('Backup is incomplete or changed (checksum mismatch)'), { key: "backup-format.backupIsIncompleteOrChangedChecksumMismatch" });
  return v as Backup;
}

export type Preview = { restorable: boolean; errors: string[]; warnings: string[]; summary: string[] };
export function inspectRecords(records: RawRecord[]): Preview {
  const errors: string[] = []; const warnings: string[] = []; const summary: string[] = [];
  const ids = new Set<string>(); const references = new Set<string>(); const dates = new Set<string>();
  const unreadable = new Set<string>();
  let habits = false; let history = false; let shadows = 0;
  const keys = new Set(records.map((r) => r.key));
  for (const { key, raw } of records) {
    try {
      // Reject ambiguous/prototype-sensitive records on activation, never alter archive bytes.
      const parsed = strictJSON(raw);
      const safe = (v: unknown): void => {
        if (Array.isArray(v)) v.forEach(safe);
        else if (object(v)) for (const [k, val] of Object.entries(v)) {
          if (['__proto__', 'constructor', 'prototype'].includes(k)) throw withErrorMessage(new Error('Unsafe record member'), { key: "backup-format.unsafeRecordMember" });
          safe(val);
        }
      }; safe(parsed);
      if (key === 'momentum:habits:v2' || key === 'momentum:habits:v1') {
        const list = parseStore(raw, key.endsWith('v2') ? 2 : 1); habits = true;
        if (key.endsWith('v2') || !keys.has('momentum:habits:v2')) {
          list.forEach((h) => ids.add(h.id));
          summary.push(appMessage("backup.summary.habits", { total: (list.length), done: (list.filter((h) => h.tracking.type === 'tick').length), value: (list.filter((h) => h.tracking.type === 'count').length), steps: (list.filter((h) => h.tracking.type === 'checklist').length) }));
        } else shadows++;
      } else if (/^momentum:(completions:v1|checkins:v2):/.test(key)) {
        const date = key.split(':').at(-1)!; if (!isLocalDateKey(date)) throw withErrorMessage(new Error('Invalid local date'), { key: "backup-format.invalidLocalDate" });
        const day = key.startsWith('momentum:checkins:') ? parseV2(raw) : parseV1(raw);
        Object.keys(day.entries).forEach((id) => { if (!id) throw withErrorMessage(new Error('Empty habit ID'), { key: "backup-format.emptyHabitID" }); references.add(id); });
        dates.add(date); history = true;
        if (key.startsWith('momentum:completions:') && keys.has(`momentum:checkins:v2:${date}`)) shadows++;
      } else if (key === 'momentum:goals:v1') {
        const list = parseGoalStore(raw); list.forEach((g) => g.habitIds.forEach((id) => references.add(id)));
        summary.push(appMessage("backup.summary.goals", { total: (list.length), done: (list.filter((g) => g.status === 'active').length), value: (list.filter((g) => g.status === 'paused').length), steps: (list.filter((g) => g.status === 'completed').length) }));
      } else if (key === 'momentum:routines:v1') {
        const list = parseRoutineStore(raw); list.forEach((r) => r.habitIds.forEach((id) => references.add(id)));
        summary.push(appMessage("backup.summary.routines", { count: (list.length) }));
      } else if (key === 'momentum:profile:v1') { parseProfileStore(raw); summary.push(appLabel("backup-format.profileAndNamePromptStateIncluded")); }
      else if (key === 'momentum:achievements:v1') {
        const collection = parseAchievements(raw);
        Object.values(collection.awards).forEach((a) => { if (a.evidence.habitId) references.add(a.evidence.habitId); });
        summary.push(appMessage("backup.summary.awards", { total: (Object.keys(collection.awards).length), done: (collection.seenBadgeIds.length) }));
      } else if (key === 'momentum:backup:pre-habits-v1') {
        if (!object(parsed) || parsed.version !== 1 || typeof parsed.reason !== 'string' || typeof parsed.createdAt !== 'string' || !Array.isArray(parsed.legacyHabitIds) || !parsed.legacyHabitIds.every((id) => typeof id === 'string') || !object(parsed.completions)) throw withErrorMessage(new Error('Invalid migration snapshot'), { key: "backup-format.invalidMigrationSnapshot" });
        const nested = Object.entries(parsed.completions).map(([k, v]) => { if (typeof v !== 'string' || !/^momentum:(completions:v1|checkins:v2):/.test(k)) throw withErrorMessage(new Error('Invalid migration entry'), { key: "backup-format.invalidMigrationEntry" }); return { key: k, raw: v }; });
        const report = inspectRecords([{ key: 'momentum:habits:v2', raw: '{"version":2,"habits":[]}' }, ...nested]);
        if (!report.restorable) throw withErrorMessage(new Error('Unreadable migration history'), { key: "backup-format.unreadableMigrationHistory" });
        summary.push(appLabel("backup-format.originalPreHabitsMigrationSnapshotIncluded"));
      } else throw withErrorMessage(new Error('Unsupported storage version'), { key: "backup-format.unsupportedStorageVersion" });
    } catch { unreadable.add(key.split(':')[1]); errors.push(appMessage("backup.record.unreadable", { storageKey: (key) })); }
  }
  if (history && !habits) errors.push(appLabel("backup-format.completionOnlyArchivesCannotBeActivatedDoingSoWouldFabricateDemoHabits"));
  const orphans = [...references].filter((id) => !ids.has(id)).length;
  if (orphans) warnings.push(appMessage("backup.references.missing", { count: (orphans) }));
  if (shadows) warnings.push(appMessage("backup.records.legacy", { count: (shadows) }));
  const orderedDates = [...dates].sort();
  for (const [family, label] of [['habits', appLabel("backup-format.habit")], ['goals', appLabel("backup-format.goal")], ['routines', appLabel("backup-format.routine")], ['profile', appLabel("backup-format.profile")], ['achievements', appLabel("backup-format.achievement")]]) {
    if (unreadable.has(family)) summary.push(appMessage("backup.family.unknown", { label: (label) }));
    else if (!records.some((r) => r.key.startsWith(`momentum:${family}:`))) summary.push(appMessage("backup.family.missing", { family: (family) }));
  }
  summary.push(unreadable.has('checkins') || unreadable.has('completions') ? appLabel("backup-format.historyContentsUnknownUnreadableUnsupportedRecordsIncluded") : appMessage("backup.summary.history", { count: (dates.size), dateRange: (dates.size ? ` (${orderedDates[0]} – ${orderedDates.at(-1)})` : '') }), appMessage("backup.summary.records", { count: (records.length) }));
  if (!records.length) warnings.push(appLabel("backup-format.eMPTYBACKUPReplacingWillRemoveAllCurrentUserData"));
  return { restorable: errors.length === 0, errors, warnings, summary };
}
export function requireRestorable(backup: Backup): Preview {
  const preview = inspectRecords(backup.payload.records);
  if (!preview.restorable) throw withErrorMessage(new Error('Some records cannot be read safely. This lossless archive cannot be restored by this app version.'), { key: "backup-format.someRecordsCannotBeReadSafelyThisLosslessArchiveCannotBeRestoredByThisAppVersion" });
  return preview;
}
