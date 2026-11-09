export type RawRecord = { key: string; raw: string };
export const schemaVersions = {
  habits: [1, 2], completions: [1], checkins: [2], goals: [1], routines: [1],
  profile: [1], achievements: [1], preHabitsBackup: [1],
};

// Deliberately excludes other momentum/Expo keys. Unknown versions in these
// user-owned families are archived but cannot be activated by this version.
export function isUserKey(key: string): boolean {
  return /^momentum:(habits|goals|routines|profile|achievements):v[^:]+$/.test(key) ||
    /^momentum:(checkins|completions):v[^:]+:/.test(key) || key === 'momentum:backup:pre-habits-v1';
}
export const compareKeys = (a: RawRecord, b: RawRecord) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
