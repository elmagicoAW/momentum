import { DEFAULT_NOTIFICATION_SETTINGS, validSettings, type NotificationSettings } from './model';
import { planNotifications, PREFIX, type Issued, type PlanInput, type Planned } from './planner';

export const NOTIFICATION_STATE_KEY = 'momentum:notification-device:v1';
export type DeviceState = { version: 1; settings: NotificationSettings; lastActive: number; issued: Issued };
export function parseDeviceState(raw: string | null, now: number): DeviceState {
  if (raw === null) return { version: 1, settings: { ...DEFAULT_NOTIFICATION_SETTINGS }, lastActive: now, issued: {} };
  const v = JSON.parse(raw) as DeviceState;
  if (!v || v.version !== 1 || !validSettings(v.settings) || !Number.isFinite(v.lastActive) || v.lastActive < 0 ||
    !v.issued || typeof v.issued !== 'object' || Array.isArray(v.issued) || Object.entries(v.issued).some(([id, e]) =>
      !id.startsWith(PREFIX) || !e || !Number.isFinite(e.at) || typeof e.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(e.date))) throw new Error('Invalid notification device preferences');
  return v;
}
export const signature = (p: Planned) => JSON.stringify(p);
export type NotificationDriver = {
  permission: (ask: boolean, language: 'en' | 'ar') => Promise<boolean>;
  list: () => Promise<{ id: string; signature: unknown }[]>;
  cancel: (id: string) => Promise<void>;
  schedule: (p: Planned) => Promise<void>;
};
type Dependencies = { read: () => Promise<string | null>; write: (raw: string) => Promise<void>; driver: NotificationDriver; now?: () => number };
/** One queue for config, activity, ledger and native reconciliation. Failed writes never publish state. */
export function createNotificationEngine({ read, write, driver, now = Date.now }: Dependencies) {
  let queue: Promise<unknown> = Promise.resolve();
  const serial = <T,>(run: () => Promise<T>): Promise<T> => {
    const result = queue.then(run); queue = result.catch(() => undefined); return result;
  };
  return {
    load: () => serial(async () => parseDeviceState(await read(), now())),
    saveSettings: (settings: NotificationSettings) => {
      const snapshot = { ...settings };
      return serial(async () => {
      if (!validSettings(snapshot)) throw new Error('Invalid notification settings');
      const state = parseDeviceState(await read(), now());
      const next = { ...state, settings: snapshot };
      await write(JSON.stringify(next)); return next;
      });
    },
    reconcile: (input: Omit<PlanInput, 'settings' | 'lastActive' | 'issued'>, active: boolean, valid: () => boolean, ask = false) => serial(async () => {
      if (!valid()) return null;
      const state = parseDeviceState(await read(), now());
      const allowed = await driver.permission(ask, input.language);
      if (!valid()) return null;
      // Permission dialogs and native calls can take minutes. Never plan from
      // a timestamp captured before a dialog, or replay an alarm that expired.
      const evaluationTime = new Date(now());
      if (active) state.lastActive = evaluationTime.getTime();
      const desired = allowed ? planNotifications({ ...input, now: evaluationTime, settings: state.settings, lastActive: state.lastActive, issued: state.issued }) : [];
      const wanted = new Map(desired.map(p => [p.id, p]));
      const pending = await driver.list();
      // Preflight storage, retaining OLD reservations until cancellation is confirmed.
      // If cancellation fails, its old alarm may still deliver at the old time.
      if (!valid()) return null;
      await write(JSON.stringify(state));
      for (const p of pending) {
        if (!valid()) return null;
        if (p.id.startsWith(PREFIX) && (!wanted.has(p.id) || p.signature !== signature(wanted.get(p.id)!))) await driver.cancel(p.id);
      }
      // Persist the new reservations AFTER confirmed cancellations and BEFORE
      // native scheduling. A crash may miss a reminder, but cannot replay one.
      const issued: Issued = {};
      const cutoff = evaluationTime.getTime() - 8 * 86400000;
      for (const [id, value] of Object.entries(state.issued)) if (value.at <= evaluationTime.getTime() &&
        (value.at >= cutoff || id === `${PREFIX}inactivity.${state.lastActive}`)) issued[id] = value;
      for (const p of desired) issued[p.id] = { at: p.at, date: p.date };
      const next = { ...state, issued };
      if (!valid()) return null;
      await write(JSON.stringify(next));
      for (const p of desired) {
        if (!valid()) return null;
        if (p.at > now() && !pending.some(old => old.id === p.id && old.signature === signature(p))) await driver.schedule(p);
      }
      return { state: next, allowed };
    }),
  };
}
