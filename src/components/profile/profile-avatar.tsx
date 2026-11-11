import {SymbolView, Text} from '@/components/localized-native';
import { readableAccent } from '@/utils/theme-color';
import type { AppPalette } from '@/constants/palettes';
import { useAppStyles } from '@/hooks/use-app-styles';

import { StyleSheet, View } from 'react-native';

import { Radius } from '@/constants/theme';
import { habitIconSymbol } from '@/data/habit-options';
import type { ProfileAvatar as Avatar } from '@/data/profile-storage';
import { initialsFor } from '@/utils/profile-validation';

type Props = {
  avatar: Avatar;
  displayName?: string;
  size?: 48 | 56 | 72;
};

const PERSON_SYMBOL = { ios: 'person.fill', android: 'person', web: 'person' } as const;

/**
 * The user's avatar: initials, a chosen icon, or a neutral person symbol when
 * Initials is chosen but there is no name. Decorative — the parent provides the
 * accessibility label. Shared by Today, Settings and the editor so they always match.
 */
export function ProfileAvatar({ avatar, displayName, size = 48 }: Props) {
  const { palette: Palette, styles } = useAppStyles(createStyles);
  const box = { width: size, height: size };

  if (avatar.kind === 'icon') {
    return (
      <View
        style={[styles.base, box, { backgroundColor: `${avatar.color}22`, borderColor: `${avatar.color}66` }]}
        accessible={false}
        importantForAccessibility="no-hide-descendants">
        <SymbolView name={habitIconSymbol(avatar.icon)} size={size * 0.46} tintColor={readableAccent(avatar.color, Palette)} />
      </View>
    );
  }

  const initials = initialsFor(displayName);
  return (
    <View style={[styles.base, styles.accent, box]} accessible={false} importantForAccessibility="no-hide-descendants">
      {initials ? (
        <Text
          style={[styles.initials, { fontSize: size * (initials.length > 1 ? 0.36 : 0.4) }]}
          numberOfLines={1}
          maxFontSizeMultiplier={1.2}>
          {initials}
        </Text>
      ) : (
        <SymbolView name={PERSON_SYMBOL} size={size * 0.46} tintColor={Palette.accent} />
      )}
    </View>
  );
}

const createStyles = (Palette: AppPalette) => StyleSheet.create({
  base: {
    borderRadius: Radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  accent: {
    backgroundColor: Palette.accentSoft,
    borderColor: Palette.accentBorderStrong,
  },
  initials: {
    color: Palette.accent,
    fontWeight: '700',
  },
});
