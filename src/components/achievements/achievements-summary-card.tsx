"use no memo"; // Keep external locale reads live; explicit domain memos remain intact.
import {SymbolView, Text} from '@/components/localized-native';
import type { AppPalette } from '@/constants/palettes';
import { useAppStyles } from '@/hooks/use-app-styles';
import { useLanguage } from '@/hooks/use-language';
import { todayAchievementProgress, todayBadgeName, todayCopy } from '@/i18n/today';

import { Pressable, StyleSheet, View } from 'react-native';

import { Radius } from '@/constants/theme';
import { ACHIEVEMENTS } from '@/data/achievement-definitions';
import { habitIconSymbol } from '@/data/habit-options';
import { useAchievements } from '@/hooks/use-achievements';
import { useDailyProgress } from '@/hooks/use-daily-progress';
import { useHabits } from '@/hooks/use-habits';
import { hasProvisionalEffort } from '@/utils/achievements';
import { openAchievements } from '@/utils/navigation';

export function AchievementCelebration() {
  const { styles } = useAppStyles(createStyles);
  const { language } = useLanguage();
  const { t, m } = todayCopy(language);
  const { collection, storeReady, acknowledge } = useAchievements();
  const unseen = ACHIEVEMENTS.filter((badge) => collection.awards[badge.id] && !collection.seenBadgeIds.includes(badge.id));
  if (!storeReady || unseen.length === 0) return null;
  const backfill = unseen.every((badge) => collection.awards[badge.id].source === 'backfill');
  return <View style={styles.celebration}>
    <Text style={styles.celebrationTitle} accessibilityLiveRegion="polite">{m(backfill ? 'today.achievement.found' : 'today.achievement.confirmed', { count: unseen.length })}</Text>
    <Text style={styles.copy}>{unseen.map((badge) => todayBadgeName(language, badge)).join(' · ')}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={t('today.achievement.dismissA11y')} onPress={() => acknowledge(unseen.map((badge) => badge.id))} style={styles.action}><Text style={styles.link}>{t('today.achievement.dismiss')}</Text></Pressable>
  </View>;
}

export function AchievementsSummaryCard({ today = false }: { today?: boolean }) {
  const { palette: Palette, styles } = useAppStyles(createStyles);
  const { language } = useLanguage();
  const { t, m } = todayCopy(language);
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
  return <View style={[styles.card, language === 'ar' && { direction: 'rtl' }]}>
    <Pressable accessibilityRole="button" onPress={open} style={({ pressed }) => [styles.body, pressed && { opacity: 0.75 }]}>
      {language === 'ar' ? <>
        <View style={{ direction: 'rtl', flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
          <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
            <Text style={styles.eyebrow}>{t('today.achievement.eyebrow')}</Text>
            <Text style={styles.title}>{t('navigation.achievements')}</Text>
          </View>
          {/* This component mirrors this right chevron once; no hardcoded diagonal arrow. */}
          <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} size={18} tintColor={Palette.accentBlue} accessible={false} />
        </View>
        <Text style={styles.count}>{storeReady ? m('today.achievement.count', { completed: earned.length, total: ACHIEVEMENTS.length }) : t(status === 'store-error' ? 'today.achievement.unavailable' : 'today.achievement.loading')}</Text>
        {recent.length > 0 && <View style={[styles.symbols, { direction: 'rtl', flexWrap: 'wrap', alignSelf: 'flex-start' }]} accessible={false} importantForAccessibility="no-hide-descendants">
          {recent.map((badge) => <SymbolView key={badge.id} name={habitIconSymbol(badge.icon)} size={20} tintColor={Palette.accent} />)}
        </View>}
        {storeReady && status === 'ready' && evaluation && next && <Text style={styles.copy}>{m('today.achievement.next', { name: todayBadgeName(language, next), progress: todayAchievementProgress(language, next, evaluation) })}</Text>}
        {storeReady && !next && <Text style={styles.copy}>{t('today.achievement.complete')}</Text>}
        <Text style={styles.link}>{t('today.achievement.view')}</Text>
      </> : <>
      <View style={styles.row}>
        <Text style={styles.eyebrow}>{t('today.achievement.eyebrow')}</Text>
        <SymbolView name={{ ios: 'arrow.up.right', android: 'north_east', web: 'north_east' }} size={18} tintColor={Palette.accentBlue} />
      </View>
      <Text style={styles.title}>{t('navigation.achievements')}</Text>
      <View style={styles.row}>
        <Text style={styles.count}>{storeReady ? m('today.achievement.count', { completed: earned.length, total: ACHIEVEMENTS.length }) : t(status === 'store-error' ? 'today.achievement.unavailable' : 'today.achievement.loading')}</Text>
        <View style={styles.symbols} accessible={false} importantForAccessibility="no-hide-descendants">{recent.map((badge) => <SymbolView key={badge.id} name={habitIconSymbol(badge.icon)} size={20} tintColor={Palette.accent} />)}</View>
      </View>
      {storeReady && status === 'ready' && evaluation && next && <Text style={styles.copy}>{m('today.achievement.next', { name: todayBadgeName(language, next), progress: todayAchievementProgress(language, next, evaluation) })}</Text>}
      {storeReady && !next && <Text style={styles.copy}>{t('today.achievement.complete')}</Text>}
      <Text style={styles.link}>{t('today.achievement.view')}</Text>
      </>}
    </Pressable>
    {encouraging && <Text style={styles.encouragement}>{t(earned.length === 0 ? 'today.achievement.firstEffort' : 'today.achievement.effort')}</Text>}
    {today && <AchievementCelebration />}
  </View>;
}
const createStyles = (Palette: AppPalette) => StyleSheet.create({
  card: { backgroundColor: Palette.achievementSummary, borderWidth: 1, borderColor: Palette.achievementSummaryBorder, borderRadius: Radius.lg, overflow: 'hidden' },
  body: { padding: 18, gap: 10, minHeight: 48 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' },
  eyebrow: { color: Palette.accentBlue, fontSize: 10, letterSpacing: 1.8, fontWeight: '700' },
  title: { color: Palette.text, fontSize: 21, fontWeight: '700' },
  count: { color: Palette.text, fontSize: 15, fontWeight: '600' },
  copy: { color: Palette.textSecondary, fontSize: 13, lineHeight: 20 },
  link: { color: Palette.accent, fontSize: 14, fontWeight: '600' },
  symbols: { flexDirection: 'row', gap: 10 },
  encouragement: { color: Palette.achievementEncouragement, fontSize: 13, lineHeight: 20, padding: 18, paddingTop: 0 },
  celebration: { borderTopWidth: 1, borderColor: Palette.border, padding: 16, gap: 6 },
  celebrationTitle: { color: Palette.success, fontSize: 15, fontWeight: '600' },
  action: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 12, alignSelf: 'flex-start' },
});
