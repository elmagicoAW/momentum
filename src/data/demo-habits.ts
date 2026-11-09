import type { HabitIconKey } from '@/data/habit-options';

export const DEMO_USER_NAME = 'Alex';

/**
 * The four habits the app shipped with before habits were user-editable.
 * Saved completions reference these exact IDs, so the one-time migration in
 * `habit-storage.ts` recreates them with the same IDs. Never change the IDs.
 */
export const LEGACY_DEMO_HABITS: {
  id: string;
  name: string;
  description: string;
  icon: HabitIconKey;
  color: string;
}[] = [
  { id: 'water', name: 'Drink Water', description: '8 glasses · All day', icon: 'water', color: '#5B8DEF' },
  { id: 'read', name: 'Read 20 Minutes', description: 'Before bed', icon: 'book', color: '#C084FC' },
  { id: 'exercise', name: 'Exercise', description: '30 min · After work', icon: 'run', color: '#60A5FA' },
  { id: 'meditate', name: 'Meditate', description: '10 min · Morning', icon: 'mind', color: '#8B7CF6' },
];

const MOTIVATION = [
  { quote: 'Small steps every day add up to big results.', author: 'Unknown' },
  { quote: 'We are what we repeatedly do. Excellence, then, is not an act, but a habit.', author: 'Will Durant' },
  { quote: 'You do not rise to the level of your goals. You fall to the level of your systems.', author: 'James Clear' },
  { quote: 'Motivation gets you going, but discipline keeps you growing.', author: 'John C. Maxwell' },
  { quote: 'The secret of getting ahead is getting started.', author: 'Mark Twain' },
  { quote: 'Success is the sum of small efforts, repeated day in and day out.', author: 'Robert Collier' },
  { quote: 'Discipline is choosing between what you want now and what you want most.', author: 'Abraham Lincoln' },
];

/** Returns a stable message for the given day so it changes once per day. */
export function getDailyMotivation(date: Date) {
  const start = new Date(date.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((date.getTime() - start.getTime()) / 86_400_000);
  return MOTIVATION[dayOfYear % MOTIVATION.length];
}
