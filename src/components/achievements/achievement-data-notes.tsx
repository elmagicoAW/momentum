"use no memo"; // Keep external locale reads live; explicit domain memos remain intact.
import {Text} from '@/components/localized-native';
import { appLabel, appMessage } from '@/i18n/app-copy';
import type { AppPalette } from '@/constants/palettes';
import { useAppStyles } from '@/hooks/use-app-styles';
import { Pressable, StyleSheet, View } from 'react-native';

import { Radius } from '@/constants/theme';
import { useAchievements } from '@/hooks/use-achievements';

export function AchievementDataNotes() {
  const { styles } = useAppStyles(createStyles);
  const { status, evaluation, retry, acknowledgementError } = useAchievements();
  const notes = evaluation?.notes;
  const message = {
    get loading(){return appLabel("achievements.achievement-data-notes.checkingSavedAchievementsPending");}, ready: null,
    get waiting(){return appLabel("achievements.achievement-data-notes.waitingForCheckInsToSaveIncludingAnyFromAPreviousDayConfirmedAwardsStayEarned");},
    get 'inputs-error'(){return appLabel("achievements.achievement-data-notes.waitingForSavedHabitsIfHabitsCouldNotLoadTryAgain");},
    get 'store-error'(){return appLabel("achievements.achievement-data-notes.couldNotReadAchievementsSavedDataHasNotBeenResetOrOverwrittenTryAgain");},
    get 'history-error'(){return appLabel("achievements.achievement-data-notes.couldNotCheckSavedHistoryPreviouslySavedAwardsStayEarnedTryAgain");},
    get 'save-error'(){return appLabel("achievements.achievement-data-notes.couldNotSaveNewAchievementsNoNewBadgeIsConfirmedYetTryAgain");},
  }[status];
  const error = status.endsWith('error');
  return <View style={styles.box}>
    {message && <Text style={styles.copy}>{message}</Text>}
    {error && <Pressable accessibilityRole="button" onPress={retry} style={styles.button}><Text style={styles.link}>{appLabel("achievements.achievement-data-notes.tryAgain")}</Text></Pressable>}
    {acknowledgementError && <Text style={styles.copy}>{appLabel("achievements.achievement-data-notes.couldNotSaveYourAcknowledgementTheSummaryWillStayVisibleTapDismissAgainToRetry")}</Text>}
    {!!notes?.unreadableDays && <Text style={styles.copy}>{appMessage("achievements.notes.unreadable", { total: evaluation!.metrics.checkins, count: notes.unreadableDays })}</Text>}
    {!!notes?.deletedHabits && <Text style={styles.copy}>{appLabel("achievements.achievement-data-notes.someHistoryBelongsToRemovedHabitsAndDoesNotCountTowardNewAwards")}</Text>}
    {!!notes?.ignoredDays && <Text style={styles.copy}>{appMessage("achievements.notes.ignored", { count: notes.ignoredDays })}</Text>}
    {!!notes?.extraCompletions && <Text style={styles.copy}>{appLabel("achievements.achievement-data-notes.someCompletionsAreOutsideCurrentSchedulesAndDoNotCount")}</Text>}
    <Text style={styles.copy}>{appLabel("achievements.achievement-data-notes.finishedLocalDaysCountTodayIsProvisionalHistoricalProgressUsesCurrentSchedulesSchedulesAreNotVersionedEditsOrDeletionsCanReduceLockedProgressWhileSavedAwardsStayEarned")}</Text>
  </View>;
}
const createStyles = (Palette: AppPalette) => StyleSheet.create({
  box: { padding: 16, gap: 8, borderRadius: Radius.md, backgroundColor: Palette.surface, borderWidth: 1, borderColor: Palette.controlBorder },
  copy: { color: Palette.textSecondary, fontSize: 13, lineHeight: 20 },
  button: { minHeight: 48, justifyContent: 'center', alignSelf: 'flex-start', paddingHorizontal: 12 },
  link: { color: Palette.accent, fontSize: 14, fontWeight: '600' },
});
