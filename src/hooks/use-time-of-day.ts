import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { timeOfDayBucket, type ClockBucket } from '@/utils/routine-progress';

/**
 * Current time-of-day bucket (morning / afternoon / evening), re-checked when
 * the app returns to the foreground and every 30 s while open. State only
 * changes when the bucket does, so screens re-render a few times a day at most.
 *
 * Separate from `useCurrentDate`, which deliberately keeps the same Date object
 * for the whole day (its hours would be stale here).
 */
export function useTimeOfDay(): ClockBucket {
  const [bucket, setBucket] = useState<ClockBucket>(() => timeOfDayBucket(new Date()));

  useEffect(() => {
    const refresh = () => setBucket(timeOfDayBucket(new Date())); // same value → React skips the render
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    const timer = setInterval(refresh, 30_000);
    return () => {
      sub.remove();
      clearInterval(timer);
    };
  }, []);

  return bucket;
}
