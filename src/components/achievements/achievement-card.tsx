import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Palette, Radius } from '@/constants/theme';
import type { AchievementDefinition } from '@/data/achievement-definitions';
import type { AchievementAward } from '@/data/achievement-storage';
import { habitIconSymbol } from '@/data/habit-options';
import type { AchievementEvaluation } from '@/utils/achievements';
import { formatShortDate, toLocalDateKey } from '@/utils/date';

export function achievementProgress(badge: AchievementDefinition, evaluation: AchievementEvaluation): string {
  const value = Math.min(badge.target, evaluation.metrics[badge.metric]);
  const units = { checkins: 'check-ins', activeDays: 'different days', streak: 'scheduled check-ins on one habit', types: 'tracking types', perfectDays: 'perfect day', perfectWeeks: 'finished perfect week' };
  return `${value} / ${badge.target} ${units[badge.metric]}`;
}

export function AchievementCard({ badge, award, evaluation, wide }: {
  badge: AchievementDefinition; award?: AchievementAward; evaluation: AchievementEvaluation | null; wide: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const progress = evaluation ? achievementProgress(badge, evaluation) : 'Progress unavailable';
  const value = award ? badge.target : evaluation ? Math.min(evaluation.metrics[badge.metric], badge.target) : null;
  return (
    <View style={[styles.card, wide && styles.wide, award && styles.earned]}>
      <Pressable onPress={() => setExpanded((v) => !v)} accessibilityRole="button"
        accessibilityState={{ expanded }} accessibilityLabel={`${badge.name}. ${award ? 'Earned' : 'Locked'}. ${badge.criterion} ${award ? 'Recognized on ' + formatShortDate(toLocalDateKey(new Date(award.awardedAt))) : progress}. ${expanded ? 'Hide' : 'Show'} details.`}
        style={({ pressed }) => [styles.body, pressed && { opacity: 0.75 }]}>
        <View style={styles.top}>
          <View style={[styles.icon, award && styles.earnedIcon]} accessible={false} importantForAccessibility="no-hide-descendants">
            <SymbolView name={habitIconSymbol(badge.icon)} size={27} tintColor={award ? Palette.accent : Palette.textSecondary} />
          </View>
          <Text style={[styles.state, award && styles.success]}>{award ? '✓ Earned' : 'Locked'}</Text>
        </View>
        <Text style={styles.name}>{badge.name}</Text>
        <Text style={styles.copy}>{badge.criterion}</Text>
        <Text style={[styles.progress, award && styles.success]}>{award ? `Recognized on ${formatShortDate(toLocalDateKey(new Date(award.awardedAt)))}` : progress}</Text>
        {value !== null && <View style={styles.track} accessible={false}><View style={[styles.fill, { width: `${Math.round(value / badge.target * 100)}%`, backgroundColor: award ? Palette.success : Palette.accentBlue }]} /></View>}
        <Text style={styles.more}>{expanded ? 'Less detail −' : 'Why this badge? +'}</Text>
      </Pressable>
      {expanded && <View style={styles.details}>
        <Text style={styles.copy}>{badge.detail} Only saved, finished local days count. Count targets and required Checklist steps use their saved snapshots.</Text>
        {badge.metric === 'types' && evaluation && <Text style={styles.copy}>{evaluation.types.length === 3 ? 'All three tracking types recorded.' : `Still to record: ${(['tick', 'count', 'checklist'] as const).filter((type) => !evaluation.types.includes(type)).join(', ')}.`}</Text>}
        {award && <>
          <Text style={styles.copy}>Based on saved history through {formatShortDate(award.evidenceThrough)}.</Text>
          <Text style={styles.copy}>Recognized on {new Date(award.awardedAt).toLocaleString()}. This is the recognition time, not an original historical unlock time.</Text>
          <Text style={styles.copy}>Saved evidence: {award.evidence.metric}{award.evidence.windowStart ? `, from ${formatShortDate(award.evidence.windowStart)}` : ''} through {formatShortDate(award.evidence.windowEnd)}. This award stays earned after edits or deletions.</Text>
        </>}
        <Text style={styles.copy}>Historical calculations use current schedules and habits that still exist. Old schedules and deleted habit definitions are unavailable.</Text>
      </View>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: '100%', backgroundColor: Palette.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Palette.border, overflow: 'hidden' },
  wide: { width: '48.5%' },
  earned: { borderColor: '#47406C', backgroundColor: '#171424' },
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
