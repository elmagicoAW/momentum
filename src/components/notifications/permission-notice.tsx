"use no memo";
import { useState } from 'react';
import { Linking, View } from 'react-native';
import { useNotifications } from '@/hooks/use-notifications';
import { appLabel } from '@/i18n/app-copy';
import { NotificationButton, NotificationCopy } from './controls';
export function PermissionNotice({ disabled = false }: { disabled?: boolean }) {
  const { permission, error, retry } = useNotifications();
  const [working, setWorking] = useState(false);
  const [failed, setFailed] = useState(false);
  const run = async (action: () => Promise<unknown>) => {
    if (working || disabled) return;
    setWorking(true); setFailed(false);
    try { await action(); } catch { setFailed(true); } finally { setWorking(false); }
  };
  return <View style={{ gap: 10 }}>
    <NotificationCopy id={permission === 'allowed' ? 'notifications.allowed' : permission === 'unavailable' ? 'notifications.unavailable' : 'notifications.blocked'} />
    {(error || failed) && <NotificationCopy id="notifications.error" error />}
    <NotificationButton label={appLabel(permission === 'allowed' ? 'notifications.retry' : 'notifications.permission')} disabled={working || disabled}
      onPress={() => { void run(() => retry(true)); }} />
    {permission === 'blocked' && <NotificationButton label={appLabel('notifications.openSettings')} disabled={working || disabled}
      onPress={() => { void run(() => Linking.openSettings()); }} />}
  </View>;
}
