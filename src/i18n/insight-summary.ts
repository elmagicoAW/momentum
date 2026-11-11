import type { WeeklyReview } from '@/utils/insights';
import { appLabel, appMessage } from './app-copy';

/** Formatting existing facts only; no history, scheduling or aggregation is performed here. */
export function weekSummary(r: WeeklyReview): string {
  if (r.empty) return appLabel('insights.noHabitsHadStartedYetThisWeekNothingIsCounted');
  const {done, finished, unknown, rate} = r.counts;
  const percent = rate === null ? null : Math.round(rate * 100);
  if (r.isCurrent && finished === 0) {
    if (!(r.todayDone > 0) && !(r.remaining > 0) && !(unknown > 0)) return appMessage("insights.week.complete.currentEmpty.plain", {  });
    if ((r.todayDone > 0) && !(r.remaining > 0) && !(unknown > 0)) return appMessage("insights.week.complete.currentEmpty.today", { completed: r.todayDone });
    if (!(r.todayDone > 0) && (r.remaining > 0) && !(unknown > 0)) return appMessage("insights.week.complete.currentEmpty.remaining", { steps: r.remaining });
    if ((r.todayDone > 0) && (r.remaining > 0) && !(unknown > 0)) return appMessage("insights.week.complete.currentEmpty.today-remaining", { completed: r.todayDone, steps: r.remaining });
    if (!(r.todayDone > 0) && !(r.remaining > 0) && (unknown > 0)) return appMessage("insights.week.complete.currentEmpty.unreadable", { count: unknown });
    if ((r.todayDone > 0) && !(r.remaining > 0) && (unknown > 0)) return appMessage("insights.week.complete.currentEmpty.today-unreadable", { completed: r.todayDone, count: unknown });
    if (!(r.todayDone > 0) && (r.remaining > 0) && (unknown > 0)) return appMessage("insights.week.complete.currentEmpty.remaining-unreadable", { steps: r.remaining, count: unknown });
    if ((r.todayDone > 0) && (r.remaining > 0) && (unknown > 0)) return appMessage("insights.week.complete.currentEmpty.today-remaining-unreadable", { completed: r.todayDone, steps: r.remaining, count: unknown });
  }
  if (r.isCurrent) {
    if (!(percent !== null) && !(r.todayDone > 0) && !(r.remaining > 0) && !(unknown > 0)) return appMessage("insights.week.complete.current.plain", { done, total: finished });
    if ((percent !== null) && !(r.todayDone > 0) && !(r.remaining > 0) && !(unknown > 0)) return appMessage("insights.week.complete.current.percent", { done, total: finished, percent: percent! });
    if (!(percent !== null) && (r.todayDone > 0) && !(r.remaining > 0) && !(unknown > 0)) return appMessage("insights.week.complete.current.today", { done, total: finished, completed: r.todayDone });
    if ((percent !== null) && (r.todayDone > 0) && !(r.remaining > 0) && !(unknown > 0)) return appMessage("insights.week.complete.current.percent-today", { done, total: finished, percent: percent!, completed: r.todayDone });
    if (!(percent !== null) && !(r.todayDone > 0) && (r.remaining > 0) && !(unknown > 0)) return appMessage("insights.week.complete.current.remaining", { done, total: finished, steps: r.remaining });
    if ((percent !== null) && !(r.todayDone > 0) && (r.remaining > 0) && !(unknown > 0)) return appMessage("insights.week.complete.current.percent-remaining", { done, total: finished, percent: percent!, steps: r.remaining });
    if (!(percent !== null) && (r.todayDone > 0) && (r.remaining > 0) && !(unknown > 0)) return appMessage("insights.week.complete.current.today-remaining", { done, total: finished, completed: r.todayDone, steps: r.remaining });
    if ((percent !== null) && (r.todayDone > 0) && (r.remaining > 0) && !(unknown > 0)) return appMessage("insights.week.complete.current.percent-today-remaining", { done, total: finished, percent: percent!, completed: r.todayDone, steps: r.remaining });
    if (!(percent !== null) && !(r.todayDone > 0) && !(r.remaining > 0) && (unknown > 0)) return appMessage("insights.week.complete.current.unreadable", { done, total: finished, count: unknown });
    if ((percent !== null) && !(r.todayDone > 0) && !(r.remaining > 0) && (unknown > 0)) return appMessage("insights.week.complete.current.percent-unreadable", { done, total: finished, percent: percent!, count: unknown });
    if (!(percent !== null) && (r.todayDone > 0) && !(r.remaining > 0) && (unknown > 0)) return appMessage("insights.week.complete.current.today-unreadable", { done, total: finished, completed: r.todayDone, count: unknown });
    if ((percent !== null) && (r.todayDone > 0) && !(r.remaining > 0) && (unknown > 0)) return appMessage("insights.week.complete.current.percent-today-unreadable", { done, total: finished, percent: percent!, completed: r.todayDone, count: unknown });
    if (!(percent !== null) && !(r.todayDone > 0) && (r.remaining > 0) && (unknown > 0)) return appMessage("insights.week.complete.current.remaining-unreadable", { done, total: finished, steps: r.remaining, count: unknown });
    if ((percent !== null) && !(r.todayDone > 0) && (r.remaining > 0) && (unknown > 0)) return appMessage("insights.week.complete.current.percent-remaining-unreadable", { done, total: finished, percent: percent!, steps: r.remaining, count: unknown });
    if (!(percent !== null) && (r.todayDone > 0) && (r.remaining > 0) && (unknown > 0)) return appMessage("insights.week.complete.current.today-remaining-unreadable", { done, total: finished, completed: r.todayDone, steps: r.remaining, count: unknown });
    if ((percent !== null) && (r.todayDone > 0) && (r.remaining > 0) && (unknown > 0)) return appMessage("insights.week.complete.current.percent-today-remaining-unreadable", { done, total: finished, percent: percent!, completed: r.todayDone, steps: r.remaining, count: unknown });
  }
  if (!r.isCurrent) {
    if (finished === 0 && unknown === 0) return appLabel('insights.nothingWasScheduledThisWeek');
    if (!(percent !== null) && !(unknown > 0)) return appMessage("insights.week.complete.finished.plain", { done, total: finished });
    if ((percent !== null) && !(unknown > 0)) return appMessage("insights.week.complete.finished.percent", { done, total: finished, percent: percent! });
    if (!(percent !== null) && (unknown > 0)) return appMessage("insights.week.complete.finished.unreadable", { done, total: finished, count: unknown });
    if ((percent !== null) && (unknown > 0)) return appMessage("insights.week.complete.finished.percent-unreadable", { done, total: finished, percent: percent!, count: unknown });
  }
  return appLabel('errors.unexpected');
}
