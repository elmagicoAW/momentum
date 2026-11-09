import { StyleSheet, Text, View } from 'react-native';

import { Palette, Radius, Spacing } from '@/constants/theme';

type Props = {
  label: string;
  value: string;
  caption?: string;
  /** Value colour; defaults to the main text colour. */
  color?: string;
  /** Small dashed pill, e.g. "Provisional" or "At least". */
  badge?: string;
};

export function StatTile({ label, value, caption, color, badge }: Props) {
  return (
    <View style={styles.tile} accessible accessibilityLabel={`${label}: ${value}${caption ? `, ${caption}` : ''}${badge ? `, ${badge}` : ''}`}>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[styles.value, color ? { color } : null]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {caption ? (
        <Text style={styles.caption} numberOfLines={2}>
          {caption}
        </Text>
      ) : null}
      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flexGrow: 1,
    flexBasis: '45%',
    minHeight: 104,
    gap: 4,
    padding: Spacing.three,
    borderRadius: Radius.lg,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  label: {
    color: Palette.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  value: {
    color: Palette.text,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  caption: {
    color: Palette.textSecondary,
    fontSize: 12,
    lineHeight: 16,
  },
  badge: {
    alignSelf: 'flex-start',
    marginTop: 2,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Palette.textMuted,
  },
  badgeText: {
    color: Palette.textSecondary,
    fontSize: 10,
    fontWeight: '700',
  },
});
