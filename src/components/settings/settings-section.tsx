import type { AppPalette } from '@/constants/palettes';
import { useAppStyles } from '@/hooks/use-app-styles';
import { Children, Fragment, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';

type Props = {
  title: string;
  /** Short note under the card. */
  footer?: string;
  children: ReactNode;
};

/** A labelled group of settings rows in one card, separated by hairlines. */
export function SettingsSection({ title, footer, children }: Props) {
  const { styles } = useAppStyles(createStyles);
  const rows = Children.toArray(children).filter(Boolean);
  return (
    <View style={styles.section}>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      <View style={styles.card}>
        {rows.map((row, index) => (
          <Fragment key={index}>
            {index > 0 && <View style={styles.divider} />}
            {row}
          </Fragment>
        ))}
      </View>
      {footer && <Text style={styles.footer}>{footer}</Text>}
    </View>
  );
}

const createStyles = (Palette: AppPalette) => StyleSheet.create({
  section: {
    gap: 10,
  },
  title: {
    color: Palette.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    paddingHorizontal: Spacing.one,
  },
  card: {
    borderRadius: Radius.lg,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
    overflow: 'hidden',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Palette.border,
    marginLeft: 68,
  },
  footer: {
    color: Palette.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: Spacing.one,
  },
});
