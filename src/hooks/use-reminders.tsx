import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState, Linking } from 'react-native';

import type { Habit } from '@/data/habit-storage';
import {
  defaultReminderSettings,
  loadReminderSettings,
  saveReminderSettings,
  withItemReminder,
  type ReminderKind,
  type ReminderSettings,
} from '@/data/reminder-storage';
import type { Routine } from '@/data/routine-storage';
import { createValueStore } from '@/data/value-store';
import { useDailyProgress } from '@/hooks/use-daily-progress';
import { useHabits } from '@/hooks/use-habits';
import { useRoutines } from '@/hooks/use-routines';
import type { PermissionReport } from '@/notifications/permission-check';
import { createSyncRunner, hasProblems, reconcile, type ReconcileResult } from '@/notifications/reconcile';
import {
  currentTimeZoneSignature,
  expoScheduler,
  installForegroundHandler,
  notificationsSupported,
  ensureChannels,
  readPermission,
  requestPermission,
  runningInExpoGo,
  scheduleLimit,
  sendTestNotification,
  setForegroundContext,
} from '@/notifications/scheduler';
import { findOverlaps, planReminders, type ReminderOverlap } from '@/utils/reminder-plan';
import type { PermissionInfo } from '@/utils/reminder-presentation';
import type { ReminderTime } from '@/utils/reminder-time';

export type RemindersStatus = 'loading' | 'ready' | 'load-error';

export type SyncState = {
  /** idle: nothing ran yet · waiting: sources not ready · ok · problem (some failed; retrying). */
  phase: 'idle' | 'syncing' | 'waiting' | 'ok' | 'problem';
  result: ReconcileResult | null;
  /** Epoch ms of the last finished run. */
  at: number | null;
};

type RemindersContextValue = {
  /** False on web: no scheduling, controls are hidden. */
  supported: boolean;
  inExpoGo: boolean;
  settings: ReminderSettings;
  status: RemindersStatus;
  reload: () => void;
  permission: PermissionInfo;
  /**
   * Asks for permission if Android still allows the dialog, otherwise just
   * re-reads the status. Never called on launch — only from a user action.
   */
  askPermission: () => Promise<PermissionInfo>;
  recheckPermission: () => Promise<PermissionInfo>;
  /** Last raw check (development diagnostics only). */
  permissionReport: PermissionReport | null;
  /** Each change resolves only after it's saved, and throws if saving fails. */
  setMasterEnabled: (enabled: boolean) => Promise<void>;
  setItemReminder: (kind: ReminderKind, id: string, value: { enabled: boolean; time: ReminderTime }) => Promise<void>;
  overlaps: ReminderOverlap[];
  sync: SyncState;
  retrySync: () => void;
  sendTest: () => Promise<void>;
  openSystemSettings: () => void;
};

/** Everything a sync needs, captured at request time. */
type SyncInput = {
  habits: Habit[];
  routines: Routine[];
  settings: ReminderSettings;
  sourcesReady: boolean;
  permission: PermissionInfo;
};

const RemindersContext = createContext<RemindersContextValue | null>(null);

const SYNC_DEBOUNCE_MS = 400;
const FOREGROUND_SYNC_THROTTLE_MS = 30_000;

if (notificationsSupported) installForegroundHandler();

const samePermission = (a: PermissionInfo, b: PermissionInfo) =>
  a.state === b.state && a.error === b.error && a.channelsOff.join(',') === b.channelsOff.join(',');

/**
 * Reminder settings + the derived OS schedule.
 *
 * - Settings live under their own key (`reminder-storage.ts`), save-first and
 *   serialized like every other store. Habits, routines, goals and check-ins
 *   are never written from here.
 * - The OS schedule is rebuilt by `reconcile()` from habits + routines +
 *   settings whenever any of them change, when permission changes, and when
 *   the app returns to the foreground. It's skipped (not wiped) while any
 *   source is loading or failed to load.
 * - Permission is only requested from a user action (`askPermission`).
 */
