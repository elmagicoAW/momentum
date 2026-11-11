import { useEffect } from 'react';
import { Platform } from 'react-native';
/** Expo DevMenu owns the native floating gear; leave shake/menu access and app state intact. */
export function DevQaTools() {
  useEffect(() => {
    if (!__DEV__ || Platform.OS !== 'android') return;
    void import('expo').then(async ({requireOptionalNativeModule}) => {
      // Native debug binaries can differ from node_modules: missing capability must not break startup.
      const menu = requireOptionalNativeModule<{setToolsButtonVisible?: (visible: boolean) => Promise<void>}>('ExpoDevMenu');
      if (menu?.setToolsButtonVisible) await menu.setToolsButtonVisible(false);
    }).catch(() => { console.warn('[momentum] DevMenu tools-button visibility is unavailable in this binary.'); });
  }, []);
  return null;
}
