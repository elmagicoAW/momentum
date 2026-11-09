import { dayStatusLabel } from '@/utils/insights';

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** 0.834 → "83%", null → "—". */
export function formatRate(rate: number | null): string {
  return rate === null ? '—' : `${Math.round(rate * 100)}%`;
}

export { withAlpha } from '@/utils/theme-color';

/** Plain-language status of one habit on one day (shared with the day details panel). */
export const statusLabel = dayStatusLabel;
