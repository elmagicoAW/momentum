"use no memo"; // Keep external locale reads live; explicit domain memos remain intact.
import {SymbolView, Text} from '@/components/localized-native';
import { appLabel, appMessage, appNumber } from '@/i18n/app-copy';
import { readableAccent } from '@/utils/theme-color';
import type { AppPalette } from '@/constants/palettes';
import { useAppStyles } from '@/hooks/use-app-styles';

import { Pressable, StyleSheet, View } from 'react-native';

import { ConsistencySummary } from '@/components/goals/consistency-summary';
import { StatusPill } from '@/components/goals/status-picker';
import { Radius, Spacing } from '@/constants/theme';
import { habitIconSymbol } from '@/data/habit-options';
import type { Goal } from '@/data/goal-storage';
import { describeTimeline, type HabitConsistency } from '@/utils/goal-progress';

type Props = {
  goal: Goal;
  todayKey: string;
  consistency: HabitConsistency | null;
  historyLoading: boolean;
  onPress: (id: string) => void;
};

export function GoalCard({ goal, todayKey, consistency, historyLoading, onPress }: Props) {
  const { palette: Palette, styles } = useAppStyles(createStyles);
  const linked = consistency?.linkedHabits ?? [];
  const color = linked[0]?.color ?? Palette.accent;
  const timeline = describeTimeline(goal, todayKey);
  const dimmed = goal.status !== 'active';

  return (
    <Pressable
      onPress={() => onPress(goal.id)}
      accessibilityRole="button"
      accessibilityHint={appLabel("goals.goal-card.opensTheGoalEditor")}
      android_ripple={{ color: Palette.ripple }}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.header}>
        <View style={[styles.headerText,{minWidth:0,flexShrink:1}]}>
          <Text style={[styles.title, dimmed && styles.titleDimmed]} numberOfLines={2}>
            {goal.title}
          </Text>
          <Text style={styles.timeline}>{timeline}</Text>
        </View>
        <StatusPill status={goal.status} />
      </View>

      {goal.description ? (
        <Text style={styles.description} numberOfLines={2}>
          {goal.description}
        </Text>
      ) : null}

      <ConsistencySummary consistency={consistency} loading={historyLoading} color={color} />

      {linked.length > 0 && (
        <View style={styles.habits}>
          <View style={styles.habitIcons}>
            {linked.slice(0, 5).map((habit) => (
              <View key={habit.id} style={[styles.habitIcon, { backgroundColor: `${habit.color}22` }]}>
                <SymbolView name={habitIconSymbol(habit.icon)} size={14} tintColor={readableAccent(habit.color, Palette)} />
              </View>
            ))}
            {linked.length > 5 && <Text style={styles.more}>+{appNumber(linked.length - 5)}</Text>}
          </View>
          <Text style={styles.habitCount} numberOfLines={1}>
            {linked.length === 1 ? linked[0].name : appMessage("goals.linked.count", { count: (linked.length) })}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const createStyles = (Palette: AppPalette) => StyleSheet.create({
  card: {
    gap: Spacing.three,
    padding: Spacing.three + 4,
    borderRadius: Radius.lg,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
    overflow: 'hidden',
  },
  pressed: {
    opacity: 0.85,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
  },
  headerText: {
    flex: 1,
    gap: 4,
  },
  title: {
    color: Palette.text,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  titleDimmed: {
    color: Palette.textSecondary,
  },
  timeline: {
    color: Palette.textMuted,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  description: {
    color: Palette.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  habits: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Palette.border,
  },
  habitIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  habitIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  more: {
    color: Palette.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  habitCount: {
    flex: 1,
    color: Palette.textSecondary,
    fontSize: 13,
  },
});
