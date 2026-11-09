import { SymbolView } from 'expo-symbols';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { ProfileAvatar } from '@/components/profile/profile-avatar';
import { Palette, Radius, Spacing } from '@/constants/theme';
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
  if (status === 'loading') {
    return (
      <View style={[styles.card, styles.center]}>
        <ActivityIndicator color={Palette.accent} accessibilityLabel="Loading profile" />
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
            <Text style={styles.name}>Couldn&apos;t load profile</Text>
            <Text style={styles.subtitle}>Your saved profile hasn&apos;t been changed.</Text>
          </View>
        </View>
        <Pressable
          onPress={onRetry}
          accessibilityRole="button"
          android_ripple={{ color: 'rgba(255,255,255,0.12)' }}
          style={({ pressed }) => [styles.retry, pressed && styles.pressed]}>
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  const name = profile.displayName;
  return (
    <Pressable
      onPress={onEdit}
      accessibilityRole="button"
      accessibilityLabel={name ? `Profile: ${name}. Edit name and avatar` : 'Add your name. Edit name and avatar'}
      android_ripple={{ color: 'rgba(255,255,255,0.06)' }}
      style={({ pressed }) => [styles.card, styles.row, pressed && styles.pressed]}>
      <ProfileAvatar avatar={profile.avatar} displayName={name} size={56} />
      <View style={styles.text}>
        <Text style={[styles.name, !name && styles.placeholder]} numberOfLines={2}>
          {name ?? 'Add your name'}
        </Text>
        <Text style={styles.subtitle}>Edit name and avatar</Text>
      </View>
      <SymbolView
        name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
        size={16}
        tintColor={Palette.textMuted}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 20,
    gap: Spacing.three,
    borderRadius: Radius.lg,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: 'rgba(139, 124, 246, 0.3)',
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
    color: Palette.background,
    fontSize: 15,
    fontWeight: '700',
  },
});
