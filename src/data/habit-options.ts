import type { SymbolViewProps } from 'expo-symbols';

type SymbolName = SymbolViewProps['name'];

type IconOption = { label: string; symbol: SymbolName };

/**
 * Icons users can pick for a habit. Habits store the short key (e.g. 'water'),
 * not the platform symbol name, so saved data never depends on symbol names.
 */
export const HABIT_ICONS = {
  water: { label: 'Water', symbol: { ios: 'drop.fill', android: 'water_drop', web: 'water_drop' } },
  book: { label: 'Reading', symbol: { ios: 'book.fill', android: 'menu_book', web: 'menu_book' } },
  run: { label: 'Running', symbol: { ios: 'figure.run', android: 'directions_run', web: 'directions_run' } },
  mind: {
    label: 'Mindfulness',
    symbol: { ios: 'figure.mind.and.body', android: 'self_improvement', web: 'self_improvement' },
  },
  walk: { label: 'Walking', symbol: { ios: 'figure.walk', android: 'directions_walk', web: 'directions_walk' } },
  strength: {
    label: 'Strength',
    symbol: { ios: 'dumbbell.fill', android: 'fitness_center', web: 'fitness_center' },
  },
  sleep: { label: 'Sleep', symbol: { ios: 'moon.fill', android: 'bedtime', web: 'bedtime' } },
  food: { label: 'Nutrition', symbol: { ios: 'fork.knife', android: 'restaurant', web: 'restaurant' } },
  journal: { label: 'Journal', symbol: { ios: 'square.and.pencil', android: 'edit_note', web: 'edit_note' } },
  learn: { label: 'Learning', symbol: { ios: 'graduationcap.fill', android: 'school', web: 'school' } },
  music: { label: 'Music', symbol: { ios: 'music.note', android: 'music_note', web: 'music_note' } },
  art: { label: 'Creativity', symbol: { ios: 'paintbrush.fill', android: 'brush', web: 'brush' } },
  heart: { label: 'Health', symbol: { ios: 'heart.fill', android: 'favorite', web: 'favorite' } },
  money: { label: 'Savings', symbol: { ios: 'banknote.fill', android: 'savings', web: 'savings' } },
  nature: { label: 'Nature', symbol: { ios: 'leaf.fill', android: 'eco', web: 'eco' } },
  sun: { label: 'Morning', symbol: { ios: 'sun.max.fill', android: 'wb_sunny', web: 'wb_sunny' } },
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
  { value: '#8B7CF6', label: 'Violet' },
  { value: '#5B8DEF', label: 'Blue' },
  { value: '#60A5FA', label: 'Sky' },
  { value: '#C084FC', label: 'Lavender' },
  { value: '#22D3EE', label: 'Cyan' },
  { value: '#4ADE9B', label: 'Mint' },
  { value: '#FBBF24', label: 'Amber' },
  { value: '#F472B6', label: 'Pink' },
  { value: '#F87171', label: 'Coral' },
] as const;

export const DEFAULT_HABIT_COLOR = HABIT_COLORS[0].value;
