import type { AppPalette } from '@/constants/palettes';
import { useAppStyles } from '@/hooks/use-app-styles';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import type { SaveState } from '@/hooks/use-daily-progress';

/** Saving status shown next to "N left". Never says "Saved" before the data is on disk. */
export function saveLabel(saveState: SaveState): string | null {
  if (saveState === 'saving') return 'Saving…';
  if (saveState === 'saved') return 'Saved';
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
  return (
    <>
      {loadError && (
        <Notice
          message="Couldn’t load today’s saved progress, so changes are paused. Your saved data is untouched."
          actionLabel="Try again"
          onAction={onReload}
        />
      )}
      {saveError && (
        <Notice
          message="Couldn’t save your latest changes. They’re kept here and will be retried automatically — keep the app open until it says Saved."
          actionLabel="Retry now"
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
