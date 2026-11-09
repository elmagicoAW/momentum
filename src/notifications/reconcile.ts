/**
 * Reconciliation — the ONLY code path that changes the OS notification schedule.
 * Pure apart from the injected `ReminderScheduler`, so it is tested with a fake.
 *
 * Rules:
 * - Never runs on a partial picture: if any source store isn't ready, NOTHING
 *   is cancelled or scheduled (existing reminders keep working).
 * - Only owned identifiers (`momentum.h.` / `momentum.r.`) are ever cancelled.
 * - If listing the current schedule fails, nothing is changed (no blind writes).
 * - Each cancel/schedule is isolated: one failure never stops the others.
 * - A changed reminder whose cancel failed is NOT rescheduled in that run, so
 *   a failure can never leave two copies; the old one stays until a retry.
 * - Never writes app data. The result only feeds UI status and retries.
 */
import { diffSchedule, type PlannedReminder, type ReminderPlan, type ScheduledInfo } from '@/utils/reminder-plan';
import { canDeliver, type PermissionState } from '@/utils/reminder-presentation';

export interface ReminderScheduler {
  listScheduled(): Promise<ScheduledInfo[]>;
  cancel(identifier: string): Promise<void>;
  schedule(reminder: PlannedReminder): Promise<void>;
}

export type ReconcileInput = {
  /** Habits, routines AND reminder settings all loaded successfully. */
  sourcesReady: boolean;
  permission: PermissionState;
  /** Planned from the current sources (empty when the master switch is off). */
  plan: ReminderPlan;
};

export type ReconcileFailure = { identifier: string; op: 'cancel' | 'schedule'; message: string };

export type ReconcileResult =
  | { status: 'skipped'; reason: 'sources-not-ready' | 'permission-unknown' | 'unsupported' }
  | { status: 'list-failed'; message: string }
  | {
      status: 'done';
      /** Reminders that should exist and are now scheduled (desired − failures). */
      scheduledCount: number;
      desiredCount: number;
      cancelled: number;
      newlyScheduled: number;
      unchanged: number;
      failures: ReconcileFailure[];
      omittedForLimit: number;
    };

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

export async function reconcile(scheduler: ReminderScheduler, input: ReconcileInput): Promise<ReconcileResult> {
  if (input.permission === 'unsupported') return { status: 'skipped', reason: 'unsupported' };
  if (!input.sourcesReady) return { status: 'skipped', reason: 'sources-not-ready' };
  // Unknown permission (still checking, or the check FAILED) → change nothing.
  // A failed check must never wipe working reminders.
  if (input.permission === 'checking' || input.permission === 'error') {
    return { status: 'skipped', reason: 'permission-unknown' };
  }

  // Without permission nothing can be shown, so nothing of ours stays scheduled.
  // Settings are untouched; everything comes back when permission is granted.
  const deliverable = canDeliver(input.permission);
  const desired = deliverable ? input.plan.reminders : [];
  const omittedForLimit = deliverable ? input.plan.omittedForLimit : 0;

  let existing: ScheduledInfo[];
  try {
    existing = await scheduler.listScheduled();
  } catch (error) {
    return { status: 'list-failed', message: messageOf(error) };
  }

  const diff = diffSchedule(existing, desired);
  const failures: ReconcileFailure[] = [];
  const cancelFailed = new Set<string>();
  let cancelled = 0;
  let newlyScheduled = 0;

  for (const identifier of diff.toCancel) {
    try {
      await scheduler.cancel(identifier);
      cancelled += 1;
    } catch (error) {
      cancelFailed.add(identifier);
      failures.push({ identifier, op: 'cancel', message: messageOf(error) });
    }
  }

  for (const reminder of diff.toSchedule) {
    // The old copy is still scheduled: don't add a second one. Retried later.
    if (diff.replacing.has(reminder.identifier) && cancelFailed.has(reminder.identifier)) continue;
    try {
      await scheduler.schedule(reminder);
      newlyScheduled += 1;
    } catch (error) {
      failures.push({ identifier: reminder.identifier, op: 'schedule', message: messageOf(error) });
    }
  }

  const failedDesired = new Set(
    failures
      .filter((f) => f.op === 'schedule' || diff.replacing.has(f.identifier))
      .map((f) => f.identifier),
  );
  return {
    status: 'done',
    scheduledCount: desired.filter((d) => !failedDesired.has(d.identifier)).length,
    desiredCount: desired.length,
    cancelled,
    newlyScheduled,
    unchanged: diff.unchanged,
    failures,
    omittedForLimit,
  };
}

