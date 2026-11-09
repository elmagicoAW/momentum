import { router, type Href } from 'expo-router';

/**
 * The Habits tab route (`src/app/habits/index.tsx`).
 *
 * Cast because expo-router's typed-route generator on Windows emits
 * `/habits/index` instead of `/habits` for nested index routes (it strips
 * `/index` before normalizing `\` path separators). The runtime route is `/habits`.
 */
export const HABITS_HREF = '/habits' as Href;

/** Leaves a habit editor: back if possible, otherwise to the habit list (e.g. after a deep link). */
export function closeHabitEditor() {
  if (router.canGoBack()) router.back();
  else router.replace(HABITS_HREF);
}

/** The Goals tab route (`src/app/goals/index.tsx`). Same typed-routes cast as `HABITS_HREF`. */
export const GOALS_HREF = '/goals' as Href;

/** Leaves a goal editor: back if possible, otherwise to the goal list. */
export function closeGoalEditor() {
  if (router.canGoBack()) router.back();
  else router.replace(GOALS_HREF);
}

/** The Insights tab route (`src/app/insights/index.tsx`). Same typed-routes cast as `HABITS_HREF`. */
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
