import type { AppPalette } from '@/constants/palettes';
import { useAppStyles } from '@/hooks/use-app-styles';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Radius } from '@/constants/theme';
import { useAchievements } from '@/hooks/use-achievements';

export function AchievementDataNotes() {
  const { styles } = useAppStyles(createStyles);
  const { status, evaluation, retry, acknowledgementError } = useAchievements();
  const notes = evaluation?.notes;
  const message = {
    loading: 'Checking saved achievements…', ready: null,
    waiting: 'Waiting for check-ins to save, including any from a previous day. Confirmed awards stay earned.',
    'inputs-error': 'Waiting for saved habits. If habits could not load, try again.',
    'store-error': 'Could not read achievements. Saved data has not been reset or overwritten. Try again.',
    'history-error': 'Could not check saved history. Previously saved awards stay earned. Try again.',
    'save-error': 'Could not save new achievements. No new badge is confirmed yet. Try again.',
  }[status];
  const error = status.endsWith('error');
  return <View style={styles.box}>
    {message && <Text style={styles.copy}>{message}</Text>}
    {error && <Pressable accessibilityRole="button" onPress={retry} style={styles.button}><Text style={styles.link}>Try again</Text></Pressable>}
    {acknowledgementError && <Text style={styles.copy}>Could not save your acknowledgement. The summary will stay visible; tap Dismiss again to retry.</Text>}
    {!!notes?.unreadableDays && <Text style={styles.copy}>At least {evaluation!.metrics.checkins} recorded check-ins; {notes.unreadableDays} saved {notes.unreadableDays === 1 ? 'day could' : 'days could'} not be read. Unknown days never connect a streak.</Text>}
    {!!notes?.deletedHabits && <Text style={styles.copy}>Some history belongs to removed habits and does not count toward new awards.</Text>}
    {!!notes?.ignoredDays && <Text style={styles.copy}>{notes.ignoredDays} invalid or future history records ignored.</Text>}
    {!!notes?.extraCompletions && <Text style={styles.copy}>Some completions are outside current schedules and do not count.</Text>}
    <Text style={styles.copy}>Finished local days count. Today is provisional. Historical progress uses current schedules; schedules are not versioned. Edits or deletions can reduce locked progress, while saved awards stay earned.</Text>
  </View>;
}
const createStyles = (Palette: AppPalette) => StyleSheet.create({
  box: { padding: 16, gap: 8, borderRadius: Radius.md, backgroundColor: Palette.surface, borderWidth: 1, borderColor: Palette.controlBorder },
  copy: { color: Palette.textSecondary, fontSize: 13, lineHeight: 20 },
  button: { minHeight: 48, justifyContent: 'center', alignSelf: 'flex-start', paddingHorizontal: 12 },
  link: { color: Palette.accent, fontSize: 14, fontWeight: '600' },
});
