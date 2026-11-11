"use no memo"; // Keep external locale reads live; explicit domain memos remain intact.
import {Text} from '@/components/localized-native';
import { appLabel, appMessage, appRich } from '@/i18n/app-copy';
import { LocalizedInline } from '@/components/localized-inline';
import type { AppPalette } from '@/constants/palettes';
import { useAppStyles } from '@/hooks/use-app-styles';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { formatRate } from '@/components/insights/format';
import { Radius } from '@/constants/theme';
import { trend, type InsightsIndex } from '@/utils/insights';

type Kind = 'week' | 'month';

const BAR_HEIGHT = 120;

/** Consistency per week (last 8) or month (last 6), drawn with plain Views. */
export function TrendBars({ index }: { index: InsightsIndex }) {
  const { styles } = useAppStyles(createStyles);
  const [kind, setKind] = useState<Kind>('week');
  const data = useMemo(() => trend(index, kind), [index, kind]);

  return (
    <View style={styles.container}>
      <View style={styles.segment} accessibilityRole="tablist">
        {(['week', 'month'] as const).map((k) => (
          <Pressable
            key={k}
            onPress={() => setKind(k)}
            accessibilityRole="tab"
            accessibilityState={{ selected: kind === k }}
            style={[styles.segmentButton, kind === k && styles.segmentActive]}>
            <Text style={[styles.segmentText, kind === k && styles.segmentTextActive]}>
              {k === 'week' ? appLabel("insights.trend-bars.weekly") : appLabel("insights.trend-bars.monthly")}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.chart}>
        {data.points.map((p) => {
          const pct = p.rate === null ? null : Math.round(p.rate * 100);
          return (
            <View
              key={p.key}
              style={styles.column}
              accessible
              accessibilityLabel={appMessage("display.labelColon", { label: String(p.isCurrent ? appMessage("insights.trend.currentLabel", { label: (p.label) }) : p.label), textValue: pct === null ? appLabel("insights.trend-bars.nothingFinishedWasScheduled") : appMessage("insights.trend.accessibility", { percent: (pct), done: (p.done), total: (p.finished) }) })}>
              <Text style={styles.value}>{pct === null ? '' : `${pct}`}</Text>
              <View style={styles.track}>
                {pct === null ? (
                  <View style={styles.gap} />
                ) : (
                  <View
                    style={[
                      styles.bar,
                      { height: Math.max((pct / 100) * BAR_HEIGHT, 3) },
                      p.isCurrent && styles.barCurrent,
                    ]}
                  />
                )}
              </View>
              <Text style={[styles.axis, p.isCurrent && styles.axisCurrent]} numberOfLines={1}>
                {p.isCurrent ? appLabel("insights.trend-bars.now") : p.label}
              </Text>
            </View>
          );
        })}
      </View>

      <Text style={styles.summary}><LocalizedInline message={appRich('insights.trend.footer', { average: formatRate(data.average), best: formatRate(data.best), get note(){return appLabel('insights.trend-bars.nowSoFarFinishedDaysOnly');} }, 'note')} slotStyle={styles.dashedNote} /></Text>
    </View>
  );
}

const createStyles = (Palette: AppPalette) => StyleSheet.create({
  container: {
    gap: 12,
  },
  segment: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    padding: 3,
    borderRadius: Radius.pill,
    backgroundColor: Palette.surfaceRaised,
  },
  segmentButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: Radius.pill,
  },
  segmentActive: {
    backgroundColor: Palette.accentSoft,
  },
  segmentText: {
    color: Palette.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  segmentTextActive: {
    color: Palette.text,
  },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  column: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  value: {
    color: Palette.textSecondary,
    fontSize: 10,
    fontWeight: '700',
    height: 14,
  },
  track: {
    width: '100%',
    height: BAR_HEIGHT,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  bar: {
    width: '70%',
    borderRadius: 6,
    backgroundColor: Palette.accent,
  },
  barCurrent: {
    backgroundColor: Palette.accentSoft,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Palette.accent,
  },
  gap: {
    width: '70%',
    height: 2,
    borderRadius: 1,
    backgroundColor: Palette.border,
  },
  axis: {
    color: Palette.textMuted,
    fontSize: 10,
    fontWeight: '600',
  },
  axisCurrent: {
    color: Palette.text,
  },
  summary: {
    color: Palette.textSecondary,
    fontSize: 12,
  },
  dashedNote: {
    color: Palette.textMuted,
  },
});
