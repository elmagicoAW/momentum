"use no memo"; // Keep external locale reads live; explicit domain memos remain intact.
import { useArabicComposition } from '@/hooks/use-arabic-composition';
import {Text} from '@/components/localized-native';
import { LanguageSelector } from '@/components/settings/language-selector';
import { appLabel, appMessage } from '@/i18n/app-copy';
import type { AppPalette } from '@/constants/palettes';
import { useAppStyles } from '@/hooks/use-app-styles';
import { useDataBackup } from '@/hooks/use-data-backup';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProfileSummaryCard } from '@/components/settings/profile-summary-card';
import { AchievementsSummaryCard } from '@/components/achievements/achievements-summary-card';
import { SettingsRow } from '@/components/settings/settings-row';
import { SettingsSection } from '@/components/settings/settings-section';
import { AppearanceSelector } from '@/components/settings/appearance-selector';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useGoals } from '@/hooks/use-goals';
import { useHabits } from '@/hooks/use-habits';
import { useProfile } from '@/hooks/use-profile';
import { useRoutines } from '@/hooks/use-routines';
import { openProfileEditor } from '@/utils/navigation';

type Status = 'loading' | 'ready' | 'load-error';

/** e.g. "4 habits", "1 routine"; "…" while loading; "—" if that list couldn't load. */
function countLabel(status: Status, count: number, kind: 'habits' | 'goals' | 'routines') {
  if (status === 'loading') return '…';
  if (status === 'load-error') return '—';
  return appMessage(`${kind}.count`, {count});
}

const APP_VERSION = Constants.expoConfig?.version;

/**
 * Settings hub. Only rows that do something today are tappable (the profile);
 * every other row shows a true, read-only value or is marked "Coming later".
 * Habits, routines and reminders are managed in their own tabs, not here.
 */
export default function SettingsScreen() {
  const arabic = useArabicComposition();
  const { palette: Palette, styles } = useAppStyles(createStyles);
  const { result } = useDataBackup();
  const { profile, status: profileStatus, reload: reloadProfile } = useProfile();
  const { habits, status: habitsStatus } = useHabits();
  const { goals, status: goalsStatus } = useGoals();
  const { routines, status: routinesStatus } = useRoutines();

  const dataSummary = [
    countLabel(habitsStatus, habits.length, 'habits'),
    countLabel(goalsStatus, goals.length, 'goals'),
    countLabel(routinesStatus, routines.length, 'routines'),
  ].join(' · ');

  return (
    <View style={[styles.screen,arabic.active && arabic.surface]}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.title} accessibilityRole="header">
            {appLabel("settings.settings")}</Text>

          {!!result && <Text style={{ color: Palette.text, fontSize: 16, lineHeight: 24 }} accessibilityLiveRegion="polite">{result}</Text>}

          <ProfileSummaryCard
            profile={profile}
            status={profileStatus}
            onEdit={openProfileEditor}
            onRetry={reloadProfile}
          />

          <AchievementsSummaryCard />

          <SettingsSection title={appLabel("settings.appearance")} footer={appLabel("settings.chooseLightDarkOrFollowYourDeviceWithSystem")}>
            <AppearanceSelector />
          </SettingsSection>

          <SettingsSection title={appLabel("settings.language")}><LanguageSelector /></SettingsSection>

          <SettingsSection title={appLabel("settings.dataBackup")}>
            <SettingsRow
              variant="info"
              icon={{ ios: 'iphone', android: 'smartphone', web: 'smartphone' }}
              tint={Palette.accentBlue}
              label={appLabel("settings.storage")}
              value={appLabel("settings.thisDevice")}
            />
            <SettingsRow
              variant="info"
              icon={{ ios: 'square.stack.3d.up.fill', android: 'inventory_2', web: 'inventory_2' }}
              tint={Palette.accentBlue}
              label={appLabel("settings.yourData")}
              value={dataSummary}
            />
            <SettingsRow
              variant="link"
              onPress={() => router.push('/data-backup')}
              icon={{ ios: 'square.and.arrow.up', android: 'ios_share', web: 'ios_share' }}
              label={appLabel("settings.exportBackup")}
            />
            <SettingsRow variant="link" icon={{ ios: 'square.and.arrow.down', android: 'file_download', web: 'file_download' }} label={appLabel("settings.importBackup")} onPress={() => router.push('/data-backup')} />
          </SettingsSection>

          <SettingsSection title={appLabel("settings.privacy")}>
            <SettingsRow
              variant="text"
              icon={{ ios: 'lock.fill', android: 'lock', web: 'lock' }}
              tint={Palette.success}
              label={appLabel("settings.storedLocally")}
              text={appLabel("settings.yourHabitsGoalsRoutinesCheckInsProfileAndAchievementsAreStoredLocallyOnThisDeviceMomentumHasNoAccountAndNoInAppCloudSync")}
            />
            <SettingsRow
              variant="text"
              icon={{ ios: 'info.circle.fill', android: 'info', web: 'info' }}
              tint={Palette.textSecondary}
              label={appLabel("settings.deviceBackups")}
              text={appLabel("settings.whetherAppDataIsIncludedInYourPhoneSOwnBackupsDependsOnYourDeviceAndItsSettings")}
            />
          </SettingsSection>

          <SettingsSection title={appLabel("settings.about")}>
            <SettingsRow
              variant="info"
              icon={{ ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' }}
              label={appLabel("settings.momentum")}
              value={appLabel("settings.personalGrowth")}
            />
            {APP_VERSION ? (
              <SettingsRow
                variant="info"
                icon={{ ios: 'number', android: 'tag', web: 'tag' }}
                label={appLabel("settings.version")}
                value={APP_VERSION}
              />
            ) : null}
          </SettingsSection>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const createStyles = (Palette: AppPalette) => StyleSheet.create({
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
