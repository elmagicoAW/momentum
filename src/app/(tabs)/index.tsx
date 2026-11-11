"use no memo";
import { useArabicComposition } from '@/hooks/use-arabic-composition';
import { arabicTodayProgress } from '@/utils/today-presentation';
import { useState } from 'react';
import {Text} from '@/components/localized-native';
import type { AppPalette } from '@/constants/palettes';
import { useAppStyles } from '@/hooks/use-app-styles';
import { useLanguage } from '@/hooks/use-language';
import { todayCopy, todayDate, todayGreeting, todayMotivation, todayRich } from '@/i18n/today';
import { formatLocalWeekday } from '@/i18n/format';
import { LocalizedInline } from '@/components/localized-inline';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/habits/empty-state';
import { AchievementsSummaryCard } from '@/components/achievements/achievements-summary-card';
import { NamePromptCard } from '@/components/profile/name-prompt-card';
import { ProfileAvatar } from '@/components/profile/profile-avatar';
import { TodaysPlan } from '@/components/routines/todays-plan';
import { HabitCard } from '@/components/today/habit-card';
import { ProgressNotices, saveLabel } from '@/components/today/progress-notices';
import { ProgressRing } from '@/components/today/progress-ring';
import { BottomTabInset, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { getDailyMotivation } from '@/data/demo-habits';
import { shouldShowNamePrompt } from '@/data/profile-storage';
import { useCurrentDate } from '@/hooks/use-current-date';
import { useDailyProgress } from '@/hooks/use-daily-progress';
import { useHabits } from '@/hooks/use-habits';
import { useProfile } from '@/hooks/use-profile';
import { useRoutines } from '@/hooks/use-routines';
import { useTimeOfDay } from '@/hooks/use-time-of-day';
import { parseLocalDateKey } from '@/utils/date';
import { isCompleteNow } from '@/utils/habit-progress';
import { HABITS_HREF, openProfileEditor, openRoutine, openRoutineList } from '@/utils/navigation';
import { planForDay } from '@/utils/routine-progress';
import { isScheduledOn } from '@/utils/schedule';
import type { MessageKey } from '@/i18n/types';

function progressMessageKey(done: number, total: number): MessageKey {
  if (total === 0) return 'today.restDay';
  if (done === 0) return 'today.getStarted';
  if (done === total) return 'today.allDone';
  if (done / total >= 0.5) return 'today.halfway';
  return 'today.greatStart';
}

export default function TodayScreen() {
  const arabic = useArabicComposition();
  const { fontScale } = useWindowDimensions();
  const [progressWidth, setProgressWidth] = useState<number | null>(null);
  const progressLayout = arabicTodayProgress(progressWidth, fontScale);
  const { palette: Palette, styles } = useAppStyles(createStyles);
  const { language } = useLanguage();
  const { t, m } = todayCopy(language);
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
  const savingText = saveLabel(saveState, language);
  const motivation = todayMotivation(language, getDailyMotivation(now));
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
  const greeting = todayGreeting(language, now);
  const showNamePrompt = profileReady && shouldShowNamePrompt(profile);
  const avatarLabel = displayName ? m('accessibility.profileNamed', { name: displayName }) : t('profile.setup');

  return (
    <View style={[styles.screen,arabic.active && arabic.surface]}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={[styles.header, arabic.active && { direction: 'rtl', gap: 12 }]}>
            <View style={[styles.headerText, arabic.active && { minWidth: 0, alignItems: 'stretch' }]}>
              <Text style={[styles.date, arabic.active && arabic.title]}>{todayDate(language, now)}</Text>
              <Text style={[styles.greeting, arabic.active && arabic.title]} accessibilityRole="header">
                {displayName ? (
                  <LocalizedInline message={todayRich(language, 'today.greetingLine', { greeting, name: displayName }, 'name')} slotStyle={styles.name} />
                ) : (
                  m('today.greetingOnly', { greeting })
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
          {arabic.active ? <View onLayout={event => {
            const width = event.nativeEvent.layout.width;
            // Height changes must not feed back into layout; ignore subpixel width jitter.
            setProgressWidth(previous => previous !== null && Math.abs(previous - width) < 0.5 ? previous : width);
          }} style={[styles.progressCard, progressLayout.container]}>
            <View style={progressLayout.text}>
              <Text style={[styles.cardLabel,arabic.title]}>{t('today.dailyProgress')}</Text>
              <Text style={[styles.progressTitle,arabic.title,{fontSize:20}]}>{m('today.progress',{completed:doneCount,total})}</Text>
              <Text style={[styles.progressSubtitle,arabic.supporting]}>{t(progressMessageKey(doneCount,total))}</Text>
            </View>
            <View style={{alignSelf:'center'}}><ProgressRing completed={doneCount} total={total} size={progressLayout.ringSize} strokeWidth={8} captionBelow={progressLayout.captionBelow} /></View>
          </View> : <View style={styles.progressCard}>
            <ProgressRing completed={doneCount} total={total} />
            <View style={styles.progressText}>
              <Text style={styles.cardLabel}>{t('today.dailyProgress')}</Text>
              <Text style={styles.progressTitle}>
                {m('today.progress', { completed: doneCount, total })}
              </Text>
              <Text style={styles.progressSubtitle}>{t(progressMessageKey(doneCount, total))}</Text>
            </View>
          </View>}

          {/* Optional first-run name card — below the progress, so habits stay in view */}
          {showNamePrompt && <NamePromptCard onAdd={openProfileEditor} onDismiss={dismissNamePrompt} />}

          <AchievementsSummaryCard today />

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
            <Text style={styles.sectionTitle}>{t('today.habits')}</Text>
            {habitsReady && total > 0 && (
              <Text style={styles.sectionMeta} accessibilityLiveRegion="polite">
                {savingText ? <LocalizedInline message={todayRich(language, 'today.remainingSaved', { count: total - doneCount, status: savingText }, 'status')} slotStyle={styles.saveMeta} />
                  : m('today.remainingCount', { count: total - doneCount })}
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
              title={t('today.loadHabits.title')}
              description={t('today.loadHabits.body')}
              icon={{ ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' }}
              actionLabel={t('today.retry')}
              onAction={reload}
            />
          )}

          {habitsReady && habits.length === 0 && (
            <EmptyState
              title={t('habits.empty.title')}
              description={t('habits.empty.description')}
              actionLabel={t('habits.create')}
              onAction={openHabits}
            />
          )}

          {habitsReady && habits.length > 0 && total === 0 && (
            <EmptyState
              title={t('today.noneScheduled')}
              description={m('today.noneOnDay', { day: formatLocalWeekday(language, daily.dateKey) })}
              icon={{ ios: 'moon.stars.fill', android: 'bedtime', web: 'bedtime' }}
              actionLabel={t('habits.manage')}
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
            <Text style={styles.cardLabel}>{t('today.motivation')}</Text>
            <Text style={styles.quote}>{m('today.motivation.quote', { quote: motivation.quote })}</Text>
            <Text style={styles.quoteAuthor}>{m('today.motivation.author', { author: motivation.author })}</Text>
          </View>
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
    borderColor: Palette.blueBorder,
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
