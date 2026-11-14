// #34: DroidFish-style toggles keep DroidFish's defaults (labels and
// highlight on; blindfold, auto-flip, sound and vibration off).
import test from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
};
const { DrawerKeys, drawerToggle } = await import('../frontend/shared/settings_drawer.js');
const { moveFeedback } = await import('../frontend/shared/move_feedback.js');

test('defaults match DroidFish', () => {
    store.clear();
    assert.equal(drawerToggle(DrawerKeys.squareLabels), true);
    assert.equal(drawerToggle(DrawerKeys.highlightLastMove), true);
    assert.equal(drawerToggle(DrawerKeys.animations), true);
    for (const k of [DrawerKeys.blindMode, DrawerKeys.autoSwapSides, DrawerKeys.moveSound, DrawerKeys.vibrate]) {
        assert.equal(drawerToggle(k), false, k);
    }
    store.set(DrawerKeys.blindMode, '1');
    store.set(DrawerKeys.squareLabels, '0');
    assert.equal(drawerToggle(DrawerKeys.blindMode), true);
    assert.equal(drawerToggle(DrawerKeys.squareLabels), false);
});

test('vibrates only for engine moves, only when enabled', () => {
    store.clear();
    const calls = [];
    Object.defineProperty(globalThis, 'navigator', { value: { vibrate: (ms) => calls.push(ms) }, configurable: true });
    moveFeedback(true);
    store.set(DrawerKeys.vibrate, '1');
    moveFeedback(false);
    moveFeedback(true);
    assert.deepEqual(calls, [35]);
});