export function hasProblems(result: ReconcileResult): boolean {
  return result.status === 'list-failed' || (result.status === 'done' && result.failures.length > 0);
}

// ---------------------------------------------------------------------------
// Sync runner: single-flight, coalescing, retrying
// ---------------------------------------------------------------------------

export type TimerApi = {
  set: (fn: () => void, ms: number) => unknown;
  clear: (handle: unknown) => void;
};

const realTimers: TimerApi = {
  set: (fn, ms) => setTimeout(fn, ms),
  clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export const DEFAULT_SYNC_RETRY_DELAYS_MS = [5_000, 30_000, 120_000, 600_000];

export type SyncRunner<I> = {
  /**
   * Asks for a sync. `input` (when given) replaces the stored latest input.
   * Calls made while one runs collapse into ONE follow-up run, which uses the
   * latest input — so a follow-up never works from stale data.
   */
  request: (input?: I) => Promise<void>;
  /** Stops pending retries (unmount). */
  dispose: () => void;
  isRunning: () => boolean;
};

/**
 * Results with problems schedule a retry with backoff; a clean result or a
 * skipped run resets the backoff. A skipped run (sources not ready) is not
 * retried by timer — the next data change requests a new sync anyway.
 */
export function createSyncRunner<I = void>(options: {
  /** Called with the latest input given to `request` (undefined if none yet). */
  run: (input: I | undefined) => Promise<ReconcileResult>;
  onResult: (result: ReconcileResult) => void;
  retryDelaysMs?: readonly number[];
  timers?: TimerApi;
}): SyncRunner<I> {
  const delays = options.retryDelaysMs ?? DEFAULT_SYNC_RETRY_DELAYS_MS;
  const timers = options.timers ?? realTimers;
  let latestInput: I | undefined;
  let running: Promise<void> | null = null;
  let dirty = false;
  let failures = 0;
  let retryHandle: unknown = null;
  let disposed = false;

  const clearRetry = () => {
    if (retryHandle !== null) timers.clear(retryHandle);
    retryHandle = null;
  };

  async function loop() {
    do {
      dirty = false;
      let result: ReconcileResult;
      try {
        result = await options.run(latestInput);
      } catch (error) {
        // `run` should never throw, but a bug must not kill the runner.
        result = { status: 'list-failed', message: messageOf(error) };
      }
      if (disposed) return;
      options.onResult(result);
      if (hasProblems(result)) {
        failures += 1;
      } else {
        failures = 0;
        clearRetry();
      }
    } while (dirty && !disposed);

    if (failures > 0 && !disposed) {
      clearRetry();
      const ms = delays[Math.min(failures - 1, delays.length - 1)];
      retryHandle = timers.set(() => {
        retryHandle = null;
        void request();
      }, ms);
    }
  }

  function request(input?: I): Promise<void> {
    if (disposed) return Promise.resolve();
    if (input !== undefined) latestInput = input;
    if (running) {
      dirty = true;
      return running;
    }
    clearRetry();
    running = loop().finally(() => {
      running = null;
    });
    return running;
  }

  return {
    request,
    dispose() {
      disposed = true;
      clearRetry();
    },
    isRunning: () => running !== null,
  };
}
