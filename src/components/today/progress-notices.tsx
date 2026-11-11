import {Text} from '@/components/localized-native';
import type { AppPalette } from '@/constants/palettes';
import { useAppStyles } from '@/hooks/use-app-styles';
import { Pressable, StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import type { SaveState } from '@/hooks/use-daily-progress';
import type { Language } from '@/data/preferences-storage';
import { translate } from '@/i18n/translate';
import { useLanguage } from '@/hooks/use-language';

/** Saving status shown next to "N left". Never says "Saved" before the data is on disk. */
export function saveLabel(saveState: SaveState, language: Language = 'en'): string | null {
  if (saveState === 'saving') return translate(language, 'common.saving');
  if (saveState === 'saved') return translate(language, 'today.saved');
  return null;
}

type Props = {
  /** Today's saved progress couldn't be loaded, so taps are paused. */
  loadError: boolean;
  /** The latest progress save failed; it is kept and retried automatically. */
  saveError: boolean;
  onReload: () => void;
  onRetry: () => void;
};

/** Daily-progress load/save problems. Shared by Today and the routine screen so both say the same thing. */
export function ProgressNotices({ loadError, saveError, onReload, onRetry }: Props) {
  const { t } = useLanguage();
  return (
    <>
      {loadError && (
        <Notice
          message={t('today.loadProgress')}
          actionLabel={t('today.retry')}
          onAction={onReload}
        />
      )}
      {saveError && (
        <Notice
          message={t('today.saveProgress')}
          actionLabel={t('today.retryNow')}
          onAction={onRetry}
        />
      )}
    </>
  );
}

export function Notice({
  message,
  actionLabel,
  onAction,
}: {
  message: string;
  actionLabel: string;
  onAction: () => void;
}) {
  const { styles } = useAppStyles(createStyles);
  return (
    <View style={styles.notice} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <Text style={styles.noticeText}>{message}</Text>
      <Pressable
        onPress={onAction}
        accessibilityRole="button"
        hitSlop={8}
        style={({ pressed }) => [styles.noticeButton, pressed && styles.noticePressed]}>
        <Text style={styles.noticeButtonText}>{actionLabel}</Text>
      </Pressable>
    </View>
  );
}

const createStyles = (Palette: AppPalette) => StyleSheet.create({
  notice: {
    marginTop: -Spacing.two,
    gap: 10,
    padding: 14,
    borderRadius: Radius.md,
    backgroundColor: Palette.dangerSoft,
    borderWidth: 1,
    borderColor: Palette.dangerBorder,
  },
  noticeText: {
    color: Palette.text,
    fontSize: 13,
    lineHeight: 18,
  },
  noticeButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    backgroundColor: Palette.surfaceRaised,
    borderWidth: 1,
    borderColor: Palette.controlBorder,
  },
  noticePressed: {
    opacity: 0.75,
  },
  noticeButtonText: {
    color: Palette.text,
    fontSize: 13,
    fontWeight: '700',
  },
});
