"use no memo"; // Keep external locale reads live; explicit domain memos remain intact.
import {SymbolView, Text} from '@/components/localized-native';
import { appLabel, appMessage, appNumber } from '@/i18n/app-copy';
import { readableAccent } from '@/utils/theme-color';
import type { AppPalette } from '@/constants/palettes';
import { useAppStyles } from '@/hooks/use-app-styles';

import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Radius } from '@/constants/theme';
import type { AchievementDefinition } from '@/data/achievement-definitions';
import type { AchievementAward } from '@/data/achievement-storage';
import { habitIconSymbol } from '@/data/habit-options';
import type { AchievementEvaluation } from '@/utils/achievements';
import { formatShortDate, toLocalDateKey, formatTimestamp } from '@/i18n/presentation-date';

export function achievementProgress(badge: AchievementDefinition, evaluation: AchievementEvaluation): string {
  const value = Math.min(badge.target, evaluation.metrics[badge.metric]);
  return appMessage(`achievements.progress.${badge.metric}`, { value, target: badge.target });
}

export function AchievementCard({ badge, award, evaluation, wide }: {
  badge: AchievementDefinition; award?: AchievementAward; evaluation: AchievementEvaluation | null; wide: boolean;
}) {
  const { palette: Palette, styles } = useAppStyles(createStyles);
  const [expanded, setExpanded] = useState(false);
  const progress = evaluation ? achievementProgress(badge, evaluation) : appLabel("achievements.achievement-card.progressUnavailable");
  const value = award ? badge.target : evaluation ? Math.min(evaluation.metrics[badge.metric], badge.target) : null;
  return (
    <View style={[styles.card, wide && styles.wide, award && styles.earned]}>
      <Pressable onPress={() => setExpanded((v) => !v)} accessibilityRole="button"
        accessibilityState={{ expanded }} accessibilityLabel={appMessage("achievements.card.accessibility", { name: badge.name, state: award ? appLabel('achievements.achievement-card.earned') : appLabel('achievements.achievement-card.locked'), criterion: badge.criterion, progress: award ? appMessage('achievements.recognized.date', { date: formatShortDate(toLocalDateKey(new Date(award.awardedAt))) }) : progress, action: expanded ? appLabel('achievements.achievement-card.hide') : appLabel('achievements.achievement-card.show') })}
        style={({ pressed }) => [styles.body, pressed && { opacity: 0.75 }]}>
        <View style={styles.top}>
          <View style={[styles.icon, award && styles.earnedIcon]} accessible={false} importantForAccessibility="no-hide-descendants">
            <SymbolView name={habitIconSymbol(badge.icon)} size={27} tintColor={readableAccent(award ? Palette.accent : Palette.textSecondary, Palette)} />
          </View>
          <Text style={[styles.state, award && styles.success]}>{award ? appLabel("achievements.achievement-card.earnedVariant") : appLabel("achievements.achievement-card.locked")}</Text>
        </View>
        <Text style={styles.name}>{badge.name}</Text>
        <Text style={styles.copy}>{badge.criterion}</Text>
        <Text style={[styles.progress, award && styles.success]}>{award ? appMessage("achievements.recognized.date", { date: (formatShortDate(toLocalDateKey(new Date(award.awardedAt)))) }) : progress}</Text>
        {value !== null && <View style={styles.track} accessible={false}><View style={[styles.fill, { width: `${Math.round(value / badge.target * 100)}%`, backgroundColor: award ? Palette.success : Palette.accentBlue }]} /></View>}
        <Text style={styles.more}>{expanded ? appLabel("achievements.achievement-card.lessDetail") : appLabel("achievements.achievement-card.whyThisBadge")}</Text>
      </Pressable>
      {expanded && <View style={styles.details}>
        <Text style={styles.copy}>{appMessage("achievements.card.detail", { detail: badge.detail })}</Text>
        {badge.metric === 'types' && evaluation && <Text style={styles.copy}>{evaluation.types.length === 3 ? appLabel("achievements.achievement-card.allThreeTrackingTypesRecorded") : appMessage("achievements.types.remaining", { types: ((['tick', 'count', 'checklist'] as const).filter((type) => !evaluation.types.includes(type)).map(type => appLabel(`tracking.type.${type}`)).join(', ')) })}</Text>}
        {award && <>
          <Text style={styles.copy}>{appMessage("achievements.history.through", { date: formatShortDate(award.evidenceThrough) })}</Text>
          <Text style={styles.copy}>{appMessage("achievements.recognition.explanation", { timestamp: formatTimestamp(award.awardedAt) })}</Text>
          <Text style={styles.copy}>{award.evidence.windowStart ? appMessage("achievements.evidence.withStart", { metric: appNumber(award.evidence.metric), startDate: formatShortDate(award.evidence.windowStart), endDate: formatShortDate(award.evidence.windowEnd) }) : appMessage("achievements.evidence.noStart", { metric: appNumber(award.evidence.metric), endDate: formatShortDate(award.evidence.windowEnd) })}</Text>
        </>}
        <Text style={styles.copy}>{appLabel("achievements.achievement-card.historicalCalculationsUseCurrentSchedulesAndHabitsThatStillExistOldSchedulesAndDeletedHabitDefinitionsAreUnavailable")}</Text>
      </View>}
    </View>
  );
}

const createStyles = (Palette: AppPalette) => StyleSheet.create({
  card: { width: '100%', backgroundColor: Palette.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Palette.border, overflow: 'hidden' },
  wide: { width: '48.5%' },
  earned: { borderColor: Palette.achievementEarnedBorder, backgroundColor: Palette.achievementEarned },
  body: { padding: 18, gap: 10, minHeight: 240 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  icon: { width: 54, height: 54, borderRadius: Radius.md, backgroundColor: Palette.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  earnedIcon: { backgroundColor: Palette.accentSoft },
  state: { color: Palette.textSecondary, fontSize: 12, fontWeight: '600' },
  success: { color: Palette.success },
  name: { color: Palette.text, fontSize: 18, fontWeight: '700' },
  copy: { color: Palette.textSecondary, fontSize: 14, lineHeight: 21 },
  progress: { color: Palette.text, fontSize: 13, lineHeight: 19, marginTop: 4 },
  track: { height: 5, borderRadius: 4, backgroundColor: Palette.border, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
  more: { color: Palette.accent, fontSize: 13, paddingTop: 4 },
  details: { padding: 18, paddingTop: 0, gap: 12 },
});
