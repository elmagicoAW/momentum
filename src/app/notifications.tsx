"use no memo";
import { useState } from 'react';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/components/localized-native';
import { Toggle, NumericField, NotificationButton, NotificationCopy } from '@/components/notifications/controls';
import { PermissionNotice } from '@/components/notifications/permission-notice';
import { useNotifications } from '@/hooks/use-notifications';
import { useFormNavigation } from '@/hooks/use-form-navigation';
import { useAppStyles } from '@/hooks/use-app-styles';
import { useDataBackup } from '@/hooks/use-data-backup';
import { appLabel } from '@/i18n/app-copy';
import { validSettings, type NotificationSettings } from '@/notifications/model';
import { MaxContentWidth } from '@/constants/theme';
import type { AppPalette } from '@/constants/palettes';

const close = () => { if (router.canGoBack()) router.back(); else router.replace('/(tabs)/settings'); };
export default function NotificationsScreen() {
  const { state } = useNotifications();
  const { styles } = useAppStyles(createStyles);
  return <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.heading} accessibilityRole="header">{appLabel('notifications.title')}</Text>
      {state ? <PreferencesForm initial={state.settings} /> : <>
        <PermissionNotice /><NotificationButton label={appLabel('habits.habit-form.cancel')} onPress={close} />
      </>}
    </ScrollView>
  </SafeAreaView>;
}
function PreferencesForm({ initial }: { initial: NotificationSettings }) {
  const { save } = useNotifications(); const { busy } = useDataBackup();
  const [original] = useState(() => ({ ...initial, dailyCap: String(initial.dailyCap), inactiveDays: String(initial.inactiveDays) }));
  const [draft, setDraft] = useState(original);
  const [working, setWorking] = useState(false);
  const [invalid, setInvalid] = useState(false); const [failed, setFailed] = useState(false);
  const guard = useFormNavigation(JSON.stringify(draft) !== JSON.stringify(original), close);
  const locked = busy || working;
  const submit = async () => {
    if (locked) return;
    const settings = { ...draft, dailyCap: Number(draft.dailyCap), inactiveDays: Number(draft.inactiveDays) };
    if (!validSettings(settings)) { setInvalid(true); return; }
    if (!guard.begin()) return;
    setWorking(true); setFailed(false); setInvalid(false);
    try { await save(settings); if (guard.active()) guard.finish(); }
    catch { if (guard.active()) { guard.failed(); setFailed(true); setWorking(false); } }
  };
  return <View style={{ gap: 16 }}>
    <PermissionNotice disabled={locked} />
    <Toggle label={appLabel('notifications.unfinished')} value={draft.unfinished} disabled={locked} onChange={unfinished => setDraft(d => ({ ...d, unfinished }))} />
    <Toggle label={appLabel('notifications.inactivity')} value={draft.inactivity} disabled={locked} onChange={inactivity => setDraft(d => ({ ...d, inactivity }))} />
    <NumericField label={appLabel('notifications.motivationTime')} value={draft.time} time disabled={locked} onChange={time => setDraft(d => ({ ...d, time }))} />
    <NumericField label={appLabel('notifications.quietStart')} value={draft.quietStart} time disabled={locked} onChange={quietStart => setDraft(d => ({ ...d, quietStart }))} />
    <NumericField label={appLabel('notifications.quietEnd')} value={draft.quietEnd} time disabled={locked} onChange={quietEnd => setDraft(d => ({ ...d, quietEnd }))} />
    <NumericField label={appLabel('notifications.cap')} value={draft.dailyCap} disabled={locked} onChange={dailyCap => setDraft(d => ({ ...d, dailyCap }))} />
    <NumericField label={appLabel('notifications.inactiveDays')} value={draft.inactiveDays} disabled={locked} onChange={inactiveDays => setDraft(d => ({ ...d, inactiveDays }))} />
    {invalid && <NotificationCopy id="notifications.invalid" error />}
    {failed && <NotificationCopy id="notifications.error" error />}
    <NotificationCopy id="notifications.localOnly" /><NotificationCopy id="notifications.limits" />
    <NotificationButton label={appLabel('notifications.save')} disabled={locked} onPress={() => { void submit(); }} />
    <NotificationButton label={appLabel('habits.habit-form.cancel')} disabled={locked} onPress={() => guard.request()} />
  </View>;
}
function createStyles(p: AppPalette) { return StyleSheet.create({
  screen: { flex: 1, backgroundColor: p.background },
  content: { padding: 20, gap: 20, paddingBottom: 60, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  heading: { color: p.text, fontSize: 28, lineHeight: 36, fontWeight: '700' },
}); }
