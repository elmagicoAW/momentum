"use no memo"; // Keep external locale reads live; explicit domain memos remain intact.
import {SymbolView, Text} from '@/components/localized-native';
import { appLabel, appMessage } from '@/i18n/app-copy';
import type { AppPalette } from '@/constants/palettes';
import { useAppStyles } from '@/hooks/use-app-styles';

import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ProfileAvatar } from '@/components/profile/profile-avatar';
import { Radius, Spacing } from '@/constants/theme';
import type { Profile } from '@/data/profile-storage';
import type { ProfileStatus } from '@/hooks/use-profile';

type Props = {
  profile: Profile;
  status: ProfileStatus;
  onEdit: () => void;
  onRetry: () => void;
};

/** Hero card at the top of Settings. Loading and load errors stay inside the card. */
export function ProfileSummaryCard({ profile, status, onEdit, onRetry }: Props) {
  const { palette: Palette, styles } = useAppStyles(createStyles);
  if (status === 'loading') {
    return (
      <View style={[styles.card, styles.center]}>
        <ActivityIndicator color={Palette.accent} accessibilityLabel={appLabel("settings.profile-summary-card.loadingProfile")} />
      </View>
    );
  }

  if (status === 'load-error') {
    return (
      <View style={styles.card} accessibilityRole="alert">
        <View style={styles.row}>
          <View style={styles.errorIcon}>
            <SymbolView
              name={{ ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' }}
              size={22}
              tintColor={Palette.danger}
            />
          </View>
          <View style={styles.text}>
            <Text style={styles.name}>{appLabel("settings.profile-summary-card.couldnTLoadProfile")}</Text>
            <Text style={styles.subtitle}>{appLabel("settings.profile-summary-card.yourSavedProfileHasnTBeenChanged")}</Text>
          </View>
        </View>
        <Pressable
          onPress={onRetry}
          accessibilityRole="button"
          android_ripple={{ color: Palette.rippleStrong }}
          style={({ pressed }) => [styles.retry, pressed && styles.pressed]}>
          <Text style={styles.retryText}>{appLabel("settings.profile-summary-card.tryAgain")}</Text>
        </Pressable>
      </View>
    );
  }

  const name = profile.displayName;
  return (
    <Pressable
      onPress={onEdit}
      accessibilityRole="button"
      accessibilityLabel={name ? appMessage("profile.summary.accessibility", { name: (name) }) : appLabel("settings.profile-summary-card.addYourNameEditNameAndAvatar")}
      android_ripple={{ color: Palette.ripple }}
      style={({ pressed }) => [styles.card, styles.row, pressed && styles.pressed]}>
      <ProfileAvatar avatar={profile.avatar} displayName={name} size={56} />
      <View style={styles.text}>
        <Text style={[styles.name, !name && styles.placeholder]} numberOfLines={2}>
          {name ?? appLabel("settings.profile-summary-card.addYourName")}
        </Text>
        <Text style={styles.subtitle}>{appLabel("settings.profile-summary-card.editNameAndAvatar")}</Text>
      </View>
      <SymbolView
        name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
        size={16}
        tintColor={Palette.textMuted}
      />
    </Pressable>
  );
}

const createStyles = (Palette: AppPalette) => StyleSheet.create({
  card: {
    padding: 20,
    gap: Spacing.three,
    borderRadius: Radius.lg,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.accentBorderSubtle,
    overflow: 'hidden',
  },
  center: {
    minHeight: 96,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  pressed: {
    opacity: 0.85,
  },
  text: {
    flex: 1,
    gap: 4,
  },
  name: {
    color: Palette.text,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  placeholder: {
    color: Palette.accent,
  },
  subtitle: {
    color: Palette.textSecondary,
    fontSize: 14,
  },
  errorIcon: {
    width: 56,
    height: 56,
    borderRadius: Radius.pill,
    backgroundColor: Palette.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retry: {
    alignSelf: 'flex-start',
    minHeight: 44,
    paddingHorizontal: Spacing.four,
    borderRadius: Radius.pill,
    backgroundColor: Palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  retryText: {
    color: Palette.onAccent,
    fontSize: 15,
    fontWeight: '700',
  },
});
