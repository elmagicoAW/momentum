import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { leaveAfterRoutineDeleted, leaveRoutineScreen } from '../src/utils/routine-navigation.ts';

/**
 * Minimal model of the app's navigation: a ROOT stack whose first screen is the
 * tab navigator (with the active tab and each tab's own stack), and routine
 * screens pushed above it. Android hardware back = pop the root stack, the same
 * native action as the header back button's `router.back()`.
 */
function appNavigator({ activeTab, tabStacks }) {
  const state = { root: ['(tabs)'], activeTab, tabStacks: structuredClone(tabStacks) };
  const router = {
    canGoBack: () => state.root.length > 1,
    back: () => state.root.pop(),
    canDismiss: () => state.root.length > 1,
    dismissAll: () => state.root.splice(1),
    replace: (href) => state.root.splice(state.root.length - 1, 1, href),
  };
  return {
    state,
    router,
    push: (screen) => state.root.push(screen),
    hardwareBack: () => router.back(),
    visible: () =>
      state.root.length > 1
        ? state.root.at(-1)
        : `${state.activeTab}:${state.tabStacks[state.activeTab].at(-1)}`,
  };
}

describe('routine navigation', () => {
  test("Today's plan → routine → header back returns to Today", () => {
    const nav = appNavigator({ activeTab: 'today', tabStacks: { today: ['index'], habits: ['index'] } });
    nav.push('routine/r1');
    assert.equal(nav.visible(), 'routine/r1');
    assert.equal(leaveRoutineScreen(nav.router, '/'), 'back');
    assert.equal(nav.visible(), 'today:index');
  });

  test("Today's plan → routine → Android hardware back returns to Today", () => {
    const nav = appNavigator({ activeTab: 'today', tabStacks: { today: ['index'], habits: ['index'] } });
    nav.push('routine/r1');
    nav.hardwareBack();
    assert.equal(nav.visible(), 'today:index');
  });

  test('opening a routine from Today never modifies the Habits stack', () => {
    const nav = appNavigator({ activeTab: 'today', tabStacks: { today: ['index'], habits: ['index'] } });
    nav.push('routine/r1');
    nav.hardwareBack();
    assert.deepEqual(nav.state.tabStacks.habits, ['index']);
  });

  test('Habits › Routines → routine → back (both ways) returns to the routine list', () => {
    for (const goBack of ['header', 'hardware']) {
      const nav = appNavigator({ activeTab: 'habits', tabStacks: { today: ['index'], habits: ['index', 'routines'] } });
      nav.push('routine/r1');
      if (goBack === 'header') leaveRoutineScreen(nav.router, '/');
      else nav.hardwareBack();
      assert.equal(nav.visible(), 'habits:routines', goBack);
    }
  });

  test('routine → edit → cancel returns to the routine, then back to the originating tab', () => {
    const nav = appNavigator({ activeTab: 'today', tabStacks: { today: ['index'], habits: ['index'] } });
    nav.push('routine/r1');
    nav.push('routine/edit/r1');
    leaveRoutineScreen(nav.router, '/habits/routines');
    assert.equal(nav.visible(), 'routine/r1');
    nav.hardwareBack();
    assert.equal(nav.visible(), 'today:index');
  });

  test('deleting from the editor pops editor AND stale detail, landing on the originating tab', () => {
    const fromToday = appNavigator({ activeTab: 'today', tabStacks: { today: ['index'], habits: ['index'] } });
    fromToday.push('routine/r1');
    fromToday.push('routine/edit/r1');
    assert.equal(leaveAfterRoutineDeleted(fromToday.router, '/habits/routines'), 'dismissAll');
    assert.equal(fromToday.visible(), 'today:index');

    const fromList = appNavigator({ activeTab: 'habits', tabStacks: { today: ['index'], habits: ['index', 'routines'] } });
    fromList.push('routine/r1');
    fromList.push('routine/edit/r1');
    leaveAfterRoutineDeleted(fromList.router, '/habits/routines');
    assert.equal(fromList.visible(), 'habits:routines');
  });

  test('deep link with nothing underneath falls back instead of getting stuck', () => {
    const router = {
      canGoBack: () => false,
      back: () => assert.fail('must not go back'),
      canDismiss: () => false,
      dismissAll: () => assert.fail('must not dismiss'),
      replaced: null,
      replace(href) {
        this.replaced = href;
      },
    };
    assert.equal(leaveRoutineScreen(router, '/'), 'replace');
    assert.equal(router.replaced, '/');
    assert.equal(leaveAfterRoutineDeleted(router, '/habits/routines'), 'replace');
    assert.equal(router.replaced, '/habits/routines');
  });
});
