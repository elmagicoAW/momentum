import { readableAccent } from '@/utils/theme-color';
import type { AppPalette } from '@/constants/palettes';
import { useAppStyles } from '@/hooks/use-app-styles';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';

type Base = {
  icon: SymbolViewProps['name'];
  label: string;
  /** Tint for the icon tile. */
  tint?: string;
};

type Props =
  /** Opens something that works today. The only tappable variant. */
  | (Base & { variant: 'link'; value?: string; onPress: () => void })
  /** A true, read-only value (e.g. Theme: Dark). Not tappable. */
  | (Base & { variant: 'info'; value: string })
  /** A planned feature. Clearly marked, not tappable. */
  | (Base & { variant: 'soon' })
  /** A short paragraph instead of a value. Not tappable. */
  | (Base & { variant: 'text'; text: string });

const CHEVRON = { ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' } as const;

/**
 * One settings row. Only `link` rows are buttons: `info`, `soon` and `text`
 * rows are plain views (no ripple, no chevron), so nothing pretends to work.
 */
export function SettingsRow(props: Props) {
  const { palette: Palette, styles } = useAppStyles(createStyles);
  const tint = props.tint ?? Palette.accent;
  const dimmed = props.variant === 'soon';

  const iconTile = (
    <View style={[styles.iconTile, { backgroundColor: dimmed ? Palette.surfaceRaised : `${tint}22` }]}>
      <SymbolView name={props.icon} size={18} tintColor={readableAccent(dimmed ? Palette.textMuted : tint, Palette)} />
    </View>
  );

  if (props.variant === 'link') {
    return (
      <Pressable
        onPress={props.onPress}
        accessibilityRole="button"
        accessibilityLabel={props.value ? `${props.label}, ${props.value}` : props.label}
        android_ripple={{ color: Palette.ripple }}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
        {iconTile}
        <Text style={styles.label}>{props.label}</Text>
        {props.value && (
          <Text style={styles.value} numberOfLines={1}>
            {props.value}
          </Text>
        )}
        <SymbolView name={CHEVRON} size={16} tintColor={Palette.textMuted} />
      </Pressable>
    );
  }

  if (props.variant === 'text') {
    return (
      <View style={[styles.row, styles.textRow]} accessible accessibilityLabel={`${props.label}. ${props.text}`}>
        {iconTile}
        <View style={styles.textBlock}>
          <Text style={styles.label}>{props.label}</Text>
          <Text style={styles.paragraph}>{props.text}</Text>
        </View>
      </View>
    );
  }

  const value = props.variant === 'info' ? props.value : 'Coming later';
  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={`${props.label}, ${value}`}
      accessibilityState={dimmed ? { disabled: true } : undefined}>
      {iconTile}
      <Text style={[styles.label, dimmed && styles.labelDimmed]}>{props.label}</Text>
      {dimmed ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Coming later</Text>
        </View>
      ) : (
        <Text style={styles.value}>{value}</Text>
      )}
    </View>
  );
}

const createStyles = (Palette: AppPalette) => StyleSheet.create({
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: Spacing.three,
    paddingVertical: 12,
  },
  textRow: {
    alignItems: 'flex-start',
  },
  pressed: {
    opacity: 0.8,
  },
  iconTile: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    flex: 1,
    color: Palette.text,
    fontSize: 16,
    fontWeight: '500',
  },
  labelDimmed: {
    color: Palette.textSecondary,
  },
  value: {
    flexShrink: 1,
    maxWidth: '55%',
    color: Palette.textSecondary,
    fontSize: 15,
    textAlign: 'right',
  },
  textBlock: {
    flex: 1,
    gap: 4,
  },
  paragraph: {
    color: Palette.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    backgroundColor: Palette.surfaceRaised,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  badgeText: {
    color: Palette.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
});
