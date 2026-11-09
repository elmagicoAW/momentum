import { readableAccent } from '@/utils/theme-color';
import type { AppPalette } from '@/constants/palettes';
import { useAppStyles } from '@/hooks/use-app-styles';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ChecklistSteps } from '@/components/today/checklist-steps';
import { CountControl } from '@/components/today/count-control';
import { Radius, Spacing } from '@/constants/theme';
import type { DayRecord } from '@/data/completion-storage';
import { habitIconSymbol } from '@/data/habit-options';
import type { Habit } from '@/data/habit-storage';
import { countValue, doneStepIds, isCompleteNow, requiredStepIds } from '@/utils/habit-progress';
import { describeSchedule } from '@/utils/schedule';

type Props = {
  habit: Habit;
  /** Today's progress. */
  record: DayRecord;
  /** True while saved data is loading (or failed to load), so taps can't overwrite it. */
  disabled?: boolean;
  onToggleTick: (habit: Habit) => void;
  onAdjustCount: (habit: Habit, delta: number) => void;
  onToggleStep: (habit: Habit, stepId: string) => void;
};

export function HabitCard(props: Props) {
  switch (props.habit.tracking.type) {
    case 'tick':
      return <TickCard {...props} />;
    case 'count':
      return <CountCard {...props} />;
    case 'checklist':
      return <ChecklistCard {...props} />;
  }
}

function HabitIcon({ habit }: { habit: Habit }) {
  const { palette: Palette, styles } = useAppStyles(createStyles);
  return (
    <View style={[styles.iconWrap, { backgroundColor: `${habit.color}22` }]}>
      <SymbolView name={habitIconSymbol(habit.icon)} size={22} tintColor={readableAccent(habit.color, Palette)} />
    </View>
  );
}

