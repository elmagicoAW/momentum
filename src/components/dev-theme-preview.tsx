import { Pressable, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppTheme } from '@/hooks/use-app-theme';
import { useDataBackup } from '@/hooks/use-data-backup';
import { useThemePreview } from '@/hooks/use-theme-preview';

/** Internal preview only. No preference save, domain mutation, locale switch, or reload. */
export function DevThemePreviewControls() {
  if (!__DEV__) return null;
  return <PreviewControls />;
}

function PreviewControls() {
  const { palette, scheme } = useAppTheme();
  const { setPreview } = useThemePreview();
  const { busy } = useDataBackup();
  const next = scheme === 'dark' ? 'light' : 'dark';
  return (
    <SafeAreaView edges={['top']} style={{ backgroundColor: palette.surface }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Development preview: ${scheme}. Preview ${next} palette without saving`}
        accessibilityState={{ disabled: busy }}
        disabled={busy}
        onPress={() => setPreview(next)}
        android_ripple={{ color: palette.ripple }}
        style={styles.control}>
        <Text style={{ color: palette.textSecondary, fontSize: 12 }}>DEV · {scheme} preview · tap for {next} · not saved</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ control: { minHeight: 44, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 8 } });
