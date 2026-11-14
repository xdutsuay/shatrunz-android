// #30: a custom start must survive every rebuild-from-moves path:
// the AI worker (fromStartAndUciMoves), restore (replayGameFromUci) and the
// step-through replay controller.
import test from 'node:test';
import assert from 'node:assert/strict';

import { Game } from '../frontend/game.js';
import { getWasm } from '../frontend/shared/wasm_boot.js';
import { replayGameFromUci } from '../frontend/shared/replay.js';
import { ReplayStepController } from '../frontend/shared/replay_step.js';
import { boardToStartFen, validateStartFen, STANDARD_START } from '../frontend/shared/start_position.js';
import { parseUCIMove } from '../frontend/shared/uci.js';

const START = '4k4/2z6/9/9/9/9/9/6Z2/QR2K4 w';
const MOVES = ['a1e5', 'e9d9', 'b1b9'];

function playLive() {
    const g = new Game({ fen: START });
    for (const u of MOVES) {
        const { from, to } = parseUCIMove(u);
        assert.ok(g.executeMove(from, to), u);
    }
    return g;
}

test('validation accepts standard and custom, rejects broken', () => {
    assert.equal(validateStartFen(STANDARD_START), null);
    assert.equal(validateStartFen(START), null);
    assert.ok(validateStartFen('9/9/9/9/9/9/9/9/4K4 w'), 'no black king');
    assert.ok(validateStartFen('garbage'));
});

test('board -> start string round-trips', () => {
    assert.equal(boardToStartFen(new Game({ fen: START }).board, 'white'), START);
    assert.equal(boardToStartFen(new Game().board, 'white'), STANDARD_START);
});

test('worker, restore and replay rebuilds match the live game', () => {
    const live = playLive();
    const worker = getWasm().WasmGame.fromStartAndUciMoves(live.startFen, MOVES);
    assert.equal(worker.positionKey(), live.getHash());

    const restored = replayGameFromUci(MOVES, live.startFen);
    assert.ok(!restored.error, restored.error);
    assert.equal(restored.game.getHash(), live.getHash());

    const step = new ReplayStepController(MOVES, live.startFen);
    step.stepTo(MOVES.length);
    assert.equal(step.game.getHash(), live.getHash());

    // Without the start the same moves land somewhere else entirely: the desync #30 prevents.
    const wrong = replayGameFromUci(MOVES);
    assert.notEqual(wrong.game?.getHash(), live.getHash());
});
