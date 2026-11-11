"use no memo"; // Keep external locale reads live; explicit domain memos remain intact.
import {SymbolView, Text} from '@/components/localized-native';
import { appLabel } from '@/i18n/app-copy';
import type { AppPalette } from '@/constants/palettes';
import { useAppStyles } from '@/hooks/use-app-styles';

import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/habits/empty-state';
import { ProfileForm } from '@/components/profile/profile-form';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useProfile } from '@/hooks/use-profile';
import { closeProfileEditor } from '@/utils/navigation';

/**
 * Profile editor. A root-stack route (pushed over the tabs), so Back — header ✕,
 * Android hardware back or gesture — returns to whichever tab opened it.
 * The form is shown only once the saved profile has loaded: a profile that
 * failed to load can't be edited, so it can never be overwritten.
 */
export default function ProfileEditScreen() {
  const { palette: Palette, styles } = useAppStyles(createStyles);
  const { profile, status, reload, updateProfile } = useProfile();

  if (status === 'ready') {
    return <ProfileForm profile={profile} onSave={updateProfile} onClose={closeProfileEditor} />;
  }

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.flex}>
        <View style={styles.header}>
          <Pressable
            onPress={closeProfileEditor}
            accessibilityRole="button"
            accessibilityLabel={appLabel("profile.edit.close")}
            hitSlop={8}
            style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}>
            <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} size={20} tintColor={Palette.textSecondary} />
          </Pressable>
          <Text style={styles.headerTitle} accessibilityRole="header">
            {appLabel("profile.edit.profile")}</Text>
        </View>
        <View style={styles.body}>
          {status === 'loading' ? (
            <ActivityIndicator color={Palette.accent} accessibilityLabel={appLabel("profile.edit.loadingProfile")} />
          ) : (
            <EmptyState
              title={appLabel("profile.edit.couldnTLoadYourProfile")}
              description={appLabel("profile.edit.yourSavedProfileHasnTBeenChangedTryAgainOrRestartTheAppYourHabitsAndGoalsAreNotAffected")}
              icon={{ ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' }}
              actionLabel={appLabel("profile.edit.tryAgain")}
              onAction={reload}
            />
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const createStyles = (Palette: AppPalette) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  flex: {
    flex: 1,
  },
  header: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: 20,
    paddingVertical: Spacing.three,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.controlBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    color: Palette.text,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  pressed: {
    opacity: 0.8,
  },
  body: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: Spacing.four,
  },
});
