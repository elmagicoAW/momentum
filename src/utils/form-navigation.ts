/** Runtime-only draft/operation guard. No domain or persisted state. The first
 * navigation request owns confirmation; later taps never replay another exit. */
export function createFormNavigation(options: {
  confirm: () => Promise<boolean>;
  disable: () => void;
  changed: () => void;
}) {
  let dirty = false;
  let busy = false;
  let asking = false;
  let leaving = false;
  let alive = true;
  const guard = {
    protected: () => alive && !leaving && (dirty || busy),
    active: () => alive && !leaving,
    setDirty(value: boolean) { if (dirty !== value) { dirty = value; options.changed(); } },
    begin() {
      if (!alive || leaving || busy || asking) return false;
      busy = true; options.changed(); return true;
    },
    failed() { busy = false; options.changed(); },
    finish(action: () => void) {
      if (!alive || leaving) return;
      leaving = true; busy = false; options.changed(); options.disable(); action();
    },
    async request(action: () => void) {
      if (!alive || leaving || busy || asking) return;
      asking = true;
      try {
        const approved = !dirty || await options.confirm();
        if (approved && alive && !busy && !leaving) guard.finish(action);
      } catch {
        // A dismissed/unavailable confirmation is never permission to leave.
      } finally { asking = false; }
    },
    dispose() { alive = false; options.changed(); },
    mount() { alive = true; leaving = false; options.changed(); },
  };
  return guard;
}

type Guard = ReturnType<typeof createFormNavigation>;
let focused: { guard: Guard; leaveTab: (action: () => void) => void } | null = null;
const listeners = new Set<() => void>();
export const formNavigation = {
  subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  notify() { listeners.forEach(listener => listener()); },
  protected: () => focused?.guard.protected() ?? false,
  register(guard: Guard, leaveTab: (action: () => void) => void) {
    const entry = { guard, leaveTab }; focused = entry; this.notify();
    return () => { if (focused === entry) { focused = null; this.notify(); } };
  },
  requestTab(action: () => void) { if (focused) focused.leaveTab(action); else action(); },
};
