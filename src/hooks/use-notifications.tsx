import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { router, useRootNavigationState } from 'expo-router';
import type { NotificationResponse } from 'expo-notifications';
import { useHabits } from './use-habits';
import { useDailyProgress } from './use-daily-progress';
import { useDataBackup } from './use-data-backup';
import { usePreferences } from './use-preferences';
import { usePresentationLanguage } from './use-presentation-language';
import { persistence } from '@/data/persistence-coordinator';
import { loadDay } from '@/data/completion-storage';
import { toLocalDateKey } from '@/utils/date';
import { formNavigation } from '@/utils/form-navigation';
import { createNotificationEngine, NOTIFICATION_STATE_KEY, type DeviceState } from '@/notifications/engine';
import { nativeDriver, notificationModule } from '@/notifications/native';
import { notificationTarget, PREFIX } from '@/notifications/planner';
import type { NotificationSettings } from '@/notifications/model';

const engine = createNotificationEngine({ read: () => AsyncStorage.getItem(NOTIFICATION_STATE_KEY),
  write: raw => AsyncStorage.setItem(NOTIFICATION_STATE_KEY, raw), driver: nativeDriver });
type ContextValue = {
  state: DeviceState | null; permission: 'unknown' | 'allowed' | 'blocked' | 'unavailable'; error: boolean;
  retry: (ask?: boolean) => Promise<void>; save: (settings: NotificationSettings) => Promise<void>;
};
const Context = createContext<ContextValue | null>(null);
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const habits = useHabits(); const daily = useDailyProgress(); const backup = useDataBackup();
  const preferences = usePreferences(); const language = usePresentationLanguage();
  const [state, setState] = useState<DeviceState | null>(null);
  const [permission, setPermission] = useState<ContextValue['permission']>('unknown');
  const [error, setError] = useState(false);
  const [response, setResponse] = useState<NotificationResponse | null>(null);
  const [epoch] = useState(() => persistence.generation());
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const ready = !backup.busy && habits.status === 'ready' && daily.status === 'ready' && preferences.status === 'ready';
  const current = useRef({ ready, language });
  useLayoutEffect(() => { current.current = { ready, language }; }, [ready, language]);
  const retry = useCallback(async (ask = false) => {
    const saved = daily.persistence.snapshot(daily.dateKey);
    if (!current.current.ready || saved.pending || !persistence.available()) return;
    const snapshot = habits.savedSnapshot();
    const valid = () => alive.current && current.current.ready && current.current.language === language &&
      persistence.available() && persistence.generation() === epoch && toLocalDateKey(new Date()) === daily.dateKey &&
      habits.savedSnapshot().ready && habits.savedSnapshot().habits === snapshot.habits &&
      !daily.persistence.snapshot(daily.dateKey).pending && daily.persistence.snapshot(daily.dateKey).revision === saved.revision;
    try {
      await persistence.run(async () => {
        const loaded = await engine.load();
        if (!valid()) return;
        setState(loaded);
        const today = await loadDay(daily.dateKey);
        if (!valid()) return;
        const result = await engine.reconcile({ now: new Date(), habits: snapshot.habits, today, language },
          AppState.currentState === 'active', valid, ask);
        if (result && valid()) { setState(result.state); setPermission(result.allowed ? 'allowed' : 'blocked'); setError(false); }
      }, epoch);
    } catch {
      if (alive.current) { setError(true); if (permission === 'unknown') setPermission('unavailable'); }
    }
  }, [daily.dateKey, daily.persistence, habits, language, epoch, permission]);
  const retryRef = useRef(retry);
  useLayoutEffect(() => { retryRef.current = retry; }, [retry]);
  useEffect(() => { if (ready) void retryRef.current(); }, [ready, habits.habits, daily.dateKey, daily.drainRevision, language]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', () => { void retryRef.current(); });
    const timer = setInterval(() => { if (AppState.currentState === 'active') void retryRef.current(); }, 60000);
    return () => { sub.remove(); clearInterval(timer); };
  }, []);
  useEffect(() => {
    let stopped = false; let remove: (() => void) | undefined;
    void notificationModule().then(n => {
      if (stopped) return;
      n.setNotificationHandler({ handleNotification: async notification => {
        const owned = notification.request.content.data?.owner === PREFIX;
        const show = !owned || AppState.currentState !== 'active';
        return { shouldShowBanner: show, shouldShowList: show, shouldPlaySound: show, shouldSetBadge: false };
      } });
      const sub = n.addNotificationResponseReceivedListener(setResponse);
      remove = () => sub.remove();
      const last = n.getLastNotificationResponse();
      if (last) setResponse(last);
    }).catch(() => { if (!stopped) setPermission('unavailable'); });
    return () => { stopped = true; remove?.(); };
  }, []);
  const navigation = useRootNavigationState(); const handled = useRef<string | null>(null);
  useEffect(() => {
    if (!ready || !navigation?.key || !response) return;
    const request = response.notification.request;
    const key = request.identifier;
    if (handled.current === key) return;
    const target = notificationTarget(request.content.data, habits.habits);
    if (!target || !['open', 'expo.modules.notifications.actions.DEFAULT'].includes(response.actionIdentifier)) return;
    handled.current = key;
    void notificationModule().then(n => n.clearLastNotificationResponse()).catch(() => undefined);
    formNavigation.requestTab(() => {
      if (current.current.ready && persistence.available()) {
        router.push(notificationTarget(request.content.data, habits.savedSnapshot().habits) ?? '/(tabs)');
      }
    });
  }, [ready, navigation?.key, response, habits]);
  const save = async (settings: NotificationSettings) => {
    if (!current.current.ready || !alive.current) throw new Error('Notifications not ready');
    const next = await persistence.run(() => engine.saveSettings(settings), epoch);
    if (alive.current) { setState(next); setError(false); await retryRef.current(); }
  };
  return <Context.Provider value={{ state, permission, error, retry, save }}>{children}</Context.Provider>;
}
export function useNotifications() {
  const value = useContext(Context);
  if (!value) throw new Error('NotificationsProvider is missing');
  return value;
}
