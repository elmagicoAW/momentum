import { appMessage } from '@/i18n/app-copy';
import { dayStatusLabel } from '@/utils/insights';
export function formatRate(rate: number | null): string {
  return rate === null ? '—' : appMessage('display.percent', { percent: Math.round(rate * 100) });
}
export { withAlpha } from '@/utils/theme-color';
export const statusLabel = dayStatusLabel;
