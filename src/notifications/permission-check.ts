/**
 * Permission checking with injected native calls — PURE, so the mapping,
 * error handling and channel inspection are tested in Node.
 *
 * - An API failure becomes state 'error' (unknown) — never "not allowed".
 * - Channels are created BEFORE any request (Android 13+ shows no dialog
 *   until a channel exists).
 * - The dialog is only requested when Android can still show it.
 */
import type { ReminderChannelId } from '@/utils/reminder-plan';
import {
  canDeliver,
  canRequestPermission,
  toPermissionState,
  type PermissionInfo,
  type RawPermission,
} from '@/utils/reminder-presentation';

/** expo-notifications `AndroidImportance.NONE` (Expo's channel enum, not Android's raw 0). */
export const EXPO_CHANNEL_IMPORTANCE_NONE = 2;

export type ChannelReport = { id: ReminderChannelId; importance: number | null; error?: string };

/** Everything known after a check — the info drives the UI, the rest is diagnostics. */
export type PermissionReport = {
  info: PermissionInfo;
  raw: RawPermission | null;
  channels: ChannelReport[];
  /** Whether the system dialog was requested in this call. */
  requested: boolean;
};

export type PermissionDeps = {
  platform: string;
  supported: boolean;
  channelIds: readonly ReminderChannelId[];
  getRaw: () => Promise<RawPermission>;
  requestRaw: () => Promise<RawPermission>;
  ensureChannels: () => Promise<void>;
  /** Expo channel importance (enum), or null when the channel doesn't exist. */
  getChannelImportance: (id: ReminderChannelId) => Promise<number | null>;
};

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

async function inspectChannels(deps: PermissionDeps): Promise<ChannelReport[]> {
  if (deps.platform !== 'android') return [];
  const reports: ChannelReport[] = [];
  for (const id of deps.channelIds) {
    try {
      reports.push({ id, importance: await deps.getChannelImportance(id) });
    } catch (error) {
      reports.push({ id, importance: null, error: messageOf(error) });
    }
  }
  return reports;
}

async function toReport(deps: PermissionDeps, raw: RawPermission, requested: boolean): Promise<PermissionReport> {
  const state = toPermissionState(raw, deps.platform);
  const channels = await inspectChannels(deps);
  const channelsOff = canDeliver(state)
    ? channels.filter((c) => c.importance === EXPO_CHANNEL_IMPORTANCE_NONE).map((c) => c.id)
    : [];
  return { info: { state, channelsOff }, raw, channels, requested };
}

function errorReport(error: unknown, requested: boolean): PermissionReport {
  return { info: { state: 'error', channelsOff: [], error: messageOf(error) }, raw: null, channels: [], requested };
}

const UNSUPPORTED: PermissionReport = {
  info: { state: 'unsupported', channelsOff: [] },
  raw: null,
  channels: [],
  requested: false,
};

/** Reads the current status. No user-facing effect. */
export async function checkPermission(deps: PermissionDeps): Promise<PermissionReport> {
  if (!deps.supported) return UNSUPPORTED;
  let raw: RawPermission;
  try {
    raw = await deps.getRaw();
  } catch (error) {
    return errorReport(error, false);
  }
  return toReport(deps, raw, false);
}

/**
 * From a user action: creates channels, re-reads the status, and shows the
 * system dialog ONLY when Android can still show it. Already allowed or
 * blocked → returns the fresh status without requesting.
 */
export async function askForPermission(deps: PermissionDeps): Promise<PermissionReport> {
  if (!deps.supported) return UNSUPPORTED;
  try {
    await deps.ensureChannels();
  } catch (error) {
    return errorReport(error, false);
  }
  const current = await checkPermission(deps);
  if (!canRequestPermission(current.info.state)) return current;
  let raw: RawPermission;
  try {
    raw = await deps.requestRaw();
  } catch (error) {
    return errorReport(error, true);
  }
  return toReport(deps, raw, true);
}
