import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Palette, Radius, Spacing } from '@/constants/theme';

type Props = {
  title: string;
  description: string;
  icon?: SymbolViewProps['name'];
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({
  title,
  description,
  icon = { ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' },
  actionLabel,
  onAction,
}: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.iconWrap}>
        <SymbolView name={icon} size={28} tintColor={Palette.accent} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          android_ripple={{ color: 'rgba(255,255,255,0.12)' }}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
          <Text style={styles.buttonText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.five,
    borderRadius: Radius.lg,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: Radius.md,
    backgroundColor: Palette.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.two,
  },
  title: {
    color: Palette.text,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  description: {
    color: Palette.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  button: {
    marginTop: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: 12,
    borderRadius: Radius.pill,
    backgroundColor: Palette.accent,
    overflow: 'hidden',
  },
  pressed: {
    opacity: 0.85,
  },
  buttonText: {
    color: Palette.background,
    fontSize: 15,
    fontWeight: '700',
  },
});
