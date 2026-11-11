import type { Appearance } from '@/data/preferences-storage';
import { resolveAppearance } from '@/utils/presentation';

type Scheme = 'light' | 'dark';
type Subscription = { remove: () => void };
type AppearancePort = {
  getColorScheme: () => Scheme | null | undefined;
  setColorScheme?: (value: Scheme | 'auto') => void;
  addChangeListener: (listener: (event: { colorScheme: Scheme | null }) => void) => Subscription;
};
type AppStatePort = {
  addEventListener: (event: 'change', listener: (state: string) => void) => Subscription;
};

/** Mode drives native overrides; native events only drive resolution, never another override. */
export function startAppearanceSession(
  mode: Appearance, native: AppearancePort, appState: AppStatePort, publish: (scheme: Scheme) => void,
) {
  let alive = true;
  const update = () => {
    if (alive) publish(resolveAppearance(mode, native.getColorScheme()));
  };
  // Clear the previous fixed override BEFORE sampling System. RN 0.88 refreshes its cache here.
  native.setColorScheme?.(mode === 'system' ? 'auto' : mode);
  const appearance = native.addChangeListener(update);
  const state = appState.addEventListener('change', (next) => {
    if (next !== 'active' || !alive) return;
    // Re-sample native state on resume even if an appearance event was missed while suspended.
    native.setColorScheme?.(mode === 'system' ? 'auto' : mode);
    update();
  });
  update();
  return () => {
    alive = false;
    appearance.remove();
    state.remove();
  };
}

export function previewAppearance(preview: Appearance | null, development: boolean): Appearance {
  return development && preview ? preview : 'dark';
}
