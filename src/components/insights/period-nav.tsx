"use no memo"; // Keep external locale reads live; explicit domain memos remain intact.
import {SymbolView, Text} from '@/components/localized-native';
import { appLabel, appMessage } from '@/i18n/app-copy';
import { readableAccent } from '@/utils/theme-color';
import type { AppPalette } from '@/constants/palettes';
import { useAppStyles } from '@/hooks/use-app-styles';

import { Pressable, StyleSheet, View } from 'react-native';

import { Radius } from '@/constants/theme';

type Props = {
  label: string;
  /** Second line under the label, e.g. "This week · in progress". */
  caption?: string;
  onPrev: () => void;
  onNext: () => void;
  canPrev: boolean;
  canNext: boolean;
  /** e.g. "month" / "week", used in labels and hints. */
  unit: string;
  /** Optional "jump back" chip shown when not on the current period, e.g. "This month". */
  resetLabel?: string;
  onReset?: () => void;
};

/**
 * ‹ label › control shared by the calendar and the weekly review.
 * Buttons are 48 dp (Android minimum touch size). Disabled buttons are visibly
 * hollow and dimmed, announce themselves as disabled, and explain why.
 */
export function PeriodNav({ label, caption, onPrev, onNext, canPrev, canNext, unit, resetLabel, onReset }: Props) {
  const { palette: Palette, styles } = useAppStyles(createStyles);
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <NavButton
          direction="prev"
          disabled={!canPrev}
          onPress={onPrev}
          label={appMessage("insights.period.previous", { get unit(){return appLabel(unit === 'week' ? 'period.week' : 'period.month');} })}
          disabledHint={appMessage("insights.period.earliest", { get unit(){return appLabel(unit === 'week' ? 'period.week' : 'period.month');} })}
        />
        <View style={styles.labelWrap} accessible accessibilityLabel={caption ? appMessage("display.labelText", { label: String(label), text: String(caption) }) : label}>
          <Text style={styles.label} numberOfLines={1} accessibilityRole="header">
            {label}
          </Text>
          {caption ? (
            <Text style={styles.caption} numberOfLines={1}>
              {caption}
            </Text>
          ) : null}
        </View>
        <NavButton
          direction="next"
          disabled={!canNext}
          onPress={onNext}
          label={appMessage("insights.period.next", { get unit(){return appLabel(unit === 'week' ? 'period.week' : 'period.month');} })}
          disabledHint={appMessage("insights.period.futureUnavailable", { get unit(){return appLabel(unit === 'week' ? 'period.week' : 'period.month');} })}
        />
      </View>
      {resetLabel && onReset ? (
        <Pressable
          onPress={onReset}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={appMessage("insights.period.jump", { period: (resetLabel.toLowerCase()) })}
          android_ripple={{ color: Palette.rippleSubtle }}
          style={({ pressed }) => [styles.reset, pressed && styles.pressed]}>
          <Text style={styles.resetText}>{resetLabel} ›</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function NavButton({
  direction,
  disabled,
  onPress,
  label,
  disabledHint,
}: {
  direction: 'prev' | 'next';
  disabled: boolean;
  onPress: () => void;
  label: string;
  disabledHint: string;
}) {
  const { palette: Palette, styles } = useAppStyles(createStyles);
  const name =
    direction === 'prev'
      ? ({ ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' } as const)
      : ({ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' } as const);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={disabled ? disabledHint : undefined}
      accessibilityState={{ disabled }}
      android_ripple={disabled ? undefined : { color: Palette.rippleStrong, borderless: true }}
      style={({ pressed }) => [styles.button, disabled ? styles.buttonDisabled : styles.buttonEnabled, pressed && styles.pressed]}>
      <SymbolView name={name} size={22} weight="bold" tintColor={readableAccent(disabled ? Palette.textMuted : Palette.text, Palette)} />
    </Pressable>
  );
}

const createStyles = (Palette: AppPalette) => StyleSheet.create({
  container: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  labelWrap: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  label: {
    color: Palette.text,
    fontSize: 16,
    fontWeight: '700',
  },
  caption: {
    color: Palette.textSecondary,
    fontSize: 12,
  },
  button: {
    width: 48,
    height: 48,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  buttonEnabled: {
    backgroundColor: Palette.accentSoft,
    borderColor: Palette.accent,
  },
  buttonDisabled: {
    backgroundColor: 'transparent',
    borderColor: Palette.controlBorder,
    borderStyle: 'dashed',
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.7,
  },
  reset: {
    alignSelf: 'center',
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: Radius.pill,
    backgroundColor: Palette.surfaceRaised,
    overflow: 'hidden',
  },
  resetText: {
    color: Palette.accent,
    fontSize: 13,
    fontWeight: '700',
  },
});
