import { readableAccent } from '@/utils/theme-color';
import type { AppPalette } from '@/constants/palettes';
import { useAppStyles } from '@/hooks/use-app-styles';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Radius } from '@/constants/theme';
import { GOAL_STATUSES, type GoalStatus } from '@/data/goal-storage';

export const goalStatusMeta = (Palette: AppPalette): Record<GoalStatus, { label: string; color: string; soft: string }> => ({
  active: { label: 'Active', color: Palette.accent, soft: Palette.accentSoft },
  paused: { label: 'Paused', color: Palette.textSecondary, soft: Palette.pausedSoft },
  completed: { label: 'Completed', color: Palette.success, soft: Palette.successSoft },
});

type Props = {
  value: GoalStatus;
  onChange: (status: GoalStatus) => void;
  disabled?: boolean;
};

export function StatusPicker({ value, onChange, disabled }: Props) {
  const { palette: Palette, styles } = useAppStyles(createStyles);
  const GOAL_STATUS_META = goalStatusMeta(Palette);
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
            <Text style={[styles.label, selected && { color: readableAccent(meta.color, Palette) }]}>{meta.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Small read-only pill used on cards. */
export function StatusPill({ status }: { status: GoalStatus }) {
  const { palette: Palette, styles } = useAppStyles(createStyles);
  const GOAL_STATUS_META = goalStatusMeta(Palette);
  const meta = GOAL_STATUS_META[status];
  return (
    <View style={[styles.pill, { backgroundColor: meta.soft }]}>
      <Text style={[styles.pillText, { color: readableAccent(meta.color, Palette) }]}>{meta.label}</Text>
    </View>
  );
}

const createStyles = (Palette: AppPalette) => StyleSheet.create({
  track: {
    flexDirection: 'row',
    gap: 8,
  },
  segment: {
    flex: 1,
    minHeight: 48,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Palette.controlBorder,
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
