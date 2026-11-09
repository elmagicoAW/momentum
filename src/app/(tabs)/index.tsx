import { router } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/habits/empty-state';
import { NamePromptCard } from '@/components/profile/name-prompt-card';
import { ProfileAvatar } from '@/components/profile/profile-avatar';
import { TodaysPlan } from '@/components/routines/todays-plan';
import { HabitCard } from '@/components/today/habit-card';
import { ProgressNotices, saveLabel } from '@/components/today/progress-notices';
import { ProgressRing } from '@/components/today/progress-ring';
import { BottomTabInset, MaxContentWidth, Palette, Radius, Spacing } from '@/constants/theme';
import { getDailyMotivation } from '@/data/demo-habits';
import { shouldShowNamePrompt } from '@/data/profile-storage';
import { useCurrentDate } from '@/hooks/use-current-date';
import { useDailyProgress } from '@/hooks/use-daily-progress';
import { useHabits } from '@/hooks/use-habits';
import { useProfile } from '@/hooks/use-profile';
import { useRoutines } from '@/hooks/use-routines';
import { useTimeOfDay } from '@/hooks/use-time-of-day';
import { formatLongDate, getGreeting, parseLocalDateKey } from '@/utils/date';
import { isCompleteNow } from '@/utils/habit-progress';
import { HABITS_HREF, openProfileEditor, openRoutine, openRoutineList } from '@/utils/navigation';
import { planForDay } from '@/utils/routine-progress';
import { isScheduledOn, WEEKDAY_LONG } from '@/utils/schedule';

function progressMessage(done: number, total: number) {
  if (total === 0) return 'Nothing scheduled — enjoy the rest day.';
  if (done === 0) return "Let's build some momentum today.";
  if (done === total) return 'All done. You showed up for yourself today.';
  if (done / total >= 0.5) return 'Over halfway there — keep it rolling.';
  return 'Great start. One habit at a time.';
}

export default function TodayScreen() {
  const now = useCurrentDate();
  const daily = useDailyProgress();
  const { record, status, saveState, canEdit } = daily;
  // The provider's date decides which habits are "today", so cards and saves always agree.
  const today = parseLocalDateKey(daily.dateKey);

  const { habits, status: habitsStatus, reload } = useHabits();
  const habitsReady = habitsStatus === 'ready';

  // Only habits scheduled for the current local date. Progress is matched by
  // habit ID, so entries for deleted or unscheduled habits are simply ignored.
  // Each habit counts once: Count/Checklist add 1 only when complete.
  const todayHabits = habits.filter((habit) => isScheduledOn(habit, today));
  const total = todayHabits.length;
  const doneCount = todayHabits.filter((habit) => isCompleteNow(record, habit)).length;
  const savingText = saveLabel(saveState);
  const motivation = getDailyMotivation(now);
  const openHabits = () => router.navigate(HABITS_HREF);

  // Today's plan: overview of routines only. It never changes the ring or list above/below.
  const { routines, status: routinesStatus, reload: reloadRoutines } = useRoutines();
  const bucket = useTimeOfDay();
  const plan = planForDay(routines, habitsReady ? habits : [], today, record, bucket);

  // Profile: a name only once it has loaded — never a placeholder name, and no
  // first-run card while loading or after a load error. Habits never wait for it.
  const { profile, status: profileStatus, dismissNamePrompt } = useProfile();
  const profileReady = profileStatus === 'ready';
  const displayName = profileReady ? profile.displayName : undefined;
  const greeting = getGreeting(now);
  const showNamePrompt = profileReady && shouldShowNamePrompt(profile);
  const avatarLabel = displayName ? `Profile: ${displayName}. Edit profile` : 'Set up your profile';

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
              <Text style={styles.greeting} accessibilityRole="header">
                {displayName ? (
                  <>
                    {greeting},{'\n'}
                    <Text style={styles.name}>{displayName}</Text>
                  </>
                ) : (
                  `${greeting}.`
                )}
              </Text>
            </View>
            <Pressable
              onPress={openProfileEditor}
              accessibilityRole="button"
              accessibilityLabel={avatarLabel}
              hitSlop={8}
              style={({ pressed }) => pressed && styles.pressed}>
              <ProfileAvatar avatar={profileReady ? profile.avatar : { kind: 'initials' }} displayName={displayName} />
            </Pressable>
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

          {/* Optional first-run name card — below the progress, so habits stay in view */}
          {showNamePrompt && <NamePromptCard onAdd={openProfileEditor} onDismiss={dismissNamePrompt} />}

          {/* Today's plan — only when a routine has habits due today */}
          {habitsReady && (
            <TodaysPlan
              plan={plan}
              routinesStatus={routinesStatus}
              onOpen={openRoutine}
              onManage={openRoutineList}
              onRetry={reloadRoutines}
            />
          )}

          {/* Habits */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Today&apos;s Habits</Text>
            {habitsReady && total > 0 && (
              <Text style={styles.sectionMeta} accessibilityLiveRegion="polite">
                {total - doneCount} left
                {savingText && <Text style={styles.saveMeta}> · {savingText}</Text>}
              </Text>
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
              description={`None of your habits are scheduled for ${WEEKDAY_LONG[today.getDay()]}. Enjoy the rest, or adjust a schedule.`}
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
                  record={record}
                  disabled={!canEdit}
                  onToggleTick={daily.toggleTick}
                  onAdjustCount={daily.adjustCount}
                  onToggleStep={daily.toggleStep}
                />
              ))}
            </View>
          )}

          <ProgressNotices
            loadError={habitsReady && total > 0 && status === 'load-error'}
            saveError={saveState === 'error'}
            onReload={daily.reloadDay}
            onRetry={daily.retrySave}
          />

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
  pressed: {
    opacity: 0.75,
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
  saveMeta: {
    color: Palette.textMuted,
    fontWeight: '500',
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
