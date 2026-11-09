import { router } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/habits/empty-state';
import { HabitCard } from '@/components/today/habit-card';
import { ProgressRing } from '@/components/today/progress-ring';
import { BottomTabInset, MaxContentWidth, Palette, Radius, Spacing } from '@/constants/theme';
import { DEMO_USER_NAME, getDailyMotivation } from '@/data/demo-habits';
import { useCurrentDate } from '@/hooks/use-current-date';
import { useDailyCompletions, type CompletionStatus } from '@/hooks/use-daily-completions';
import { useHabits } from '@/hooks/use-habits';
import { formatLongDate, getGreeting, toLocalDateKey } from '@/utils/date';
import { HABITS_HREF } from '@/utils/navigation';
import { isScheduledOn, WEEKDAY_LONG } from '@/utils/schedule';

function progressMessage(done: number, total: number) {
  if (total === 0) return 'Nothing scheduled — enjoy the rest day.';
  if (done === 0) return "Let's build some momentum today.";
  if (done === total) return 'All done. You showed up for yourself today.';
  if (done / total >= 0.5) return 'Over halfway there — keep it rolling.';
  return 'Great start. One habit at a time.';
}

function storageNotice(status: CompletionStatus) {
  if (status === 'load-error') {
    return "Couldn't load today's saved habits. Your saved data is untouched — restart the app to try again.";
  }
  if (status === 'save-error') {
    return "Couldn't save your latest change. It will be retried with your next update.";
  }
  return null;
}

export default function TodayScreen() {
  const now = useCurrentDate();
  const { completed, status, toggle } = useDailyCompletions(toLocalDateKey(now));
  const canToggle = status === 'ready' || status === 'save-error';
  const notice = storageNotice(status);

  const { habits, status: habitsStatus, reload } = useHabits();
  const habitsReady = habitsStatus === 'ready';

  // Only habits scheduled for the current local date. Completions are matched by
  // habit ID, so saved IDs for deleted or unscheduled habits are simply ignored.
  const todayHabits = habits.filter((habit) => isScheduledOn(habit, now));
  const total = todayHabits.length;
  const doneCount = todayHabits.filter((habit) => completed.has(habit.id)).length;
  const motivation = getDailyMotivation(now);
  const openHabits = () => router.navigate(HABITS_HREF);

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.date}>{formatLongDate(now).toUpperCase()}</Text>
              <Text style={styles.greeting}>
                {getGreeting(now)},{'\n'}
                <Text style={styles.name}>{DEMO_USER_NAME}</Text>
              </Text>
            </View>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{DEMO_USER_NAME.charAt(0)}</Text>
            </View>
          </View>

          {/* Progress */}
          <View style={styles.progressCard}>
            <ProgressRing completed={doneCount} total={total} />
            <View style={styles.progressText}>
              <Text style={styles.cardLabel}>Daily progress</Text>
              <Text style={styles.progressTitle}>
                {doneCount} of {total} habits
              </Text>
              <Text style={styles.progressSubtitle}>{progressMessage(doneCount, total)}</Text>
            </View>
          </View>

          {/* Habits */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Today&apos;s Habits</Text>
            {habitsReady && total > 0 && (
              <Text style={styles.sectionMeta}>{total - doneCount} left</Text>
            )}
          </View>

          {habitsStatus === 'loading' && (
            <View style={styles.loading}>
              <ActivityIndicator color={Palette.accent} />
            </View>
          )}

          {habitsStatus === 'load-error' && (
            <EmptyState
              title="Couldn't load your habits"
              description="Your saved data hasn't been changed. Try again, or restart the app."
              icon={{ ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' }}
              actionLabel="Try again"
              onAction={reload}
            />
          )}

          {habitsReady && habits.length === 0 && (
            <EmptyState
              title="No habits yet"
              description="Create your first habit and it will show up here on the days you schedule it."
              actionLabel="Create a habit"
              onAction={openHabits}
            />
          )}

          {habitsReady && habits.length > 0 && total === 0 && (
            <EmptyState
              title="Nothing scheduled today"
              description={`None of your habits are scheduled for ${WEEKDAY_LONG[now.getDay()]}. Enjoy the rest, or adjust a schedule.`}
              icon={{ ios: 'moon.stars.fill', android: 'bedtime', web: 'bedtime' }}
              actionLabel="Manage habits"
              onAction={openHabits}
            />
          )}

          {habitsReady && total > 0 && (
            <View style={styles.habitList}>
              {todayHabits.map((habit) => (
                <HabitCard
                  key={habit.id}
                  habit={habit}
                  done={completed.has(habit.id)}
                  disabled={!canToggle}
                  onToggle={toggle}
                />
              ))}
            </View>
          )}
          {notice && <Text style={styles.notice}>{notice}</Text>}

          {/* Motivation */}
          <View style={styles.quoteCard}>
            <Text style={styles.cardLabel}>Daily motivation</Text>
            <Text style={styles.quote}>“{motivation.quote}”</Text>
            <Text style={styles.quoteAuthor}>— {motivation.author}</Text>
          </View>
        </ScrollView>
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
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.four,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  headerText: {
    flex: 1,
    gap: Spacing.two,
  },
  date: {
    color: Palette.accent,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.4,
  },
  greeting: {
    color: Palette.textSecondary,
    fontSize: 28,
    fontWeight: '500',
    lineHeight: 36,
    letterSpacing: -0.5,
  },
  name: {
    color: Palette.text,
    fontWeight: '700',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: Radius.pill,
    backgroundColor: Palette.accentSoft,
    borderWidth: 1,
    borderColor: 'rgba(139, 124, 246, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: Palette.accent,
    fontSize: 18,
    fontWeight: '700',
  },
  progressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.four,
    padding: 20,
    borderRadius: Radius.lg,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  progressText: {
    flex: 1,
    gap: 6,
  },
  cardLabel: {
    color: Palette.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  progressTitle: {
    color: Palette.text,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  progressSubtitle: {
    color: Palette.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: -Spacing.two,
  },
  sectionTitle: {
    color: Palette.text,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  sectionMeta: {
    color: Palette.textMuted,
    fontSize: 14,
    fontWeight: '500',
  },
  habitList: {
    gap: 12,
  },
  loading: {
    paddingVertical: Spacing.five,
    alignItems: 'center',
  },
  notice: {
    marginTop: -Spacing.two,
    color: Palette.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  quoteCard: {
    padding: 20,
    gap: 10,
    borderRadius: Radius.lg,
    backgroundColor: Palette.accentBlueSoft,
    borderWidth: 1,
    borderColor: 'rgba(91, 141, 239, 0.25)',
  },
  quote: {
    color: Palette.text,
    fontSize: 17,
    lineHeight: 26,
    fontWeight: '500',
  },
  quoteAuthor: {
    color: Palette.textSecondary,
    fontSize: 14,
  },
});
