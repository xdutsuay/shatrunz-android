/**
 * The AI worker never sees the live Game: it rebuilds the position from the
 * UCI move list (ai_worker_client.js `uciMovesFromGame` -> `fromUciMoves`).
 * If the two disagree, the worker searches a different position and its move
 * is rejected by the real game. Castling ("e1g1", no flag) used to be
 * replayed as a plain king move, leaving the rook in the corner.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../frontend/game.js';
import { Rules } from '../frontend/rules.js';
import { moveToUCI } from '../frontend/shared/uci.js';
import { getWasm } from '../frontend/shared/wasm_boot.js';

test('position rebuilt from UCI always equals the live game (incl. castling)', () => {
    const { WasmGame } = getWasm();
    let seed = 1;
    const rnd = (n) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
    let castles = 0;
    for (let g = 0; g < 120; g++) {
        const game = new Game();
        for (let ply = 0; ply < 160 && !game.checkStatus().over; ply++) {
            const moves = Rules.getAllLegalMoves(game.board, game.turn);
            if (!moves.length) break;
            const castling = moves.filter((m) => m.to.isCastling);
            const m = castling.length && rnd(2) ? castling[rnd(castling.length)] : moves[rnd(moves.length)];
            if (m.to.isCastling) castles++;
            assert.ok(game.executeMove(m.from, m.to));
            const ucis = game.moveHistory.map((h) => moveToUCI(h.from, h.to, h.movedPiece));
            assert.equal(WasmGame.fromUciMoves(ucis).positionKey(), game.getHash(),
                `game ${g} ply ${ply}: replay of ${ucis.at(-1)} differs from the live position`);
        }
    }
    assert.ok(castles > 0, 'the test must actually exercise castling');
});
