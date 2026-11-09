import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Palette, Radius } from '@/constants/theme';
import { GOAL_STATUSES, type GoalStatus } from '@/data/goal-storage';

export const GOAL_STATUS_META: Record<GoalStatus, { label: string; color: string; soft: string }> = {
  active: { label: 'Active', color: Palette.accent, soft: Palette.accentSoft },
  paused: { label: 'Paused', color: Palette.textSecondary, soft: 'rgba(154, 154, 176, 0.14)' },
  completed: { label: 'Completed', color: Palette.success, soft: 'rgba(74, 222, 155, 0.14)' },
};

type Props = {
  value: GoalStatus;
  onChange: (status: GoalStatus) => void;
  disabled?: boolean;
};

export function StatusPicker({ value, onChange, disabled }: Props) {
  return (
    <View style={styles.track} accessibilityRole="radiogroup">
      {GOAL_STATUSES.map((status) => {
        const meta = GOAL_STATUS_META[status];
        const selected = status === value;
        return (
          <Pressable
            key={status}
            onPress={() => onChange(status)}
            disabled={disabled}
            accessibilityRole="radio"
            accessibilityState={{ selected, disabled }}
            accessibilityLabel={meta.label}
            style={[styles.segment, selected && { backgroundColor: meta.soft, borderColor: meta.color }]}>
            <Text style={[styles.label, selected && { color: meta.color }]}>{meta.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Small read-only pill used on cards. */
export function StatusPill({ status }: { status: GoalStatus }) {
  const meta = GOAL_STATUS_META[status];
  return (
    <View style={[styles.pill, { backgroundColor: meta.soft }]}>
      <Text style={[styles.pillText, { color: meta.color }]}>{meta.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    gap: 8,
  },
  segment: {
    flex: 1,
    minHeight: 48,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Palette.border,
    backgroundColor: Palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: Palette.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
