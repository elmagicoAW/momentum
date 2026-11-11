import { useEffect, useLayoutEffect, useMemo, useRef, useSyncExternalStore, type ComponentRef } from 'react';
import { AccessibilityInfo, ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { AppPalette } from '@/constants/palettes';
import type { Appearance } from '@/data/preferences-storage';
import { useAppStyles } from '@/hooks/use-app-styles';
import { useDataBackup } from '@/hooks/use-data-backup';
import { useLanguage } from '@/hooks/use-language';
import { usePreferences } from '@/hooks/use-preferences';
import { preferenceErrorMessage } from '@/i18n/types';
import { createAppearanceEditor } from '@/utils/appearance-editor';
import { SettingsRow } from './settings-row';

const choices: readonly { value: Appearance; label: string; detail: string }[] = [
  { value: 'light', label: 'Light', detail: 'Always use a light appearance.' },
  { value: 'dark', label: 'Dark', detail: 'Always use a dark appearance.' },
  { value: 'system', label: 'System', detail: 'Follow your device’s Light or Dark setting.' },
];
const labelFor = (mode: Appearance) => choices.find((option) => option.value === mode)!.label;

export function AppearanceSelector() {
  const { palette: Palette, styles } = useAppStyles(createStyles);
  const { busy } = useDataBackup();
  const { preferences, status, saving, error, retryLoad, updatePreferences, getPreferencesSnapshot } = usePreferences();
  const { t } = useLanguage();
  const editor = useMemo(() => createAppearanceEditor({
    getPreferences: getPreferencesSnapshot,
    save: (appearance) => updatePreferences({ appearance }),
  }), [getPreferencesSnapshot, updatePreferences]);
  useLayoutEffect(() => { editor.setBackupBusy(busy); }, [editor, busy]);
  const dialog = useSyncExternalStore(editor.subscribe, editor.getSnapshot, editor.getSnapshot);
  const trigger = useRef<ComponentRef<typeof View>>(null);
  const heading = useRef<ComponentRef<typeof Text>>(null);
  const wasOpen = useRef(false);
  const restoreFocus = () => {
    trigger.current?.focus();
    if (trigger.current) AccessibilityInfo.sendAccessibilityEvent?.(trigger.current, 'focus');
  };
  useEffect(() => {
    const closed = wasOpen.current && !dialog.open;
    wasOpen.current = dialog.open;
    if (closed) {
      // Android has no Modal onDismiss callback; wait for its native window to close.
      const timer = setTimeout(restoreFocus, 200);
      return () => clearTimeout(timer);
    }
  }, [dialog.open]);
  const disabled = busy || saving || status !== 'ready';
  const controlsDisabled = disabled || dialog.saving;
  const errorText = status === 'load-error'
    ? t(preferenceErrorMessage(error ?? 'read-failed').key)
    : dialog.failed ? t('preferences.write-failed') : null;
  return (
    <>
      <SettingsRow variant="link" label="Theme" value={status === 'loading' ? 'Loading…' : labelFor(preferences.appearance)}
        icon={{ ios: 'moon.fill', android: 'dark_mode', web: 'dark_mode' }}
        ref={trigger} disabled={disabled} onPress={editor.open} />
      {status === 'loading' && <ActivityIndicator color={Palette.accent} accessibilityLabel="Loading appearance preferences" />}
      {status === 'load-error' && (
        <View style={styles.notice}>
          <Text style={styles.error} accessibilityRole="alert">{errorText}</Text>
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy }} disabled={busy}
            onPress={() => { void retryLoad().catch(() => undefined); }} style={styles.button}>
            <Text style={styles.action}>Retry loading preferences</Text>
          </Pressable>
        </View>
      )}
      {busy && <Text style={styles.noticeText} accessibilityLiveRegion="polite">Appearance changes are unavailable while Data &amp; Backup is busy.</Text>}
      <Modal visible={dialog.open} transparent animationType="none" onRequestClose={editor.cancel}
        onDismiss={restoreFocus} onShow={() => {
          heading.current?.focus();
          if (heading.current) AccessibilityInfo.sendAccessibilityEvent?.(heading.current, 'focus');
        }}>
        <SafeAreaView style={styles.backdrop}>
          <View style={styles.dialog} accessibilityViewIsModal onAccessibilityEscape={editor.cancel}>
            <ScrollView contentContainerStyle={styles.content}>
              <Text ref={heading} accessible style={styles.title} accessibilityRole="header">Appearance</Text>
              <Text style={styles.secondary}>Saved choice: {labelFor(preferences.appearance)}</Text>
              <View accessibilityRole="radiogroup" accessibilityLabel="Appearance choices">
                {choices.map((option) => (
                  <Pressable key={option.value} accessibilityRole="radio"
                    accessibilityLabel={`${option.label}. ${option.detail}`}
                    accessibilityState={{ checked: dialog.choice === option.value, disabled: controlsDisabled }}
                    disabled={controlsDisabled} onPress={() => editor.choose(option.value)}
                    android_ripple={{ color: Palette.ripple }}
                    style={[styles.option, dialog.choice === option.value && styles.selected]}>
                    <Text style={styles.optionTitle}>{dialog.choice === option.value ? '●' : '○'}  {option.label}</Text>
                    <Text style={styles.secondary}>{option.detail}{preferences.appearance === option.value ? ' Saved.' : ''}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.secondary}>Saved on this device. Appearance is not included in backups.</Text>
              {busy && <Text style={styles.secondary} accessibilityLiveRegion="polite">Wait for Data &amp; Backup to finish before saving.</Text>}
              {dialog.failed && <Text style={styles.error} accessibilityRole="alert">{errorText}</Text>}
              {dialog.saving && <Text style={styles.secondary} accessibilityLiveRegion="polite">Saving appearance…</Text>}
              <View style={styles.actions}>
                <Pressable accessibilityRole="button" accessibilityState={{ disabled: dialog.saving }}
                  disabled={dialog.saving} onPress={editor.cancel} style={styles.button}>
                  <Text style={styles.action}>Cancel</Text>
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityState={{ disabled: controlsDisabled, busy: dialog.saving }}
                  disabled={controlsDisabled} onPress={() => { void editor.save(); }}
                  style={[styles.button, styles.save, controlsDisabled && styles.disabled]}>
                  <Text style={styles.saveText}>{dialog.saving ? 'Saving…' : dialog.failed ? 'Retry save' : 'Save'}</Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const createStyles = (Palette: AppPalette) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: Palette.background, justifyContent: 'center', padding: 16 },
  dialog: { maxHeight: '100%', width: '100%', maxWidth: 480, alignSelf: 'center', borderRadius: 24,
    backgroundColor: Palette.surface, borderWidth: 1, borderColor: Palette.controlBorder, overflow: 'hidden' },
  content: { padding: 20, gap: 16 },
  title: { color: Palette.text, fontSize: 24, fontWeight: '700' },
  option: { minHeight: 64, padding: 14, gap: 6, marginVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: Palette.controlBorder },
  selected: { backgroundColor: Palette.accentSoft, borderColor: Palette.accent },
  optionTitle: { color: Palette.text, fontSize: 17, fontWeight: '600' },
  secondary: { color: Palette.textSecondary, fontSize: 14, lineHeight: 21 },
  notice: { padding: 16, gap: 8 },
  noticeText: { padding: 16, color: Palette.textSecondary, fontSize: 14, lineHeight: 21 },
  error: { color: Palette.danger, fontSize: 15, lineHeight: 22 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 12 },
  button: { minHeight: 48, minWidth: 88, padding: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  action: { color: Palette.accent, fontSize: 16, fontWeight: '600' },
  save: { backgroundColor: Palette.accent },
  saveText: { color: Palette.onAccent, fontSize: 16, fontWeight: '600' },
  disabled: { opacity: 0.5 },
});
