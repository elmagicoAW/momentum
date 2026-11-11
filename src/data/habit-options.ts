import { appLabel } from '@/i18n/app-copy';
import type { SymbolViewProps } from 'expo-symbols';

type SymbolName = SymbolViewProps['name'];

type IconOption = { label: string; symbol: SymbolName };

/**
 * Icons users can pick for a habit. Habits store the short key (e.g. 'water'),
 * not the platform symbol name, so saved data never depends on symbol names.
 */
export const HABIT_ICONS = {
  water: { get label() { return appLabel("habit-options.water"); }, symbol: { ios: 'drop.fill', android: 'water_drop', web: 'water_drop' } },
  book: { get label() { return appLabel("habit-options.reading"); }, symbol: { ios: 'book.fill', android: 'menu_book', web: 'menu_book' } },
  run: { get label() { return appLabel("habit-options.running"); }, symbol: { ios: 'figure.run', android: 'directions_run', web: 'directions_run' } },
  mind: {
    get label() { return appLabel("habit-options.mindfulness"); },
    symbol: { ios: 'figure.mind.and.body', android: 'self_improvement', web: 'self_improvement' },
  },
  walk: { get label() { return appLabel("habit-options.walking"); }, symbol: { ios: 'figure.walk', android: 'directions_walk', web: 'directions_walk' } },
  strength: {
    get label() { return appLabel("habit-options.strength"); },
    symbol: { ios: 'dumbbell.fill', android: 'fitness_center', web: 'fitness_center' },
  },
  sleep: { get label() { return appLabel("habit-options.sleep"); }, symbol: { ios: 'moon.fill', android: 'bedtime', web: 'bedtime' } },
  food: { get label() { return appLabel("habit-options.nutrition"); }, symbol: { ios: 'fork.knife', android: 'restaurant', web: 'restaurant' } },
  journal: { get label() { return appLabel("habit-options.journal"); }, symbol: { ios: 'square.and.pencil', android: 'edit_note', web: 'edit_note' } },
  learn: { get label() { return appLabel("habit-options.learning"); }, symbol: { ios: 'graduationcap.fill', android: 'school', web: 'school' } },
  music: { get label() { return appLabel("habit-options.music"); }, symbol: { ios: 'music.note', android: 'music_note', web: 'music_note' } },
  art: { get label() { return appLabel("habit-options.creativity"); }, symbol: { ios: 'paintbrush.fill', android: 'brush', web: 'brush' } },
  heart: { get label() { return appLabel("habit-options.health"); }, symbol: { ios: 'heart.fill', android: 'favorite', web: 'favorite' } },
  money: { get label() { return appLabel("habit-options.savings"); }, symbol: { ios: 'banknote.fill', android: 'savings', web: 'savings' } },
  nature: { get label() { return appLabel("habit-options.nature"); }, symbol: { ios: 'leaf.fill', android: 'eco', web: 'eco' } },
  sun: { get label() { return appLabel("habit-options.morning"); }, symbol: { ios: 'sun.max.fill', android: 'wb_sunny', web: 'wb_sunny' } },
} satisfies Record<string, IconOption>;

export type HabitIconKey = keyof typeof HABIT_ICONS;

export const HABIT_ICON_KEYS = Object.keys(HABIT_ICONS) as HabitIconKey[];

export const DEFAULT_HABIT_ICON: HabitIconKey = 'sun';

const FALLBACK_SYMBOL: SymbolName = { ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' };

export function isHabitIconKey(key: string): key is HabitIconKey {
  return Object.prototype.hasOwnProperty.call(HABIT_ICONS, key);
}

/** Platform symbol for a stored icon key, with a safe fallback for unknown keys. */
export function habitIconSymbol(key: string): SymbolName {
  if (!isHabitIconKey(key)) return FALLBACK_SYMBOL;
  // Widened to avoid TypeScript building a huge union of every symbol literal.
  const icons: Record<HabitIconKey, IconOption> = HABIT_ICONS;
  return icons[key].symbol;
}

/** Accent colors that read well on the dark surfaces. */
export const HABIT_COLORS = [
  { value: '#8B7CF6', get label() { return appLabel("habit-options.violet"); } },
  { value: '#5B8DEF', get label() { return appLabel("habit-options.blue"); } },
  { value: '#60A5FA', get label() { return appLabel("habit-options.sky"); } },
  { value: '#C084FC', get label() { return appLabel("habit-options.lavender"); } },
  { value: '#22D3EE', get label() { return appLabel("habit-options.cyan"); } },
  { value: '#4ADE9B', get label() { return appLabel("habit-options.mint"); } },
  { value: '#FBBF24', get label() { return appLabel("habit-options.amber"); } },
  { value: '#F472B6', get label() { return appLabel("habit-options.pink"); } },
  { value: '#F87171', get label() { return appLabel("habit-options.coral"); } },
] as const;

export const DEFAULT_HABIT_COLOR = HABIT_COLORS[0].value;
