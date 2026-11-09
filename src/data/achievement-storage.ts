import AsyncStorage from '@react-native-async-storage/async-storage';

import { ACHIEVEMENT_IDS } from '@/data/achievement-definitions';
import { isLocalDateKey } from '@/utils/date';
import type { AchievementCandidate, AchievementEvaluation } from '@/utils/achievements';

export const ACHIEVEMENTS_KEY = 'momentum:achievements:v1';
export type AchievementAward = AchievementCandidate & {
  ruleVersion: number;
  awardedAt: string;
  source: 'backfill' | 'evaluation';
};
export type AchievementCollection = { awards: Record<string, AchievementAward>; seenBadgeIds: string[] };
export const emptyAchievements = (): AchievementCollection => ({ awards: {}, seenBadgeIds: [] });
const object = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const integer = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;

export function parseAchievements(raw: string): AchievementCollection {
  const value: unknown = JSON.parse(raw);
  if (!object(value) || value.version !== 1 || !object(value.awards) || !Array.isArray(value.seenBadgeIds)) {
    throw new Error('Unreadable or unsupported achievements store');
  }
  for (const [id, award] of Object.entries(value.awards)) {
    if (!id || !object(award) || !integer(award.ruleVersion) || award.ruleVersion < 1 ||
      (ACHIEVEMENT_IDS.has(id) && award.ruleVersion !== 1) ||
      !isLocalDateKey(award.evidenceThrough) || typeof award.awardedAt !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(award.awardedAt) ||
      !Number.isFinite(Date.parse(award.awardedAt)) || new Date(award.awardedAt).toISOString() !== award.awardedAt ||
      (award.source !== 'backfill' && award.source !== 'evaluation') || !object(award.evidence)) {
      throw new Error('Unreadable or incompatible achievement award');
    }
    const evidence = award.evidence;
    if (!integer(evidence.metric) || !isLocalDateKey(evidence.windowEnd) || evidence.windowEnd !== award.evidenceThrough ||
      (evidence.windowStart !== undefined && (!isLocalDateKey(evidence.windowStart) || evidence.windowStart > evidence.windowEnd)) ||
      (evidence.habitId !== undefined && (typeof evidence.habitId !== 'string' || evidence.habitId.length === 0))) {
      throw new Error('Unreadable achievement evidence');
    }
  }
  const seen = value.seenBadgeIds;
  if (seen.some((id) => typeof id !== 'string' || !Object.hasOwn(value.awards as object, id)) || new Set(seen).size !== seen.length) {
    throw new Error('Unreadable achievement acknowledgement');
  }
  return { awards: value.awards as Record<string, AchievementAward>, seenBadgeIds: seen as string[] };
}

export async function loadAchievements(): Promise<AchievementCollection> {
  const raw = await AsyncStorage.getItem(ACHIEVEMENTS_KEY);
  return raw === null ? emptyAchievements() : parseAchievements(raw);
}

export async function saveAchievements(collection: AchievementCollection): Promise<void> {
  const raw = JSON.stringify({ version: 1, ...collection });
  parseAchievements(raw);
  await AsyncStorage.setItem(ACHIEVEMENTS_KEY, raw);
}

export function mergeAchievementAwards(current: AchievementCollection, evaluation: AchievementEvaluation, now: Date): AchievementCollection {
  const additions = Object.entries(evaluation.candidates).filter(([id]) => !Object.hasOwn(current.awards, id));
  if (additions.length === 0) return current;
  const source = Object.keys(current.awards).length === 0 ? 'backfill' : 'evaluation';
  const awardedAt = now.toISOString();
  return { ...current, awards: { ...current.awards, ...Object.fromEntries(additions.map(([id, candidate]) => [id, { ...candidate, ruleVersion: 1, awardedAt, source }])) } };
}

export function acknowledgeAchievements(current: AchievementCollection, ids: readonly string[]): AchievementCollection {
  const next = [...new Set([...current.seenBadgeIds, ...ids.filter((id) => Object.hasOwn(current.awards, id))])];
  return next.length === current.seenBadgeIds.length ? current : { ...current, seenBadgeIds: next };
}
