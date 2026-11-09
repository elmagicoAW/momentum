import * as Notifications from 'expo-notifications';
import { router, usePathname } from 'expo-router';
import { useEffect } from 'react';

import { useHabits } from '@/hooks/use-habits';
import { useRoutines } from '@/hooks/use-routines';
import { notificationsSupported } from '@/notifications/scheduler';
import { HOME_HREF, openRoutine } from '@/utils/navigation';
import { responseKey, tapTarget } from '@/utils/reminder-presentation';

/** Taps already handled this process — survives re-renders and remounts. */
const handled = new Set<string>();

/**
 * Opens the right screen when a reminder is tapped (cold start or warm).
 * Rendered inside the tabs layout, so the navigator is mounted before it
 * navigates. Waits for habits/routines to finish loading, handles each
 * delivered notification once, then clears the stored response so a later
 * remount can't navigate again.
 *
 * Routes (real paths in this app):
 * - habit reminder   → `/` (Today, where check-in happens)
 * - routine reminder → `/routine/[id]` (root-stack detail screen) if it still
 *   exists, otherwise Today.
 */
function NativeTapHandler() {
  const response = Notifications.useLastNotificationResponse();
  const { status: habitsStatus } = useHabits();
  const { routines, status: routinesStatus } = useRoutines();
  const pathname = usePathname();

  useEffect(() => {
    if (!response) return;
    if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    if (habitsStatus === 'loading' || routinesStatus === 'loading') return; // decide with real data

    const { request, date } = response.notification;
    const key = responseKey(request.identifier, date);
    if (handled.has(key)) return;
    handled.add(key);
    try {
      Notifications.clearLastNotificationResponse();
    } catch {
      // Older native module — the `handled` set still prevents repeats.
    }

    // A load error leaves `routines` empty, so the tap falls back to Today.
    const target = tapTarget(request.content.data, new Set(routines.map((r) => r.id)));
    if (!target) return; // not a MOMENTUM reminder (e.g. the test notification)
    if (target.screen === 'routine') {
      if (pathname !== `/routine/${target.id}`) openRoutine(target.id); // already open → don't stack a copy
    } else router.navigate(HOME_HREF);
  }, [response, habitsStatus, routinesStatus, routines, pathname]);

  return null;
}

export const NotificationTapHandler = notificationsSupported ? NativeTapHandler : () => null;
