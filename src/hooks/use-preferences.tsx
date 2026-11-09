import { createContext, useContext, useEffect, useState, useSyncExternalStore, type PropsWithChildren } from 'react';

import { createPreferencesStore } from '@/data/preferences-store';

const PreferencesContext = createContext<ReturnType<typeof createPreferencesStore> | null>(null);

export function PreferencesProvider({ children }: PropsWithChildren) {
  const [store] = useState(() => createPreferencesStore());
  useEffect(() => {
    // No render gate, splash calls, domain leases or default writes. Recovery starts independently.
    void store.load().catch(() => undefined); // status/error retained for an explicit retry
  }, [store]);
  return <PreferencesContext.Provider value={store}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const store = useContext(PreferencesContext);
  if (!store) throw new Error('usePreferences requires PreferencesProvider');
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  return { ...snapshot, retryLoad: store.load, updatePreferences: store.update };
}