function Check({ done, size = 28 }: { done: boolean; size?: number }) {
  const { palette: Palette, styles } = useAppStyles(createStyles);
  return (
    <View style={[styles.checkbox, { width: size, height: size }, done && styles.checkboxDone]}>
      {done && (
        <SymbolView
          name={{ ios: 'checkmark', android: 'check', web: 'check' }}
          size={size * 0.64}
          tintColor={Palette.onAccent}
        />
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Tick — tap anywhere to check off.
// ---------------------------------------------------------------------------

function TickCard({ habit, record, disabled = false, onToggleTick }: Props) {
  const { palette: Palette, styles } = useAppStyles(createStyles);
  const done = isCompleteNow(record, habit);
  return (
    <Pressable
      onPress={() => onToggleTick(habit)}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: done, disabled }}
      accessibilityLabel={habit.name}
      android_ripple={{ color: Palette.ripple, borderless: false }}
      style={({ pressed }) => [styles.card, styles.row, done && styles.cardDone, pressed && styles.pressed]}>
      <HabitIcon habit={habit} />
      <View style={styles.body}>
        <Text style={[styles.title, done && styles.titleDone]} numberOfLines={1}>
          {habit.name}
        </Text>
        <Text style={styles.detail} numberOfLines={1}>
          {habit.description || describeSchedule(habit.schedule)}
        </Text>
      </View>
      <Check done={done} />
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Count — − / + with progress toward the target. The card body isn't tappable.
// ---------------------------------------------------------------------------

function CountCard({ habit, record, disabled = false, onAdjustCount }: Props) {
  const { palette: Palette, styles } = useAppStyles(createStyles);
  if (habit.tracking.type !== 'count') return null;
  const { target, unit } = habit.tracking;
  const value = countValue(record, habit);
  const done = isCompleteNow(record, habit);
  const ratio = Math.min(value / target, 1);
  const progressText = `${value} / ${target}${unit ? ` ${unit}` : ''}`;

  return (
    <View style={[styles.card, done && styles.cardDone]}>
      <View style={styles.row}>
        <HabitIcon habit={habit} />
        <View style={styles.body}>
          <Text style={[styles.title, done && styles.titleMuted]} numberOfLines={1}>
            {habit.name}
          </Text>
          <View style={styles.metaRow}>
            <Text style={[styles.progressValue, done && { color: readableAccent(habit.color, Palette) }]} numberOfLines={1}>
              {progressText}
            </Text>
            {done && (
              <SymbolView
                name={{ ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }}
                size={14}
                tintColor={readableAccent(habit.color, Palette)}
              />
            )}
          </View>
        </View>
        <CountControl
          value={value}
          label={`${habit.name}, ${progressText}${done ? ', done' : ''}`}
          color={habit.color}
          disabled={disabled}
          onAdjust={(delta) => onAdjustCount(habit, delta)}
        />
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${ratio * 100}%`, backgroundColor: readableAccent(habit.color, Palette) }]} />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Checklist — tap the header to expand; tick steps individually.
// ---------------------------------------------------------------------------

function ChecklistCard({ habit, record, disabled = false, onToggleStep }: Props) {
  const { palette: Palette, styles } = useAppStyles(createStyles);
  const [expanded, setExpanded] = useState(false);
  if (habit.tracking.type !== 'checklist') return null;
  const { steps } = habit.tracking;
  const done = doneStepIds(record, habit);
  const complete = isCompleteNow(record, habit);
  const required = requiredStepIds(habit.tracking);
  const requiredDone = required.filter((id) => done.has(id)).length;
  const summary =
    required.length === steps.length
      ? `${requiredDone} of ${steps.length} steps`
      : `${requiredDone} of ${required.length} required · ${done.size} of ${steps.length} total`;

  return (
    <View style={[styles.card, complete && styles.cardDone]}>
      <Pressable
        onPress={() => setExpanded((e) => !e)}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${habit.name}, ${summary}${complete ? ', done' : ''}`}
        accessibilityHint={expanded ? 'Hides the steps' : 'Shows the steps'}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
        <HabitIcon habit={habit} />
        <View style={styles.body}>
          <Text style={[styles.title, complete && styles.titleMuted]} numberOfLines={1}>
            {habit.name}
          </Text>
          <Text style={[styles.detail, complete && { color: readableAccent(habit.color, Palette) }]} numberOfLines={1}>
            {summary}
          </Text>
        </View>
        {complete ? (
          <Check done size={24} />
        ) : (
          <View style={styles.miniTrack}>
            <View
              style={[
                styles.miniFill,
                { width: `${(requiredDone / Math.max(required.length, 1)) * 100}%`, backgroundColor: readableAccent(habit.color, Palette) },
              ]}
            />
          </View>
        )}
        <SymbolView
          name={
            expanded
              ? { ios: 'chevron.up', android: 'expand_less', web: 'expand_less' }
              : { ios: 'chevron.down', android: 'expand_more', web: 'expand_more' }
          }
          size={20}
          tintColor={Palette.textMuted}
        />
      </Pressable>
      {expanded && (
        <ChecklistSteps
          steps={steps}
          done={done}
          color={habit.color}
          disabled={disabled}
          onToggle={(stepId) => onToggleStep(habit, stepId)}
        />
      )}
    </View>
  );
}

const createStyles = (Palette: AppPalette) => StyleSheet.create({
  card: {
    gap: 12,
    padding: Spacing.three,
    borderRadius: Radius.lg,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  cardDone: {
    borderColor: Palette.accentBorder,
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
  titleMuted: {
    color: Palette.textSecondary,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  detail: {
    color: Palette.textMuted,
    fontSize: 13,
    flexShrink: 1,
  },
  progressValue: {
    color: Palette.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    flexShrink: 1,
  },
  checkbox: {
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
  track: {
    height: 4,
    borderRadius: 2,
    backgroundColor: Palette.ringTrack,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 2,
  },
  miniTrack: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Palette.ringTrack,
    overflow: 'hidden',
  },
  miniFill: {
    height: '100%',
    borderRadius: 2,
  },
});
