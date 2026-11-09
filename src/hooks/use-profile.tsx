import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import {
  applyProfileInput,
  DEFAULT_PROFILE,
  dismissNamePromptIn,
  loadProfile,
  saveProfile,
  type Profile,
  type ProfileInput,
} from '@/data/profile-storage';
import { createValueStore } from '@/data/value-store';

export type ProfileStatus = 'loading' | 'ready' | 'load-error';

type ProfileContextValue = {
  /** `DEFAULT_PROFILE` while loading or after a load error — use it for display only. */
  profile: Profile;
  status: ProfileStatus;
  /** Retry loading after a failure. */
  reload: () => void;
  /** Each change resolves only after it is saved, and throws if saving fails or the profile isn't loaded. */
  updateProfile: (input: ProfileInput) => Promise<void>;
  dismissNamePrompt: () => Promise<void>;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

/**
 * The local profile (display name + avatar), under its own AsyncStorage key.
 * Same safety rules as the other providers (see `data/value-store.ts`):
 * - Nothing is written until the saved profile has loaded successfully. After a
 *   load error, every change is refused, so corrupt/newer data is never replaced.
 * - Changes are saved first; state updates only after the save succeeds.
 * - Writes run one at a time, each building on the last saved profile.
 * It never reads or writes habits, goals, routines or progress.
 */
export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const [status, setStatus] = useState<ProfileStatus>('loading');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [store] = useState(() =>
    createValueStore<Profile>({
      initial: DEFAULT_PROFILE,
      load: loadProfile,
      save: saveProfile,
      onChange: setProfile,
      notLoadedMessage: "Your profile hasn't loaded yet",
    }),
  );

  useEffect(() => {
    let cancelled = false;
    store
      .load()
      .then((loaded) => {
        if (cancelled) return;
        setProfile(loaded);
        setStatus('ready');
      })
      .catch((error) => {
        if (cancelled) return;
        console.warn('[momentum] Failed to load profile', error);
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

  const updateProfile = useCallback(
    (input: ProfileInput) =>
      store.commit((current) => ({ next: applyProfileInput(current, input, new Date()), result: undefined })),
    [store],
  );

  const dismissNamePrompt = useCallback(
    () => store.commit((current) => ({ next: dismissNamePromptIn(current, new Date()), result: undefined })),
    [store],
  );

  const value = useMemo(
    () => ({ profile, status, reload, updateProfile, dismissNamePrompt }),
    [profile, status, reload, updateProfile, dismissNamePrompt],
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile(): ProfileContextValue {
  const context = useContext(ProfileContext);
  if (!context) throw new Error('useProfile must be used inside <ProfileProvider>');
  return context;
}
