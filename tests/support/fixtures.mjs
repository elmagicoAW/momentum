// Small builders for deterministic test data. Dates are built from local parts (no clock reads).

export const tick = (id, schedule = { kind: 'daily' }) => ({
  id,
  name: `Habit ${id}`,
  icon: 'sun',
  color: '#8B7CF6',
  schedule,
  tracking: { type: 'tick' },
  createdAt: '2026-01-01T00:00:00.000Z',
});

export const count = (id, target = 8) => ({ ...tick(id), tracking: { type: 'count', target, unit: 'glasses' } });

export const checklist = (id) => ({
  ...tick(id),
  tracking: {
    type: 'checklist',
    steps: [
      { id: 's1', label: 'One' },
      { id: 's2', label: 'Two' },
      { id: 's3', label: 'Optional', optional: true },
    ],
  },
});

export const routine = (id, habitIds, extra = {}) => ({
  id,
  title: `Routine ${id}`,
  icon: 'sun',
  color: '#5B8DEF',
  timeOfDay: 'anytime',
  habitIds,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...extra,
});

/** Monday 9 Nov 2026, local time. */
export const MONDAY = new Date(2026, 10, 9, 9, 0, 0);
/** Tuesday 10 Nov 2026, local time. */
export const TUESDAY = new Date(2026, 10, 10, 9, 0, 0);

export const EMPTY = () => ({ entries: {} });

export const profile = (extra = {}) => ({
  displayName: 'Maya Lin',
  avatar: { kind: 'initials' },
  namePrompt: 'completed',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...extra,
});

/** Like a deferred promise: resolve/reject from the test. */
export function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
