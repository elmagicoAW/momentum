/**
 * Navigation decisions for routine screens, kept free of `expo-router` imports
 * so they can be tested with a fake router.
 *
 * Routine screens (`/routine/[id]`, `/routine/new`, `/routine/edit/[id]`) are
 * pushed on the ROOT stack, above the tabs. Popping them therefore always
 * reveals the tab that opened them, with its own stack untouched:
 *   Today › Today's plan → routine     Back → Today
 *   Habits › Routines → routine        Back → Routines list
 * Android hardware back pops the same native stack, so both back paths agree.
 */
export type RoutineRouter<H> = {
  canGoBack: () => boolean;
  back: () => void;
  canDismiss: () => boolean;
  dismissAll: () => void;
  replace: (href: H) => void;
};

/** Leaves a routine screen (back button, cancel, after saving). */
export function leaveRoutineScreen<H>(router: RoutineRouter<H>, fallback: H): 'back' | 'replace' {
  if (router.canGoBack()) {
    router.back();
    return 'back';
  }
  // Opened directly (deep link / restored state) with nothing underneath.
  router.replace(fallback);
  return 'replace';
}

/**
 * After deleting a routine from its editor: the editor AND the routine's detail
 * screen (if open) are both stale, so pop every routine screen at once and land
 * back on the tab that started the flow.
 */
export function leaveAfterRoutineDeleted<H>(router: RoutineRouter<H>, fallback: H): 'dismissAll' | 'replace' {
  if (router.canDismiss()) {
    router.dismissAll();
    return 'dismissAll';
  }
  router.replace(fallback);
  return 'replace';
}
