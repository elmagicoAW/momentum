import type { AppPalette } from '@/constants/palettes';
import { useAppStyles } from '@/hooks/use-app-styles';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/habits/empty-state';
import { HabitRow } from '@/components/habits/habit-row';
import { RoutinesEntryCard } from '@/components/routines/routines-entry-card';
import { BottomTabInset, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useHabits } from '@/hooks/use-habits';

export default function HabitsScreen() {
  const { palette: Palette, styles } = useAppStyles(createStyles);
  const { habits, status, reload } = useHabits();
  const ready = status === 'ready';

  const openNew = () => router.push('/habits/new');
  const openEdit = (id: string) => router.push({ pathname: '/habits/[id]', params: { id } });

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.flex}>
        {/* Fixed header: stays put while the list scrolls, so "Add Habit" is always reachable. */}
        <View style={styles.headerWrap}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.title} accessibilityRole="header">
                Habits
              </Text>
              {ready && habits.length > 0 && (
                <Text style={styles.subtitle}>
                  {habits.length} {habits.length === 1 ? 'habit' : 'habits'} building momentum
                </Text>
              )}
            </View>

            {/* Plain-text label: no icon font dependency, so it renders immediately on Android. */}
            <Pressable
              onPress={openNew}
              disabled={!ready}
              accessibilityRole="button"
              accessibilityLabel="Add habit"
              accessibilityHint="Opens the form to create a new habit"
              accessibilityState={{ disabled: !ready }}
              hitSlop={8}
              android_ripple={{ color: Palette.rippleOnAccent }}
              style={({ pressed }) => [
                styles.addButton,
                !ready && styles.addButtonDisabled,
                pressed && styles.pressed,
              ]}>
              <Text style={styles.addButtonText}>+ Add Habit</Text>
            </Pressable>
          </View>
        </View>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}>
          {status === 'loading' && (
            <View style={styles.centered}>
              <ActivityIndicator color={Palette.accent} />
            </View>
          )}

          {status === 'load-error' && (
            <EmptyState
              title="Couldn't load your habits"
              description="Your saved data hasn't been changed. Try again, or restart the app."
              icon={{ ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' }}
              actionLabel="Try again"
              onAction={reload}
            />
          )}

          {ready && habits.length === 0 && (
            <EmptyState
              title="Start your first habit"
              description="Pick something small you want to do regularly. You can choose the days, an icon and a color."
              actionLabel="Create a habit"
              onAction={openNew}
            />
          )}

          {ready && <RoutinesEntryCard />}

          {ready && habits.length > 0 && (
            <View style={styles.list}>
              {habits.map((habit) => (
                <HabitRow key={habit.id} habit={habit} onPress={openEdit} />
              ))}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const createStyles = (Palette: AppPalette) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  flex: {
    flex: 1,
  },
  headerWrap: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.three,
    backgroundColor: Palette.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  headerText: {
    flex: 1,
    gap: 4,
  },
  title: {
    color: Palette.text,
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  subtitle: {
    color: Palette.textSecondary,
    fontSize: 14,
  },
  addButton: {
    minHeight: 48,
    paddingHorizontal: Spacing.four,
    borderRadius: Radius.pill,
    backgroundColor: Palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: Palette.accent,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  addButtonDisabled: {
    opacity: 0.5,
  },
  addButtonText: {
    color: Palette.onAccent,
    fontSize: 15,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.85,
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: Spacing.one,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.four,
  },
  centered: {
    paddingVertical: Spacing.six,
    alignItems: 'center',
  },
  list: {
    gap: 12,
  },
});
