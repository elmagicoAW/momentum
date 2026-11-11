import { appLabel, appMessage } from '@/i18n/app-copy';
/**
 * Pure helpers for the display name and avatar. Used both by the editor and by
 * `profile-storage.ts`, so the app can never save a name it would refuse to load.
 */

export const PROFILE_NAME_MAX_LENGTH = 30;

export type AvatarKind = 'initials' | 'icon';

/** Raw editor state, before normalizing. */
export type ProfileDraft = {
  name: string;
  avatarKind: AvatarKind;
  icon: string;
  color: string;
};

export type ProfileDraftErrors = Partial<Record<'name' | 'avatar', string>>;

/** Length in code points, so an emoji counts as one character (not two UTF-16 units). */
export function nameLength(value: string): number {
  return Array.from(value).length;
}

function isControlChar(char: string): boolean {
  const code = char.codePointAt(0) ?? 0;
  return code <= 0x1f || (code >= 0x7f && code <= 0x9f);
}

export function hasControlChars(value: string): boolean {
  return Array.from(value).some(isControlChar);
}

/** Drops control characters, collapses whitespace runs to one space, trims. '' = no name. */
export function normalizeName(raw: string): string {
  return Array.from(raw)
    .map((char) => (isControlChar(char) ? ' ' : char))
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

/** A stored name must already be normalized and 1–30 code points long. */
export function isValidStoredName(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  if (value.length === 0 || value !== normalizeName(value)) return false;
  return nameLength(value) <= PROFILE_NAME_MAX_LENGTH;
}

export function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9A-Fa-f]{6}$/.test(value);
}

/**
 * Up to two initials: first character of the first and of the last word.
 * `Array.from` keeps emoji and other astral characters whole. Returns null when
 * there is no name, so callers show a neutral avatar instead.
 */
export function initialsFor(name: string | undefined): string | null {
  const words = normalizeName(name ?? '').split(' ').filter(Boolean);
  if (words.length === 0) return null;
  const first = Array.from(words[0])[0];
  const last = words.length > 1 ? Array.from(words[words.length - 1])[0] : '';
  return `${first}${last}`.toLocaleUpperCase();
}

export function validateProfileDraft(draft: ProfileDraft): ProfileDraftErrors {
  const errors: ProfileDraftErrors = {};
  if (nameLength(normalizeName(draft.name)) > PROFILE_NAME_MAX_LENGTH) {
    errors.name = appMessage("validation.profile.nameLength", { limit: (PROFILE_NAME_MAX_LENGTH) });
  }
  if (draft.avatarKind === 'icon' && (draft.icon.length === 0 || !isHexColor(draft.color))) {
    errors.avatar = appLabel("profile-validation.pickAnIconAndAColor");
  }
  return errors;
}

export function hasProfileErrors(errors: ProfileDraftErrors): boolean {
  return Object.keys(errors).length > 0;
}

/** True when two drafts would save the same profile (whitespace-only edits don't count). */
export function sameProfileDraft(a: ProfileDraft, b: ProfileDraft): boolean {
  if (normalizeName(a.name) !== normalizeName(b.name)) return false;
  if (a.avatarKind !== b.avatarKind) return false;
  if (a.avatarKind === 'icon') return a.icon === b.icon && a.color === b.color;
  return true;
}
