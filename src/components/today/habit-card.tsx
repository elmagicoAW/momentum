import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Palette, Radius, Spacing } from '@/constants/theme';
import type { Habit } from '@/data/demo-habits';

type Props = {
  habit: Habit;
  done: boolean;
  /** True while saved data is loading (or failed to load), so taps can't overwrite it. */
  disabled?: boolean;
  onToggle: (id: string) => void;
};

export function HabitCard({ habit, done, disabled = false, onToggle }: Props) {
  return (
    <Pressable
      onPress={() => onToggle(habit.id)}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: done, disabled }}
      accessibilityLabel={habit.title}
      android_ripple={{ color: 'rgba(255,255,255,0.06)', borderless: false }}
      style={({ pressed }) => [styles.card, done && styles.cardDone, pressed && styles.pressed]}>
      <View style={[styles.iconWrap, { backgroundColor: `${habit.tint}22` }]}>
        <SymbolView
          name={habit.icon}
          size={22}
          tintColor={habit.tint}
        />
      </View>

      <View style={styles.body}>
        <Text style={[styles.title, done && styles.titleDone]} numberOfLines={1}>
          {habit.title}
        </Text>
        <View style={styles.metaRow}>
          <Text style={styles.detail} numberOfLines={1}>
            {habit.detail}
          </Text>
          <Text style={styles.streak}>· 🔥 {habit.streak + (done ? 1 : 0)}</Text>
        </View>
      </View>

      <View style={[styles.checkbox, done && styles.checkboxDone]}>
        {done && (
          <SymbolView
            name={{ ios: 'checkmark', android: 'check', web: 'check' }}
            size={18}
            tintColor={Palette.background}
          />
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.lg,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
    overflow: 'hidden',
  },
  cardDone: {
    borderColor: 'rgba(139, 124, 246, 0.35)',
  },
  pressed: {
    opacity: 0.85,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    gap: 3,
  },
  title: {
    color: Palette.text,
    fontSize: 16,
    fontWeight: '600',
  },
  titleDone: {
    color: Palette.textSecondary,
    textDecorationLine: 'line-through',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detail: {
    color: Palette.textMuted,
    fontSize: 13,
    flexShrink: 1,
  },
  streak: {
    color: Palette.textMuted,
    fontSize: 13,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: Palette.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxDone: {
    backgroundColor: Palette.accent,
    borderColor: Palette.accent,
  },
});