export function RemindersProvider({ children }: { children: ReactNode }) {
  const { habits, status: habitsStatus } = useHabits();
  const { routines, status: routinesStatus } = useRoutines();
  const daily = useDailyProgress();

  const [settings, setSettings] = useState<ReminderSettings>(defaultReminderSettings);
  const [status, setStatus] = useState<RemindersStatus>('loading');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [permission, setPermission] = useState<PermissionInfo>({
    state: notificationsSupported ? 'checking' : 'unsupported',
    channelsOff: [],
  });
  const [sync, setSync] = useState<SyncState>({ phase: 'idle', result: null, at: null });
  const [permissionReport, setPermissionReport] = useState<PermissionReport | null>(null);

  const [store] = useState(() =>
    createValueStore<ReminderSettings>({
      initial: defaultReminderSettings(),
      load: loadReminderSettings,
      save: saveReminderSettings,
      onChange: setSettings,
      notLoadedMessage: "Reminder settings haven't loaded yet",
    }),
  );

  // --- Load settings --------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    store
      .load()
      .then((loaded) => {
        if (cancelled) return;
        setSettings(loaded);
        setStatus('ready');
      })
      .catch((error) => {
        if (cancelled) return;
        console.warn('[momentum] Failed to load reminder settings', error);
        setStatus('load-error');
      });
    return () => {
      cancelled = true;
    };
  }, [store, loadAttempt]);

  const reload = useCallback(() => {
    setStatus('loading');
    setLoadAttempt((n) => n + 1);
  }, []);

  const sourcesReady = habitsStatus === 'ready' && routinesStatus === 'ready' && status === 'ready';

  // --- Sync runner (keeps its own latest input; follow-ups never use stale data)
  const [runner] = useState(() =>
    createSyncRunner<SyncInput>({
      run: async (input) => {
        if (!input) return { status: 'skipped', reason: 'sources-not-ready' };
        if (input.sourcesReady && input.permission.state !== 'checking') {
          setSync((s) => ({ ...s, phase: 'syncing' }));
        }
        const plan = planReminders({
          habits: input.habits,
          routines: input.routines,
          settings: input.settings,
          limit: scheduleLimit,
          zone: currentTimeZoneSignature(),
        });
        return reconcile(expoScheduler, {
          sourcesReady: input.sourcesReady,
          permission: input.permission.state,
          plan,
        });
      },
      onResult: (result) => {
        if (hasProblems(result)) console.warn('[momentum] Reminder sync had problems; will retry', result);
        setSync({
          phase: result.status === 'skipped' ? 'waiting' : hasProblems(result) ? 'problem' : 'ok',
          result,
          at: Date.now(),
        });
      },
    }),
  );
  useEffect(() => () => runner.dispose(), [runner]);

  const lastSyncRequest = useRef(0);

  // Any change to the sources or permission → one debounced sync with the new input.
  useEffect(() => {
    if (!notificationsSupported) return;
    const input: SyncInput = { habits, routines, settings, sourcesReady, permission };
    const timer = setTimeout(() => {
      lastSyncRequest.current = Date.now();
      void runner.request(input);
    }, SYNC_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [habits, routines, settings, sourcesReady, permission, runner]);

  // --- Permission: read on mount and whenever the app returns -----------------
  // `readPermission` / `requestPermission` never reject: failures come back as state 'error'.
  const applyPermission = useCallback((report: PermissionReport) => {
    const next = report.info;
    setPermission((prev) => (samePermission(prev, next) ? prev : next));
    setPermissionReport(report);
    return next;
  }, []);

  useEffect(() => {
    if (!notificationsSupported) return;
    const read = () => readPermission().then(applyPermission);
    // Create the channels quietly first (no prompt for apps targeting Android 13+),
    // so the channel status is real from the start. A failure is reported by the check.
    void ensureChannels()
      .catch((error) => console.warn('[momentum] Could not create notification channels', error))
      .finally(read);
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      void read(); // a change re-runs the sync effect above
      // Also re-check the OS schedule (a cheap no-op when nothing changed). This
      // picks up time-zone/offset changes, which change every reminder's signature.
      if (Date.now() - lastSyncRequest.current > FOREGROUND_SYNC_THROTTLE_MS) {
        lastSyncRequest.current = Date.now();
        void runner.request();
      }
    });
    return () => sub.remove();
  }, [applyPermission, runner]);

  /**
   * Creates channels, re-reads the status and shows the system dialog only if
   * Android can still show it. Already allowed → returns allowed (no dialog).
   * Blocked → returns blocked (the UI offers Open settings). A failure → 'error'.
   */
  const askPermission = useCallback(
    async (): Promise<PermissionInfo> => applyPermission(await requestPermission()),
    [applyPermission],
  );

  /** Re-reads the status (e.g. after an 'error', or from a "Check again" button). */
  const recheckPermission = useCallback(
    async (): Promise<PermissionInfo> => applyPermission(await readPermission()),
    [applyPermission],
  );

  // --- Foreground presentation: keep the handler's view of today current -----
  useEffect(() => {
    if (!notificationsSupported) return;
    setForegroundContext({
      habitsById: new Map(habits.map((h) => [h.id, h])),
      routinesById: new Map(routines.map((r) => [r.id, r])),
      todayRecord: daily.status === 'ready' ? daily.record : null,
    });
  }, [habits, routines, daily.status, daily.record]);
  useEffect(() => () => setForegroundContext(null), []);

  // --- Mutations (save-first) -------------------------------------------------
  // Orphan entries are pruned only when the full habit AND routine lists are known.
  const knownIds = useMemo(
    () =>
      habitsStatus === 'ready' && routinesStatus === 'ready'
        ? { habitIds: new Set(habits.map((h) => h.id)), routineIds: new Set(routines.map((r) => r.id)) }
        : undefined,
    [habits, routines, habitsStatus, routinesStatus],
  );

  const setMasterEnabled = useCallback(
    (enabled: boolean) =>
      store.commit((s) => ({ next: s.enabled === enabled ? s : { ...s, enabled }, result: undefined })),
    [store],
  );

  const setItemReminder = useCallback(
    (kind: ReminderKind, id: string, value: { enabled: boolean; time: ReminderTime }) =>
      store.commit((s) => ({ next: withItemReminder(s, kind, id, value, new Date(), knownIds), result: undefined })),
    [store, knownIds],
  );

  const retrySync = useCallback(() => {
    void readPermission()
      .then(applyPermission)
      .finally(() => {
        lastSyncRequest.current = Date.now();
        void runner.request();
      });
  }, [applyPermission, runner]);

  const sendTest = useCallback(() => sendTestNotification(), []);

  const openSystemSettings = useCallback(() => {
    void Linking.openSettings().catch((error) => console.warn('[momentum] Could not open settings', error));
  }, []);

  const overlaps = useMemo(
    () => (status === 'ready' ? findOverlaps(habits, routines, settings) : []),
    [habits, routines, settings, status],
  );

  const value = useMemo<RemindersContextValue>(
    () => ({
      supported: notificationsSupported,
      inExpoGo: runningInExpoGo,
      settings,
      status,
      reload,
      permission,
      askPermission,
      recheckPermission,
      permissionReport,
      setMasterEnabled,
      setItemReminder,
      overlaps,
      sync,
      retrySync,
      sendTest,
      openSystemSettings,
    }),
    [
      settings,
      status,
      reload,
      permission,
      askPermission,
      recheckPermission,
      permissionReport,
      setMasterEnabled,
      setItemReminder,
      overlaps,
      sync,
      retrySync,
      sendTest,
      openSystemSettings,
    ],
  );

  return <RemindersContext.Provider value={value}>{children}</RemindersContext.Provider>;
}

export function useReminders(): RemindersContextValue {
  const context = useContext(RemindersContext);
  if (!context) throw new Error('useReminders must be used inside <RemindersProvider>');
  return context;
}
