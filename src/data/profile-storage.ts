import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  hasControlChars,
  isHexColor,
  isValidStoredName,
  normalizeName,
  type ProfileDraft,
} from '@/utils/profile-validation';

export type ProfileAvatar =
  /** Derived from `displayName`; a neutral symbol when there is no name. */
  | { kind: 'initials' }
  /** `icon`: `HABIT_ICONS` key (unknown keys render a fallback). `color`: `#RRGGBB`. */
  | { kind: 'icon'; icon: string; color: string };

/** First-run name card on Today. Shown only while 'pending' and there is no name. */
export type NamePrompt = 'pending' | 'dismissed' | 'completed';

export const NAME_PROMPT_VALUES: readonly NamePrompt[] = ['pending', 'dismissed', 'completed'];

export type Profile = {
  /** Normalized (see `normalizeName`), 1–30 code points. Omitted = no name. */
  displayName?: string;
  avatar: ProfileAvatar;
  namePrompt: NamePrompt;
  /** ISO timestamps. Present once the profile has been saved; absent on the in-memory default. */
  createdAt?: string;
  updatedAt?: string;
};

/** Everything the profile editor changes. */
export type ProfileInput = Pick<Profile, 'displayName' | 'avatar'>;

/** Used when nothing is saved yet. Never written on its own. */
export const DEFAULT_PROFILE: Profile = { avatar: { kind: 'initials' }, namePrompt: 'pending' };

/**
 * Storage layout: `momentum:profile:v1` → `{ version: 1, profile: Profile }`.
 * Habits, goals, routines and check-ins are never read or written here.
 */
export const PROFILE_KEY = 'momentum:profile:v1';
const STORE_VERSION = 1;

// ---------------------------------------------------------------------------
// Parsing — strict, so corrupt or newer data is reported instead of replaced.
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNamePrompt(value: unknown): value is NamePrompt {
  return typeof value === 'string' && (NAME_PROMPT_VALUES as readonly string[]).includes(value);
}

function parseAvatar(value: unknown): ProfileAvatar | null {
  if (!isRecord(value)) return null;
  if (value.kind === 'initials') return { kind: 'initials' };
  if (value.kind === 'icon') {
    const { icon, color } = value;
    if (typeof icon !== 'string' || icon.length === 0 || hasControlChars(icon)) return null;
    if (!isHexColor(color)) return null;
    // An icon key this version doesn't know is kept and rendered with the fallback icon.
    return { kind: 'icon', icon, color };
  }
  return null; // unknown (e.g. future) kind → invalid, never rewritten
}

function parseProfile(value: unknown): Profile | null {
  if (!isRecord(value)) return null;
  const { displayName, avatar, namePrompt, createdAt, updatedAt } = value;
  if (displayName !== undefined && !isValidStoredName(displayName)) return null;
  const parsedAvatar = parseAvatar(avatar);
  if (!parsedAvatar || !isNamePrompt(namePrompt)) return null;
  if (typeof createdAt !== 'string' || typeof updatedAt !== 'string') return null;
  return {
    ...(displayName !== undefined ? { displayName } : {}),
    avatar: parsedAvatar,
    namePrompt,
    createdAt,
    updatedAt,
  };
}

/** Parses a saved profile value. Throws on anything unexpected. Exported for tests. */
export function parseProfileStore(raw: string): Profile {
  const data: unknown = JSON.parse(raw);
  if (!isRecord(data) || !('profile' in data)) {
    throw new Error('Saved profile has an unexpected format');
  }
  if (data.version !== STORE_VERSION) {
    throw new Error(`Saved profile uses unsupported version ${String(data.version)}`);
  }
  const profile = parseProfile(data.profile);
  if (!profile) throw new Error('Saved profile is invalid');
  return profile;
}

// ---------------------------------------------------------------------------
// Pure changes (used by `useProfile`; return `current` itself when nothing changes)
// ---------------------------------------------------------------------------

/**
 * Applies an editor save. Saving a name completes the first-run prompt; saving
 * without a name still counts as an answer, so a pending prompt becomes
 * 'dismissed'. A completed/dismissed prompt never goes back to 'pending'.
 */
export function applyProfileInput(current: Profile, input: ProfileInput, now: Date): Profile {
  const displayName = input.displayName ? normalizeName(input.displayName) : '';
  const namePrompt: NamePrompt =
    displayName.length > 0 ? 'completed' : current.namePrompt === 'pending' ? 'dismissed' : current.namePrompt;
  const stamp = now.toISOString();
  return {
    ...(displayName ? { displayName } : {}),
    avatar: input.avatar.kind === 'icon' ? { ...input.avatar } : { kind: 'initials' },
    namePrompt,
    createdAt: current.createdAt ?? stamp,
    updatedAt: stamp,
  };
}

/** "Not now" on the first-run card. Only a pending prompt changes. */
export function dismissNamePromptIn(current: Profile, now: Date): Profile {
  if (current.namePrompt !== 'pending') return current;
  const stamp = now.toISOString();
  return { ...current, namePrompt: 'dismissed', createdAt: current.createdAt ?? stamp, updatedAt: stamp };
}

/** Whether Today should show the first-run name card. */
export function shouldShowNamePrompt(profile: Profile): boolean {
  return profile.namePrompt === 'pending' && !profile.displayName;
}

/** Editor state for a saved profile. Icon fields keep the given defaults while Initials is chosen. */
export function profileToDraft(profile: Profile, defaults: { icon: string; color: string }): ProfileDraft {
  return {
    name: profile.displayName ?? '',
    avatarKind: profile.avatar.kind,
    icon: profile.avatar.kind === 'icon' ? profile.avatar.icon : defaults.icon,
    color: profile.avatar.kind === 'icon' ? profile.avatar.color : defaults.color,
  };
}

/** Editor state → input. Call only after validation passes. */
export function draftToProfileInput(draft: ProfileDraft): ProfileInput {
  const displayName = normalizeName(draft.name);
  return {
    ...(displayName ? { displayName } : {}),
    avatar: draft.avatarKind === 'icon' ? { kind: 'icon', icon: draft.icon, color: draft.color } : { kind: 'initials' },
  };
}

// ---------------------------------------------------------------------------
// Load / save
// ---------------------------------------------------------------------------

/**
 * Loads the profile. Nothing saved yet → `DEFAULT_PROFILE` (nothing is written).
 * Throws on any read/parse failure so the caller can block writes and show an
 * error — corrupt or newer data is never replaced by the default.
 */
export async function loadProfile(): Promise<Profile> {
  const raw = await AsyncStorage.getItem(PROFILE_KEY);
  if (raw == null) return { ...DEFAULT_PROFILE };
  return parseProfileStore(raw);
}

/** Writes the whole profile in one `setItem`, after checking it would load back. */
export async function saveProfile(profile: Profile): Promise<void> {
  const raw = JSON.stringify({ version: STORE_VERSION, profile });
  parseProfileStore(raw); // throws before writing anything unreadable
  await AsyncStorage.setItem(PROFILE_KEY, raw);
}
