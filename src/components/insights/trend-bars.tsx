import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatRate } from '@/components/insights/format';
import { Palette, Radius } from '@/constants/theme';
import { trend, type InsightsIndex } from '@/utils/insights';

type Kind = 'week' | 'month';

const BAR_HEIGHT = 120;

/** Consistency per week (last 8) or month (last 6), drawn with plain Views. */
export function TrendBars({ index }: { index: InsightsIndex }) {
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
              {k === 'week' ? 'Weekly' : 'Monthly'}
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
              accessibilityLabel={`${p.isCurrent ? `${p.label}, so far` : p.label}: ${
                pct === null ? 'nothing finished was scheduled' : `${pct} percent, ${p.done} of ${p.finished} check-ins`
              }`}>
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
                {p.isCurrent ? 'Now' : p.label}
              </Text>
            </View>
          );
        })}
      </View>

      <Text style={styles.summary}>
        Avg {formatRate(data.average)} · Best {formatRate(data.best)}
        {' · '}
        <Text style={styles.dashedNote}>“Now” = so far, finished days only</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
