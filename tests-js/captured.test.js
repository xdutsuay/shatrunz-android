import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../frontend/game.js';
import { capturedSummary } from '../frontend/shared/captured.js';

test('start position: nothing captured, level material', () => {
    const s = capturedSummary(new Game().board);
    assert.deepEqual(s, { w: [], b: [], diffPawns: 0 });
});

test('removing a black queen and a white pawn', () => {
    const board = new Game().board.map((row) => row.slice());
    for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) {
        const p = board[r][c];
        if (p?.type === 'q' && p.color === 'b') board[r][c] = null;
    }
    board[7][0] = null; // a white pawn
    const s = capturedSummary(board);
    assert.deepEqual(s.w, ['♛']);
    assert.deepEqual(s.b, ['♙']);
    assert.equal(s.diffPawns, 8);
});
