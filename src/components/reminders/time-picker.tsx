import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Palette, Radius, Spacing } from '@/constants/theme';
import {
  deviceUses12HourClock,
  formatReminderTime,
  isNearDstChangeHour,
  sameTime,
  stepHour,
  stepMinute,
  type ReminderTime,
} from '@/utils/reminder-time';

const PRESETS: { label: string; time: ReminderTime }[] = [
  { label: 'Morning', time: { hour: 7, minute: 30 } },
  { label: 'Noon', time: { hour: 12, minute: 0 } },
  { label: 'Evening', time: { hour: 19, minute: 0 } },
  { label: 'Night', time: { hour: 21, minute: 30 } },
];

const hour12 = deviceUses12HourClock();

export function formatTime(time: ReminderTime): string {
  return formatReminderTime(time, hour12);
}

type Props = {
  value: ReminderTime;
  onChange: (time: ReminderTime) => void;
  disabled?: boolean;
};

/** Dependency-free time picker: hour and 5-minute steppers plus quick presets. */
export function TimePicker({ value, onChange, disabled = false }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Stepper
          label="Hour"
          onMinus={() => onChange(stepHour(value, -1))}
          onPlus={() => onChange(stepHour(value, 1))}
          disabled={disabled}
        />
        <Text style={styles.time} accessibilityLiveRegion="polite" accessibilityLabel={`Reminder time ${formatTime(value)}`}>
          {formatTime(value)}
        </Text>
        <Stepper
          label="Minute"
          onMinus={() => onChange(stepMinute(value, -1))}
          onPlus={() => onChange(stepMinute(value, 1))}
          disabled={disabled}
        />
      </View>

      <View style={styles.presets}>
        {PRESETS.map((p) => {
          const selected = sameTime(p.time, value);
          return (
            <Pressable
              key={p.label}
              onPress={() => onChange(p.time)}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityState={{ selected, disabled }}
              accessibilityLabel={`${p.label}, ${formatTime(p.time)}`}
              style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.pressed]}>
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{formatTime(p.time)}</Text>
            </Pressable>
          );
        })}
      </View>

      {isNearDstChangeHour(value) && (
        <Text style={styles.note}>Times between 1 and 3 AM may shift on daylight-saving change days.</Text>
      )}
    </View>
  );
}

function Stepper({
  label,
  onMinus,
  onPlus,
  disabled,
}: {
  label: string;
  onMinus: () => void;
  onPlus: () => void;
  disabled: boolean;
}) {
  return (
    <View style={styles.stepper}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={styles.stepperButtons}>
        <StepButton icon="minus" label={`${label} earlier`} onPress={onMinus} disabled={disabled} />
        <StepButton icon="plus" label={`${label} later`} onPress={onPlus} disabled={disabled} />
      </View>
    </View>
  );
}

function StepButton({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: 'minus' | 'plus';
  label: string;
  onPress: () => void;
  disabled: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={4}
      android_ripple={{ color: 'rgba(255,255,255,0.08)', borderless: true }}
      style={({ pressed }) => [styles.stepButton, pressed && styles.pressed, disabled && styles.disabled]}>
      <SymbolView
        name={icon === 'minus' ? { ios: 'minus', android: 'remove', web: 'remove' } : { ios: 'plus', android: 'add', web: 'add' }}
        size={18}
        tintColor={Palette.text}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.md,
    backgroundColor: Palette.surfaceRaised,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  time: {
    flex: 1,
    textAlign: 'center',
    color: Palette.text,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  stepper: {
    alignItems: 'center',
    gap: 6,
  },
  stepperLabel: {
    color: Palette.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  stepperButtons: {
    flexDirection: 'row',
    gap: 6,
  },
  stepButton: {
    width: 44,
    height: 44,
    borderRadius: Radius.pill,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    flexGrow: 1,
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: Radius.pill,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSelected: {
    backgroundColor: Palette.accentSoft,
    borderColor: Palette.accent,
  },
  chipText: {
    color: Palette.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  chipTextSelected: {
    color: Palette.accent,
  },
  note: {
    color: Palette.textMuted,
    fontSize: 12,
    lineHeight: 16,
  },
  pressed: {
    opacity: 0.75,
  },
  disabled: {
    opacity: 0.4,
  },
});
