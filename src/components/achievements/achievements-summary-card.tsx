import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Palette, Radius } from '@/constants/theme';
import { ACHIEVEMENTS } from '@/data/achievement-definitions';
import { habitIconSymbol } from '@/data/habit-options';
import { useAchievements } from '@/hooks/use-achievements';
import { useDailyProgress } from '@/hooks/use-daily-progress';
import { useHabits } from '@/hooks/use-habits';
import { hasProvisionalEffort } from '@/utils/achievements';
import { openAchievements } from '@/utils/navigation';
import { achievementProgress } from './achievement-card';

export function AchievementCelebration() {
  const { collection, storeReady, acknowledge } = useAchievements();
  const unseen = ACHIEVEMENTS.filter((badge) => collection.awards[badge.id] && !collection.seenBadgeIds.includes(badge.id));
  if (!storeReady || unseen.length === 0) return null;
  const backfill = unseen.every((badge) => collection.awards[badge.id].source === 'backfill');
  return <View style={styles.celebration}>
    <Text style={styles.celebrationTitle} accessibilityLiveRegion="polite">{backfill ? `${unseen.length} ${unseen.length === 1 ? 'achievement found' : 'achievements found'} in your history` : `${unseen.length} new ${unseen.length === 1 ? 'achievement' : 'achievements'} confirmed`}</Text>
    <Text style={styles.copy}>{unseen.map((badge) => badge.name).join(' · ')}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel="Dismiss achievement summary" onPress={() => acknowledge(unseen.map((badge) => badge.id))} style={styles.action}><Text style={styles.link}>Dismiss</Text></Pressable>
  </View>;
}

export function AchievementsSummaryCard({ today = false }: { today?: boolean }) {
  const { collection, storeReady, status, evaluation, acknowledge } = useAchievements();
  const daily = useDailyProgress();
  const { habits, status: habitsStatus } = useHabits();
  const earned = ACHIEVEMENTS.filter((badge) => collection.awards[badge.id]);
  const recent = [...earned].sort((a, b) => collection.awards[b.id].awardedAt.localeCompare(collection.awards[a.id].awardedAt)).slice(0, 3);
  const next = ACHIEVEMENTS.find((badge) => !collection.awards[badge.id]);
  const encouraging = today && storeReady && next && habitsStatus === 'ready' && daily.status === 'ready' && hasProvisionalEffort(habits, daily.record, daily.dateKey);
  const open = () => {
    acknowledge(earned.filter((badge) => !collection.seenBadgeIds.includes(badge.id)).map((badge) => badge.id));
    openAchievements();
  };
  return <View style={styles.card}>
    <Pressable accessibilityRole="button" onPress={open} style={({ pressed }) => [styles.body, pressed && { opacity: 0.75 }]}>
      <View style={styles.row}>
        <Text style={styles.eyebrow}>YOUR MOMENTUM</Text>
        <SymbolView name={{ ios: 'arrow.up.right', android: 'north_east', web: 'north_east' }} size={18} tintColor={Palette.accentBlue} />
      </View>
      <Text style={styles.title}>Achievements</Text>
      <View style={styles.row}>
        <Text style={styles.count}>{storeReady ? `${earned.length} of ${ACHIEVEMENTS.length} earned` : status === 'store-error' ? 'Collection unavailable' : 'Loading collection…'}</Text>
        <View style={styles.symbols} accessible={false} importantForAccessibility="no-hide-descendants">{recent.map((badge) => <SymbolView key={badge.id} name={habitIconSymbol(badge.icon)} size={20} tintColor={Palette.accent} />)}</View>
      </View>
      {storeReady && status === 'ready' && evaluation && next && <Text style={styles.copy}>Next: {next.name} · {achievementProgress(next, evaluation)}</Text>}
      {storeReady && !next && <Text style={styles.copy}>Your collection is complete. Keep showing up for yourself.</Text>}
      <Text style={styles.link}>View achievements</Text>
    </Pressable>
    {encouraging && <Text style={styles.encouragement}>{earned.length === 0 ? 'Great start! Your progress today is provisional. Your first achievement can be confirmed after today once its requirement is complete and saved.' : 'Good work today. This progress is provisional; eligible achievements are confirmed after the day ends and saves finish.'}</Text>}
    {today && <AchievementCelebration />}
  </View>;
}
const styles = StyleSheet.create({
  card: { backgroundColor: '#141322', borderWidth: 1, borderColor: '#343052', borderRadius: Radius.lg, overflow: 'hidden' },
  body: { padding: 18, gap: 10, minHeight: 48 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' },
  eyebrow: { color: Palette.accentBlue, fontSize: 10, letterSpacing: 1.8, fontWeight: '700' },
  title: { color: Palette.text, fontSize: 21, fontWeight: '700' },
  count: { color: Palette.text, fontSize: 15, fontWeight: '600' },
  copy: { color: Palette.textSecondary, fontSize: 13, lineHeight: 20 },
  link: { color: Palette.accent, fontSize: 14, fontWeight: '600' },
  symbols: { flexDirection: 'row', gap: 10 },
  encouragement: { color: '#C5BCFF', fontSize: 13, lineHeight: 20, padding: 18, paddingTop: 0 },
  celebration: { borderTopWidth: 1, borderColor: Palette.border, padding: 16, gap: 6 },
  celebrationTitle: { color: Palette.success, fontSize: 15, fontWeight: '600' },
  action: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 12, alignSelf: 'flex-start' },
});
