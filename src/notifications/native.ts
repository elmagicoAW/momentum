import { Platform } from 'react-native';
import { notificationsEn } from '@/i18n/notifications-en';
import { notificationsAr } from '@/i18n/notifications-ar';
import { PREFIX } from './planner';
import { signature, type NotificationDriver } from './engine';

type Native = typeof import('expo-notifications');
let loaded: Native | undefined;
export async function notificationModule(): Promise<Native> {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') throw new Error('Notifications unavailable');
  // Older development builds must keep opening normally without this native module.
  if (!loaded) loaded = await import('expo-notifications');
  return loaded;
}
const CHANNEL = 'momentum_smart_v1';
export const nativeDriver: NotificationDriver = {
  async permission(ask, language) {
    const n = await notificationModule();
    const copy = language === 'ar' ? notificationsAr : notificationsEn;
    if (Platform.OS === 'android') await n.setNotificationChannelAsync(CHANNEL, {
      name: copy['notifications.channel'], importance: n.AndroidImportance.DEFAULT, showBadge: false,
      lockscreenVisibility: n.AndroidNotificationVisibility.PRIVATE,
    });
    await n.setNotificationCategoryAsync('momentum_habit', [{ identifier: 'open', buttonTitle: copy['notifications.openHabit'], options: { opensAppToForeground: true } }]);
    await n.setNotificationCategoryAsync('momentum_today', [{ identifier: 'open', buttonTitle: copy['notifications.openToday'], options: { opensAppToForeground: true } }]);
    let permission = await n.getPermissionsAsync();
    if (ask && !permission.granted && permission.canAskAgain) permission = await n.requestPermissionsAsync();
    const channel = Platform.OS === 'android' ? await n.getNotificationChannelAsync(CHANNEL) : null;
    return channel?.importance !== n.AndroidImportance.NONE && (permission.granted ||
      permission.ios?.status === n.IosAuthorizationStatus.PROVISIONAL || permission.ios?.status === n.IosAuthorizationStatus.EPHEMERAL);
  },
  async list() {
    return (await (await notificationModule()).getAllScheduledNotificationsAsync()).map(r => ({ id: r.identifier, signature: r.content.data?.signature }));
  },
  async cancel(id) { await (await notificationModule()).cancelScheduledNotificationAsync(id); },
  async schedule(p) {
    const n = await notificationModule();
    await n.scheduleNotificationAsync({ identifier: p.id,
      content: { title: p.title, body: p.body, sound: true, categoryIdentifier: p.habitId ? 'momentum_habit' : 'momentum_today',
        data: { owner: PREFIX, habitId: p.habitId ?? null, kind: p.kind, signature: signature(p) } },
      trigger: { type: n.SchedulableTriggerInputTypes.DATE, date: new Date(p.at), channelId: CHANNEL, delivery: 'bestEffort' },
    });
  },
};
