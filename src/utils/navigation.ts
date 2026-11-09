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
