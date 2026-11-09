import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AchievementCard } from '@/components/achievements/achievement-card';
import { AchievementDataNotes } from '@/components/achievements/achievement-data-notes';
import { AchievementCelebration } from '@/components/achievements/achievements-summary-card';
import { MaxContentWidth, Palette, Radius } from '@/constants/theme';
import { ACHIEVEMENTS } from '@/data/achievement-definitions';
import { useAchievements } from '@/hooks/use-achievements';
import { closeAchievements } from '@/utils/navigation';

const FILTERS = ['All', 'Earned', 'Locked'] as const;
export default function AchievementsScreen() {
  const { collection, storeReady, status, evaluation } = useAchievements();
  const [filter, setFilter] = useState<typeof FILTERS[number]>('All');
  const { width, fontScale } = useWindowDimensions();
  const wide = width >= 380 && fontScale <= 1.15;
  const earned = ACHIEVEMENTS.filter((badge) => collection.awards[badge.id]).length;
  const visible = ACHIEVEMENTS.filter((badge) => filter === 'All' || (filter === 'Earned' ? !!collection.awards[badge.id] : !collection.awards[badge.id]));
  const progress = status === 'ready' || status === 'save-error' ? evaluation : null;
  return <View style={styles.screen}>
    <SafeAreaView style={styles.flex} edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back from achievements" onPress={closeAchievements} style={styles.back}>
          <SymbolView name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} size={20} tintColor={Palette.text} /><Text style={styles.backText}>Back</Text>
        </Pressable>
      </View>
      <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>SMALL STEPS. LASTING MOMENTUM.</Text>
          <Text style={styles.title} accessibilityRole="header">Achievements</Text>
          <Text style={styles.total}>{storeReady ? `${earned}` : '—'}<Text style={styles.totalSuffix}> / {ACHIEVEMENTS.length} earned</Text></Text>
          <Text style={styles.subtitle}>A collection built from the effort you saved.</Text>
          <Text style={styles.subtitle}>Finished days count. Today&apos;s progress is provisional.</Text>
        </View>
        <AchievementCelebration />
        <AchievementDataNotes />
        {status === 'loading' && <ActivityIndicator color={Palette.accent} accessibilityLabel="Checking saved achievements" />}
        {storeReady && <>
          <View style={styles.filters}>{FILTERS.map((item) => <Pressable key={item} onPress={() => setFilter(item)} accessibilityRole="button" accessibilityState={{ selected: filter === item }} style={[styles.filter, filter === item && styles.selected]}><Text style={[styles.filterText, filter === item && { color: Palette.text }]}>{item}</Text></Pressable>)}</View>
          {status === 'ready' && evaluation?.metrics.checkins === 0 && earned === 0 && <Text style={styles.subtitle}>Your first finished check-in starts your collection. Partial progress today is a great start, too.</Text>}
          {visible.length === 0 && <Text style={styles.subtitle}>{filter === 'Earned' ? 'No confirmed badges yet. Your next finished check-in brings you closer.' : 'All 12 badges earned. Your effort is here to stay.'}</Text>}
          {[...new Set(visible.map((badge) => badge.group))].map((group) => <View key={group} style={styles.group}>
            <Text style={styles.groupTitle} accessibilityRole="header">{group}</Text>
            <View style={styles.grid}>{visible.filter((badge) => badge.group === group).map((badge) => <AchievementCard key={badge.id} badge={badge} award={collection.awards[badge.id]} evaluation={progress} wide={wide} />)}</View>
          </View>)}
        </>}
      </ScrollView>
    </SafeAreaView>
  </View>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Palette.background }, flex: { flex: 1 },
  header: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', paddingHorizontal: 20, paddingVertical: 4, backgroundColor: Palette.background, borderBottomWidth: 1, borderBottomColor: Palette.border },
  content: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 22, paddingBottom: 32, gap: 22 },
  back: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', paddingRight: 16 },
  backText: { color: Palette.text, fontSize: 15 },
  hero: { paddingVertical: 22, paddingHorizontal: 20, borderRadius: Radius.lg, backgroundColor: '#171329', borderWidth: 1, borderColor: '#37305B', gap: 12 },
  eyebrow: { color: '#A9BFFB', fontSize: 10, letterSpacing: 1.5, fontWeight: '700' },
  title: { color: Palette.text, fontSize: 32, fontWeight: '700', letterSpacing: -0.8 },
  total: { color: '#B9AAFF', fontSize: 46, fontWeight: '700' },
  totalSuffix: { color: Palette.textSecondary, fontSize: 16, fontWeight: '500' },
  subtitle: { color: Palette.textSecondary, fontSize: 14, lineHeight: 21 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  filter: { minHeight: 48, paddingHorizontal: 20, justifyContent: 'center', borderRadius: Radius.pill, borderWidth: 1, borderColor: Palette.border, backgroundColor: Palette.surface },
  selected: { backgroundColor: Palette.accentSoft, borderColor: Palette.accent },
  filterText: { color: Palette.textSecondary, fontSize: 14, fontWeight: '600' },
  group: { gap: 14 }, groupTitle: { color: Palette.text, fontSize: 19, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 },
});
