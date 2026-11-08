import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { toLocalDateKey } from '@/utils/date';

/**
 * Current date, refreshed when the app returns to the foreground and once a
 * minute while open, so the Today screen rolls over at local midnight even if
 * Android kept the app alive in the background.
 */
export function useCurrentDate() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const refresh = () =>
      setNow((prev) => {
        const next = new Date();
        // Keep the same object within a day to avoid needless re-renders.
        return toLocalDateKey(next) === toLocalDateKey(prev) ? prev : next;
      });

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    const timer = setInterval(refresh, 60_000);

    return () => {
      sub.remove();
      clearInterval(timer);
    };
  }, []);

  return now;
}
