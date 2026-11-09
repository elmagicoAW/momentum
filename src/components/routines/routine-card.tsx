import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MiniBar, RoutineIcon, TimeChip } from '@/components/routines/routine-badges';
import { IconButton } from '@/components/routines/routine-habit-order';
import { Palette, Radius, Spacing } from '@/constants/theme';
import { describeRoutineDay, type RoutineDay } from '@/utils/routine-progress';

type Props = {
  day: RoutineDay;
  onPress: (id: string) => void;
  /** Reorder mode: shows ↑ / ↓ instead of opening the routine. */
  reorder?: {
    canUp: boolean;
    canDown: boolean;
    disabled: boolean;
    onMove: (id: string, delta: -1 | 1) => void;
  };
};

/** One routine in the Habits › Routines list. */
export function RoutineCard({ day, onPress, reorder }: Props) {
  const { routine } = day;
  const habitCount = day.members.length;
  const summary = `${habitCount === 1 ? '1 habit' : `${habitCount} habits`} · ${describeRoutineDay(day)}`;
  const complete = day.state === 'complete';

  const body = (
    <>
      <RoutineIcon routine={routine} />
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {routine.title}
          </Text>
          <TimeChip timeOfDay={routine.timeOfDay} />
        </View>
        <Text style={[styles.detail, complete && { color: routine.color }]} numberOfLines={1}>
          {summary}
        </Text>
        {day.total > 0 && <MiniBar ratio={day.done / day.total} color={routine.color} width={96} />}
      </View>
    </>
  );

  if (reorder) {
    return (
      <View style={[styles.card, styles.row]}>
        {body}
        <IconButton
          label={`Move ${routine.title} up`}
          symbol={{ ios: 'chevron.up', android: 'keyboard_arrow_up', web: 'keyboard_arrow_up' }}
          disabled={reorder.disabled || !reorder.canUp}
          onPress={() => reorder.onMove(routine.id, -1)}
        />
        <IconButton
          label={`Move ${routine.title} down`}
          symbol={{ ios: 'chevron.down', android: 'keyboard_arrow_down', web: 'keyboard_arrow_down' }}
          disabled={reorder.disabled || !reorder.canDown}
          onPress={() => reorder.onMove(routine.id, 1)}
        />
      </View>
    );
  }

  return (
    <Pressable
      onPress={() => onPress(routine.id)}
      accessibilityRole="button"
      accessibilityLabel={`${routine.title}, ${summary}`}
      accessibilityHint="Opens the routine"
      android_ripple={{ color: 'rgba(255,255,255,0.06)' }}
      style={({ pressed }) => [styles.card, styles.row, complete && styles.cardDone, pressed && styles.pressed]}>
      {body}
      <SymbolView
        name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
        size={20}
        tintColor={Palette.textMuted}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 76,
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
    gap: 12,
  },
  cardDone: {
    borderColor: 'rgba(139, 124, 246, 0.35)',
  },
  pressed: {
    opacity: 0.85,
  },
  body: {
    flex: 1,
    gap: 5,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    flexShrink: 1,
    color: Palette.text,
    fontSize: 16,
    fontWeight: '600',
  },
  detail: {
    color: Palette.textMuted,
    fontSize: 13,
  },
});
