import { router, type Href } from 'expo-router';

import { leaveAfterRoutineDeleted, leaveRoutineScreen } from '@/utils/routine-navigation';

/**
 * The Habits tab route (`src/app/(tabs)/habits/index.tsx`).
 *
 * Cast because expo-router's typed-route generator on Windows emits
 * `/habits/index` instead of `/habits` for nested index routes (it strips
 * `/index` before normalizing `\` path separators). The runtime route is `/habits`.
 */
export const HABITS_HREF = '/habits' as Href;

/** The Today tab (`src/app/(tabs)/index.tsx`). Same typed-routes cast: the generator emits `/index` for `/`. */
export const HOME_HREF = '/' as Href;

/** Leaves a habit editor: back if possible, otherwise to the habit list (e.g. after a deep link). */
export function closeHabitEditor() {
  if (router.canGoBack()) router.back();
  else router.replace(HABITS_HREF);
}

/** The Goals tab route (`src/app/(tabs)/goals/index.tsx`). Same typed-routes cast as `HABITS_HREF`. */
export const GOALS_HREF = '/goals' as Href;

/** Leaves a goal editor: back if possible, otherwise to the goal list. */
export function closeGoalEditor() {
  if (router.canGoBack()) router.back();
  else router.replace(GOALS_HREF);
}

/** The Insights tab route (`src/app/(tabs)/insights/index.tsx`). Same typed-routes cast as `HABITS_HREF`. */
export const INSIGHTS_HREF = '/insights' as Href;

/** Opens the read-only history of one habit inside the Insights tab. */
export function openHabitHistory(id: string) {
  router.push({ pathname: '/insights/habit/[id]', params: { id } });
}

/** Leaves a habit history screen: back if possible, otherwise to Insights. */
export function closeHabitHistory() {
  if (router.canGoBack()) router.back();
  else router.replace(INSIGHTS_HREF);
}

/** Opens the habit editor (Habits tab) for a habit. */
export function openHabitEditor(id: string) {
  router.navigate({ pathname: '/habits/[id]', params: { id } });
}

// ---------------------------------------------------------------------------
// Routines — see utils/routine-navigation.ts for why these are root-stack routes.
// Hrefs are cast for the same typed-routes reason as HABITS_HREF.
// ---------------------------------------------------------------------------

/** The routine list inside the Habits tab (`src/app/(tabs)/habits/routines.tsx`). */
export const ROUTINES_HREF = '/habits/routines' as Href;

const routineHref = (id: string) => ({ pathname: '/routine/[id]', params: { id } }) as Href;
const routineEditHref = (id: string) => ({ pathname: '/routine/edit/[id]', params: { id } }) as Href;

/** Opens a routine's detail screen over the current tab. Back returns to that tab. */
export function openRoutine(id: string) {
  router.push(routineHref(id));
}

export function openNewRoutine() {
  router.push('/routine/new' as Href);
}

export function openRoutineEditor(id: string) {
  router.push(routineEditHref(id));
}

/** From another tab (e.g. Today's plan "Manage"): switches to Habits › Routines. */
export function openRoutineList() {
  router.navigate(ROUTINES_HREF);
}

/** Leaves the routine list: back to the Habits list. */
export function closeRoutineList() {
  if (router.canGoBack()) router.back();
  else router.replace(HABITS_HREF);
}

/** Leaves a routine detail screen. Fallback (nothing underneath): Today. */
export function closeRoutine() {
  leaveRoutineScreen(router, HOME_HREF);
}

/** Leaves the new/edit routine form. Fallback: the routine list. */
export function closeRoutineEditor() {
  leaveRoutineScreen(router, ROUTINES_HREF);
}

/** After a routine is deleted: pops the editor and the stale detail screen together. */
export function closeAfterRoutineDeleted() {
  leaveAfterRoutineDeleted(router, ROUTINES_HREF);
}
