import Constants from 'expo-constants';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProfileSummaryCard } from '@/components/settings/profile-summary-card';
import { SettingsRow } from '@/components/settings/settings-row';
import { SettingsSection } from '@/components/settings/settings-section';
import { BottomTabInset, MaxContentWidth, Palette, Spacing } from '@/constants/theme';
import { useGoals } from '@/hooks/use-goals';
import { useHabits } from '@/hooks/use-habits';
import { useProfile } from '@/hooks/use-profile';
import { useRoutines } from '@/hooks/use-routines';
import { openProfileEditor } from '@/utils/navigation';

type Status = 'loading' | 'ready' | 'load-error';

/** e.g. "4 habits", "1 routine"; "…" while loading; "—" if that list couldn't load. */
function countLabel(status: Status, count: number, singular: string, plural: string) {
  if (status === 'loading') return '…';
  if (status === 'load-error') return '—';
  return `${count} ${count === 1 ? singular : plural}`;
}

const APP_VERSION = Constants.expoConfig?.version;

/**
 * Settings hub. Only rows that do something today are tappable (the profile);
 * every other row shows a true, read-only value or is marked "Coming later".
 * Habits, routines and reminders are managed in their own tabs, not here.
 */
export default function SettingsScreen() {
  const { profile, status: profileStatus, reload: reloadProfile } = useProfile();
  const { habits, status: habitsStatus } = useHabits();
  const { goals, status: goalsStatus } = useGoals();
  const { routines, status: routinesStatus } = useRoutines();

  const dataSummary = [
    countLabel(habitsStatus, habits.length, 'habit', 'habits'),
    countLabel(goalsStatus, goals.length, 'goal', 'goals'),
    countLabel(routinesStatus, routines.length, 'routine', 'routines'),
  ].join(' · ');

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.title} accessibilityRole="header">
            Settings
          </Text>

          <ProfileSummaryCard
            profile={profile}
            status={profileStatus}
            onEdit={openProfileEditor}
            onRetry={reloadProfile}
          />

          <SettingsSection title="Appearance" footer="Momentum is designed for dark mode.">
            <SettingsRow
              variant="info"
              icon={{ ios: 'moon.fill', android: 'dark_mode', web: 'dark_mode' }}
              label="Theme"
              value="Dark"
            />
          </SettingsSection>

          <SettingsSection title="Language">
            <SettingsRow
              variant="info"
              icon={{ ios: 'globe', android: 'language', web: 'language' }}
              tint={Palette.accentBlue}
              label="App language"
              value="English"
            />
            <SettingsRow
              variant="soon"
              icon={{ ios: 'character.bubble', android: 'translate', web: 'translate' }}
              label="More languages"
            />
          </SettingsSection>

          <SettingsSection title="Data & Backup">
            <SettingsRow
              variant="info"
              icon={{ ios: 'iphone', android: 'smartphone', web: 'smartphone' }}
              tint={Palette.accentBlue}
              label="Storage"
              value="This device"
            />
            <SettingsRow
              variant="info"
              icon={{ ios: 'square.stack.3d.up.fill', android: 'inventory_2', web: 'inventory_2' }}
              tint={Palette.accentBlue}
              label="Your data"
              value={dataSummary}
            />
            <SettingsRow
              variant="soon"
              icon={{ ios: 'square.and.arrow.up', android: 'ios_share', web: 'ios_share' }}
              label="Export & backup"
            />
          </SettingsSection>

          <SettingsSection title="Privacy">
            <SettingsRow
              variant="text"
              icon={{ ios: 'lock.fill', android: 'lock', web: 'lock' }}
              tint={Palette.success}
              label="Stored locally"
              text="Your habits, goals, routines, check-ins and profile are stored locally on this device. Momentum has no account and no in-app cloud sync."
            />
            <SettingsRow
              variant="text"
              icon={{ ios: 'info.circle.fill', android: 'info', web: 'info' }}
              tint={Palette.textSecondary}
              label="Device backups"
              text="Whether app data is included in your phone's own backups depends on your device and its settings."
            />
          </SettingsSection>

          <SettingsSection title="About">
            <SettingsRow
              variant="info"
              icon={{ ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' }}
              label="Momentum"
              value="Personal growth"
            />
            {APP_VERSION ? (
              <SettingsRow
                variant="info"
                icon={{ ios: 'number', android: 'tag', web: 'tag' }}
                label="Version"
                value={APP_VERSION}
              />
            ) : null}
          </SettingsSection>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
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
  title: {
    color: Palette.text,
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.6,
  },
});
