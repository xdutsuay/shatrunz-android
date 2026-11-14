import test from 'node:test';
import assert from 'node:assert/strict';

import { COLORS } from '../frontend/constants.js';
import { pickAiForTurn, shouldUseJsEngine, strategyFromSelect } from '../frontend/modes/aivai.js';
test('pickAiForTurn maps white to ai1 and black to ai2', () => {
    const ai1 = { id: 'white' };
    const ai2 = { id: 'black' };
    assert.equal(pickAiForTurn(COLORS.WHITE, ai1, ai2), ai1);
    assert.equal(pickAiForTurn(COLORS.BLACK, ai1, ai2), ai2);
});

test('shouldUseJsEngine is false when side uses C native persona', () => {
    const doc = {
        getElementById(id) {
            if (id === 'white-ai-strategy') return { value: 'c_native' };
            if (id === 'black-ai-strategy') return { value: 'material' };
            return null;
        },
    };
    const ls = {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
    };
    const prevDoc = global.document;
    const prevLs = global.localStorage;
    global.document = doc;
    global.localStorage = ls;
    try {
        assert.equal(shouldUseJsEngine(COLORS.WHITE), false);
        assert.equal(shouldUseJsEngine(COLORS.BLACK), true);
    } finally {
        global.document = prevDoc;
        global.localStorage = prevLs;
    }
});

test('strategyFromSelect reads DOM when elements exist', () => {
    const doc = {
        getElementById(id) {
            if (id === 'white-ai-strategy') return { value: 'aggressive' };
            if (id === 'black-ai-strategy') return { value: 'positional' };
            return null;
        },
    };
    const prev = global.document;
    global.document = doc;
    try {
        assert.equal(strategyFromSelect('white'), 'aggressive');
        assert.equal(strategyFromSelect('black'), 'positional');
    } finally {
        global.document = prev;
    }
});

test('a move that arrives after Stop is not played', async () => {
    const { AivaiModeController } = await import('../frontend/modes/aivai.js');
    const prevDoc = global.document;
    global.document = { getElementById: () => null };
    let release;
    const slowAi = {
        level: 1,
        brain: { recordMove() {} },
        getBestMove: () => new Promise((r) => { release = r; }),
    };
    let played = 0;
    const ctx = {
        game: { turn: COLORS.WHITE, gameOver: false, checkStatus: () => ({ over: false }) },
        session: { uciMoveHistory: [], executeAndRecordMove: () => { played++; return {}; } },
        boardView: { render() {} },
        thinkEl: { innerText: '' },
        statusEl: { innerText: '' },
        ai1: slowAi,
        ai2: slowAi,
        syncAutoButtons() {},
        refreshUi() {},
        updateMoveTime() {},
        maybeExplainMove() {},
        onGameEnd() {},
    };
    try {
        const mc = new AivaiModeController(ctx);
        mc.autoRunning = true;
        const pending = mc.triggerAiMove();
        await new Promise((r) => setTimeout(r, 40)); // past the pre-search yield
        assert.equal(typeof release, 'function', 'search should have started');
        mc.stopAuto();
        release({ from: { r: 7, c: 4 }, to: { r: 6, c: 4 } });
        await pending;
        assert.equal(played, 0, 'stale move must be discarded');
        assert.equal(ctx.thinkEl.innerText, '');
    } finally {
        global.document = prevDoc;
    }
});
