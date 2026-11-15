import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { getGreeting } from '@/utils/date';

/** Presentation clock only. Keep domain date keys and daily writers independent. */
export function useGreetingDate() {
  const [date, setDate] = useState(() => new Date());
  useEffect(() => {
    const refresh = () => setDate(previous => {
      const next = new Date();
      return getGreeting(previous) === getGreeting(next) ? previous : next;
    });
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') refresh(); });
    const timer = setInterval(refresh, 30_000);
    refresh();
    return () => { subscription.remove(); clearInterval(timer); };
  }, []);
  return date;
}
