// #33: per-side ("time odds") engine settings.
import test from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
};

const { sideEngineSettings, setSideEngine, setNum, SettingsKeys } = await import('../frontend/shared/settings_store.js');
const { jsBudgetMs, applySideLevel, sideThinkLabel } = await import('../frontend/shared/engine_move.js');

test('no overrides: both sides use the global think time / level default', () => {
    store.clear();
    assert.deepEqual(sideEngineSettings('w'), { level: null, thinkTimeMs: null });
    assert.equal(jsBudgetMs('w', 3), jsBudgetMs('b', 3));
    setNum(SettingsKeys.thinkTimeMs, 2000);
    assert.equal(jsBudgetMs('b', 3), 2000);
});

test('time odds: each side gets its own think time and strength', () => {
    store.clear();
    setSideEngine('w', 'thinkTimeMs', 5000);
    setSideEngine('b', 'thinkTimeMs', 250);
    setSideEngine('b', 'level', 1);
    assert.equal(jsBudgetMs('w', 3), 5000);
    assert.equal(jsBudgetMs('b', 3), 250);
    assert.equal(sideThinkLabel('w', 3), '5 s');
    assert.equal(sideThinkLabel('b', 3), '250 ms');
    const ai = { level: 3, setLevel(l) { this.level = l; } };
    assert.equal(applySideLevel(ai, 'b'), 1);
    const ai2 = { level: 4, setLevel(l) { this.level = l; } };
    assert.equal(applySideLevel(ai2, 'w'), 4, 'no override leaves level alone');
    setSideEngine('b', 'level', 0);
    assert.equal(sideEngineSettings('b').level, null, 'clearing restores "Same"');
});
