import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MiniBar, NowChip, RoutineIcon, TimeChip } from '@/components/routines/routine-badges';
import { Palette, Radius, Spacing } from '@/constants/theme';
import type { RoutinesStatus } from '@/hooks/use-routines';
import { describeRoutineDay, type DailyPlan, type RoutineDay } from '@/utils/routine-progress';

type Props = {
  plan: DailyPlan;
  routinesStatus: RoutinesStatus;
  onOpen: (routineId: string) => void;
  onManage: () => void;
  onRetry: () => void;
};

/**
 * "Today's plan" on Today: a compact overview of routines with habits due today,
 * in time-of-day order. It's navigation + overview only — Today's ring and habit
 * list are unchanged, and nothing here counts toward them. Renders nothing when
 * no routine has habits due, so Today looks exactly as before for those users.
 */
export function TodaysPlan({ plan, routinesStatus, onOpen, onManage, onRetry }: Props) {
  if (routinesStatus === 'load-error') {
    return (
      <Pressable
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel="Couldn't load routines. Retry"
        style={({ pressed }) => [styles.errorLine, pressed && styles.pressed]}>
        <Text style={styles.errorText}>
          Couldn’t load routines · <Text style={styles.errorAction}>Retry</Text>
        </Text>
      </Pressable>
    );
  }
  if (routinesStatus !== 'ready' || plan.items.length === 0) return null;

  const total = plan.items.length;

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.title}>Today&apos;s plan</Text>
        <Pressable
          onPress={onManage}
          accessibilityRole="button"
          accessibilityLabel="Manage routines"
          hitSlop={10}
          style={({ pressed }) => [styles.manage, pressed && styles.pressed]}>
          <Text style={styles.meta}>
            {plan.routinesDone} of {total} {total === 1 ? 'routine' : 'routines'} done ·{' '}
            <Text style={styles.manageText}>Manage</Text>
          </Text>
        </Pressable>
      </View>

      <View style={styles.list}>
        {plan.items.map((day) => (
          <PlanRow key={day.routine.id} day={day} isNow={day.routine.id === plan.nowRoutineId} onOpen={onOpen} />
        ))}
      </View>

      {(plan.outsideCount > 0 || plan.restRoutines.length > 0) && (
        <View style={styles.footnotes}>
          {plan.outsideCount > 0 && (
            <Text style={styles.footnote}>
              +{plan.outsideCount} {plan.outsideCount === 1 ? 'habit' : 'habits'} due today not in a routine — see
              below.
            </Text>
          )}
          {plan.restRoutines.length > 0 && (
            <Text style={styles.footnote}>
              {plan.restRoutines.map((d) => d.routine.title).join(', ')}{' '}
              {plan.restRoutines.length === 1 ? 'has' : 'have'} nothing due today.
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

function PlanRow({ day, isNow, onOpen }: { day: RoutineDay; isNow: boolean; onOpen: (id: string) => void }) {
  const { routine } = day;
  const complete = day.state === 'complete';
  const summary = describeRoutineDay(day);
  return (
    <Pressable
      onPress={() => onOpen(routine.id)}
      accessibilityRole="button"
      accessibilityLabel={`${routine.title}${isNow ? ', suggested now' : ''}, ${summary}`}
      accessibilityHint="Opens the routine"
      android_ripple={{ color: 'rgba(255,255,255,0.06)' }}
      style={({ pressed }) => [
        styles.row,
        isNow && styles.rowNow,
        complete && styles.rowDone,
        pressed && styles.pressed,
      ]}>
      <RoutineIcon routine={routine} size={40} />
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={[styles.rowTitle, complete && styles.rowTitleDone]} numberOfLines={1}>
            {routine.title}
          </Text>
          {isNow ? <NowChip /> : <TimeChip timeOfDay={routine.timeOfDay} />}
        </View>
        <View style={styles.progressRow}>
          <MiniBar ratio={day.done / day.total} color={routine.color} width={72} />
          <Text style={[styles.count, complete && { color: routine.color }]}>
            {day.done}/{day.total}
          </Text>
        </View>
      </View>
      {complete ? (
        <View style={styles.check}>
          <SymbolView
            name={{ ios: 'checkmark', android: 'check', web: 'check' }}
            size={14}
            tintColor={Palette.background}
          />
        </View>
      ) : (
        <SymbolView
          name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
          size={20}
          tintColor={Palette.textMuted}
        />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  title: {
    color: Palette.text,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  manage: {
    flexShrink: 1,
    minHeight: 32,
    justifyContent: 'center',
  },
  meta: {
    color: Palette.textMuted,
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'right',
  },
  manageText: {
    color: Palette.accent,
    fontWeight: '700',
  },
  list: {
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 64,
    paddingHorizontal: Spacing.three,
    paddingVertical: 12,
    borderRadius: Radius.md,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
    overflow: 'hidden',
  },
  rowNow: {
    borderColor: 'rgba(139, 124, 246, 0.55)',
    backgroundColor: '#15142A',
  },
  rowDone: {
    borderColor: 'rgba(139, 124, 246, 0.35)',
  },
  pressed: {
    opacity: 0.85,
  },
  body: {
    flex: 1,
    gap: 6,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowTitle: {
    flexShrink: 1,
    color: Palette.text,
    fontSize: 15,
    fontWeight: '600',
  },
  rowTitleDone: {
    color: Palette.textSecondary,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  count: {
    color: Palette.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: Palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footnotes: {
    gap: 4,
  },
  footnote: {
    color: Palette.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  errorLine: {
    minHeight: 44,
    justifyContent: 'center',
  },
  errorText: {
    color: Palette.textMuted,
    fontSize: 13,
  },
  errorAction: {
    color: Palette.accent,
    fontWeight: '700',
  },
});
