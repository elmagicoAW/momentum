import { useCallback, useLayoutEffect, useState, useSyncExternalStore } from 'react';
import { useFocusEffect, usePreventRemove } from 'expo-router';
import { appLabel } from '@/i18n/app-copy';
import { confirmDestructive } from '@/utils/confirm';
import { createFormNavigation, formNavigation } from '@/utils/form-navigation';

/** Removal guards cover Back/gestures. Native tab switching retains screens, so
 * it also needs the focused guard registry consumed by the tab host. */
export function useFormNavigation(dirty: boolean, onClose: () => void) {
  const [leaving, setLeaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [guard] = useState(() => createFormNavigation({
    confirm: () => confirmDestructive({
      title: appLabel('forms.discardTitle'), message: appLabel('forms.discardMessage'), confirmLabel: appLabel('forms.discard'),
    }),
    disable: () => { setLeaving(true); },
    changed: () => formNavigation.notify(),
  }));
  const disable = usePreventRemove(!leaving && (dirty || busy), ({ repeat }) => { void guard.request(repeat); });
  useLayoutEffect(() => { guard.mount(); return () => guard.dispose(); }, [guard]);
  useLayoutEffect(() => { guard.setDirty(dirty); }, [dirty, guard]);
  useFocusEffect(useCallback(() => formNavigation.register(guard, action => {
    void guard.request(() => { disable(); onClose(); action(); });
  }), [guard, disable, onClose]));
  return {
    request: (action = onClose) => { void guard.request(() => { disable(); action(); }); },
    begin: () => { if (!guard.begin()) return false; setBusy(true); return true; },
    failed: () => { if (guard.active()) { guard.failed(); setBusy(false); } },
    finish: (action = onClose) => guard.finish(() => { disable(); action(); }),
    active: guard.active,
  };
}

export function useFormTabProtection() {
  return useSyncExternalStore(formNavigation.subscribe, formNavigation.protected, () => false);
}
