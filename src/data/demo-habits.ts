import type { SymbolViewProps } from 'expo-symbols';

/** Local demo data — will be replaced by persisted user data later. */

export type Habit = {
  id: string;
  title: string;
  detail: string;
  /** SF Symbol on iOS, Material Symbol on Android/web. */
  icon: SymbolViewProps['name'];
  tint: string;
  streak: number;
};

export const DEMO_USER_NAME = 'Alex';

export const DEMO_HABITS: Habit[] = [
  {
    id: 'water',
    title: 'Drink Water',
    detail: '8 glasses · All day',
    icon: { ios: 'drop.fill', android: 'water_drop', web: 'water_drop' },
    tint: '#5B8DEF',
    streak: 5,
  },
  {
    id: 'read',
    title: 'Read 20 Minutes',
    detail: 'Before bed',
    icon: { ios: 'book.fill', android: 'menu_book', web: 'menu_book' },
    tint: '#C084FC',
    streak: 21,
  },
  {
    id: 'exercise',
    title: 'Exercise',
    detail: '30 min · After work',
    icon: { ios: 'figure.run', android: 'directions_run', web: 'directions_run' },
    tint: '#60A5FA',
    streak: 3,
  },
  {
    id: 'meditate',
    title: 'Meditate',
    detail: '10 min · Morning',
    icon: { ios: 'figure.mind.and.body', android: 'self_improvement', web: 'self_improvement' },
    tint: '#8B7CF6',
    streak: 12,
  },
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
