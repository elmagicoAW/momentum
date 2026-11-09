import { Palette } from '@/constants/theme';
import { dayStatusLabel } from '@/utils/insights';

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** 0.834 → "83%", null → "—". */
export function formatRate(rate: number | null): string {
  return rate === null ? '—' : `${Math.round(rate * 100)}%`;
}

/** "#RRGGBB" + alpha (0–1) → "#RRGGBBAA". Falls back to the brand accent for other formats. */
export function withAlpha(color: string, alpha: number): string {
  const base = /^#[0-9a-f]{6}$/i.test(color) ? color : Palette.accent;
  const a = Math.round(Math.min(Math.max(alpha, 0), 1) * 255)
    .toString(16)
    .padStart(2, '0');
  return `${base}${a}`;
}

/** Plain-language status of one habit on one day (shared with the day details panel). */
export const statusLabel = dayStatusLabel;
