import { readableAccent } from '@/utils/theme-color';
import type { AppPalette } from '@/constants/palettes';
import { useAppStyles } from '@/hooks/use-app-styles';
import { SymbolView } from 'expo-symbols';
import { StyleSheet, Text, View } from 'react-native';

import { Radius } from '@/constants/theme';
import { habitIconSymbol } from '@/data/habit-options';
import type { Routine, TimeOfDay } from '@/data/routine-storage';
import { TIME_OF_DAY_LABELS } from '@/utils/routine-progress';

/** Icon tile in the routine's colour (same treatment as habit icons). */
export function RoutineIcon({ routine, size = 44 }: { routine: Pick<Routine, 'icon' | 'color'>; size?: number }) {
  const { palette: Palette, styles } = useAppStyles(createStyles);
  return (
    <View
      style={[
        styles.icon,
        { width: size, height: size, borderRadius: size >= 44 ? Radius.md : Radius.sm },
        { backgroundColor: `${routine.color}22` },
      ]}>
      <SymbolView name={habitIconSymbol(routine.icon)} size={Math.round(size * 0.5)} tintColor={readableAccent(routine.color, Palette)} />
    </View>
  );
}

export function TimeChip({ timeOfDay }: { timeOfDay: TimeOfDay }) {
  const { styles } = useAppStyles(createStyles);
  return (
    <View style={styles.chip}>
      <Text style={styles.chipText}>{TIME_OF_DAY_LABELS[timeOfDay]}</Text>
    </View>
  );
}

/** Highlights the routine that fits the current time of day. Never affects availability. */
export function NowChip() {
  const { styles } = useAppStyles(createStyles);
  return (
    <View style={[styles.chip, styles.nowChip]}>
      <Text style={[styles.chipText, styles.nowText]}>Now</Text>
    </View>
  );
}

export function MiniBar({ ratio, color, width = 56 }: { ratio: number; color: string; width?: number }) {
  const { palette: Palette, styles } = useAppStyles(createStyles);
  return (
    <View style={[styles.track, { width }]}>
      <View style={[styles.fill, { width: `${Math.min(Math.max(ratio, 0), 1) * 100}%`, backgroundColor: readableAccent(color, Palette) }]} />
    </View>
  );
}

const createStyles = (Palette: AppPalette) => StyleSheet.create({
  icon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.pill,
    backgroundColor: Palette.surfaceRaised,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  chipText: {
    color: Palette.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  nowChip: {
    backgroundColor: Palette.accentSoft,
    borderColor: Palette.accentBorderChip,
  },
  nowText: {
    color: Palette.accent,
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
});
