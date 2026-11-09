import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Palette, Radius, Spacing } from '@/constants/theme';
import { useRoutines } from '@/hooks/use-routines';
import { ROUTINES_HREF } from '@/utils/navigation';

/** Entry point to Habits › Routines, shown above the habit list. */
export function RoutinesEntryCard() {
  const { routines, status } = useRoutines();

  let detail: string;
  if (status === 'loading') detail = 'Loading…';
  else if (status === 'load-error') detail = 'Couldn’t load routines — tap to retry';
  else if (routines.length === 0) detail = 'Group habits into a Morning or Evening Routine';
  else detail = routines.map((r) => r.title).join(' · ');

  const count = status === 'ready' && routines.length > 0 ? String(routines.length) : null;

  return (
    <Pressable
      onPress={() => router.push(ROUTINES_HREF)}
      accessibilityRole="button"
      accessibilityLabel={`Routines${count ? `, ${count}` : ''}. ${detail}`}
      accessibilityHint="Opens your routines"
      android_ripple={{ color: 'rgba(255,255,255,0.06)' }}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.icon}>
        <SymbolView
          name={{ ios: 'list.bullet.rectangle.fill', android: 'view_list', web: 'view_list' }}
          size={22}
          tintColor={Palette.accentBlue}
        />
      </View>
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Routines</Text>
          {count && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{count}</Text>
            </View>
          )}
        </View>
        <Text style={styles.detail} numberOfLines={1}>
          {detail}
        </Text>
      </View>
      <SymbolView
        name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
        size={20}
        tintColor={Palette.textMuted}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 72,
    padding: Spacing.three,
    borderRadius: Radius.lg,
    backgroundColor: Palette.accentBlueSoft,
    borderWidth: 1,
    borderColor: 'rgba(91, 141, 239, 0.25)',
    overflow: 'hidden',
  },
  pressed: {
    opacity: 0.85,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(91, 141, 239, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    gap: 3,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    color: Palette.text,
    fontSize: 16,
    fontWeight: '700',
  },
  badge: {
    minWidth: 22,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(91, 141, 239, 0.25)',
    alignItems: 'center',
  },
  badgeText: {
    color: Palette.text,
    fontSize: 12,
    fontWeight: '700',
  },
  detail: {
    color: Palette.textSecondary,
    fontSize: 13,
  },
});
