import AsyncStorage from '@react-native-async-storage/async-storage';

import { isLocalDateKey } from '@/utils/date';

export type GoalStatus = 'active' | 'paused' | 'completed';

export const GOAL_STATUSES: readonly GoalStatus[] = ['active', 'paused', 'completed'];

export type Goal = {
  /** Generated once, never changed or reused. */
  id: string;
  title: string;
  description?: string;
  /** Local "YYYY-MM-DD"; the day the goal was created. Never edited. */
  startDate: string;
  /** Local "YYYY-MM-DD"; on or after `startDate`. */
  targetDate: string;
  /** Set manually by the user. Habit Consistency never changes it. */
  status: GoalStatus;
  /** Local "YYYY-MM-DD"; present only while `status` is 'completed'. */
  completedAt?: string;
  /**
   * Linked habit IDs, unique. May contain IDs of habits deleted since — those
   * are ignored everywhere and dropped the next time the goal is saved.
   */
  habitIds: string[];
  /** ISO timestamps. */
  createdAt: string;
  updatedAt: string;
};

/** Everything the user edits; the rest is managed by `useGoals`. */
export type GoalInput = Pick<Goal, 'title' | 'description' | 'targetDate' | 'status' | 'habitIds'>;

/**
 * Storage layout: `momentum:goals:v1` → `{ version: 1, goals: Goal[] }`.
 * Habits and completion records are never written here.
 */
const GOALS_KEY = 'momentum:goals:v1';
const STORE_VERSION = 1;

// ---------------------------------------------------------------------------
// Parsing — strict, so corrupt data is reported instead of silently replaced.
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isGoalStatus(value: unknown): value is GoalStatus {
  return typeof value === 'string' && (GOAL_STATUSES as readonly string[]).includes(value);
}

function parseGoal(value: unknown): Goal | null {
  if (!isRecord(value)) return null;
  const { id, title, description, startDate, targetDate, status, completedAt, habitIds, createdAt, updatedAt } =
    value;
  if (typeof id !== 'string' || id.length === 0) return null;
  if (typeof title !== 'string') return null;
  if (description !== undefined && typeof description !== 'string') return null;
  if (!isLocalDateKey(startDate) || !isLocalDateKey(targetDate)) return null;
  if (!isGoalStatus(status)) return null;
  if (completedAt !== undefined && !isLocalDateKey(completedAt)) return null;
  if (!Array.isArray(habitIds) || !habitIds.every((h) => typeof h === 'string')) return null;
  if (typeof createdAt !== 'string' || typeof updatedAt !== 'string') return null;
  return {
    id,
    title,
    ...(description ? { description } : {}),
    startDate,
    targetDate,
    status,
    ...(status === 'completed' && completedAt ? { completedAt } : {}),
    habitIds: [...new Set(habitIds as string[])],
    createdAt,
    updatedAt,
  };
}

export function parseGoalStore(raw: string): Goal[] {
  const data: unknown = JSON.parse(raw);
  if (!isRecord(data) || !Array.isArray(data.goals)) {
    throw new Error('Saved goals have an unexpected format');
  }
  if (data.version !== STORE_VERSION) {
    throw new Error(`Saved goals use unsupported version ${String(data.version)}`);
  }
  const goals = data.goals.map(parseGoal);
  if (goals.some((goal) => goal === null)) {
    throw new Error('Saved goals contain an invalid entry');
  }
  const valid = goals as Goal[];
  if (new Set(valid.map((g) => g.id)).size !== valid.length) {
    throw new Error('Saved goals contain duplicate IDs');
  }
  return valid;
}

// ---------------------------------------------------------------------------
// IDs
// ---------------------------------------------------------------------------

/** e.g. `g_mh9x2k1a_4f8z0q`. Checked against existing IDs so it can't clash. */
export function createGoalId(existingIds: Iterable<string>): string {
  const taken = new Set(existingIds);
  let id: string;
  do {
    const random = Math.random().toString(36).slice(2, 8).padEnd(6, '0');
    id = `g_${Date.now().toString(36)}_${random}`;
  } while (taken.has(id));
  return id;
}

// ---------------------------------------------------------------------------
// Load / save
// ---------------------------------------------------------------------------

/**
 * Loads goals. Nothing saved yet → empty list (nothing is written).
 * Throws on any read/parse failure so the caller can show an error — it never
 * falls back to an empty list over existing data.
 */
export async function loadGoals(): Promise<Goal[]> {
  const raw = await AsyncStorage.getItem(GOALS_KEY);
  if (raw == null) return [];
  return parseGoalStore(raw);
}

export async function saveGoals(goals: readonly Goal[]): Promise<void> {
  await AsyncStorage.setItem(GOALS_KEY, JSON.stringify({ version: STORE_VERSION, goals }));
}
