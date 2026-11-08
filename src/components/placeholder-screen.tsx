import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomTabInset, Palette, Radius, Spacing } from '@/constants/theme';

type Props = {
  title: string;
  description: string;
  icon: SymbolViewProps['name'];
};

/** Temporary screen for tabs that are not built yet. */
export function PlaceholderScreen({ title, description, icon }: Props) {
  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <SymbolView name={icon} size={28} tintColor={Palette.accent} />
          </View>
          <Text style={styles.cardTitle}>Coming soon</Text>
          <Text style={styles.description}>{description}</Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: Spacing.four,
    paddingBottom: BottomTabInset,
    gap: Spacing.four,
  },
  title: {
    color: Palette.text,
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.6,
  },
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
  cardTitle: {
    color: Palette.text,
    fontSize: 18,
    fontWeight: '700',
  },
  description: {
    color: Palette.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
});
