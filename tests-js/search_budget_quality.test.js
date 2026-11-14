/**
 * A time-limited search must not blunder.
 *
 * Regression: when the deadline cut an iteration short, the root loop kept
 * whichever move it happened to look at first (in move-generation order)
 * and threw away the previous, fully searched depth. With ~150 ms per move
 * that regularly played moves ~1400 cp worse than a plain depth-3 search.
 *
 * Check: over positions from a seeded random walk, the budgeted move,
 * judged by a fixed 2-ply reply search, is never much worse than the move a
 * fixed depth-3 search picks.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getWasm } from '../frontend/shared/wasm_boot.js';

function positions(m) {
    let seed = 12345;
    const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    const out = [];
    for (let g = 0; g < 6; g++) {
        const moves = [];
        for (let ply = 0; ply < 24; ply++) {
            const legal = m.WasmGame.fromUciMoves(moves).allLegalUci();
            if (!legal.length) break;
            moves.push(legal[Math.floor(rnd() * legal.length)]);
            if (ply % 6 === 5) out.push([...moves]);
        }
    }
    return out;
}

/** Score of `uci` for the side to move: minus the opponent's best 2-ply reply. */
function judge(m, pos, uci) {
    const g = m.WasmGame.fromUciMoves([...pos, uci]);
    if (g.checkStatus().over) return g.checkStatus().winner ? 1e6 : 0;
    const reply = m.searchBestMove(g, { color: g.turn(), persona: 'material', depth: 2, rootBonuses: {} });
    return -reply.bestScore;
}

describe('budgeted search quality', () => {
    it('never plays a move far worse than a depth-3 search would', () => {
        const m = getWasm();
        const blunders = [];
        for (const pos of positions(m)) {
            const color = m.WasmGame.fromUciMoves(pos).turn();
            const ref = m.searchBestMove(m.WasmGame.fromUciMoves(pos), {
                color, persona: 'material', depth: 3, rootBonuses: {},
            });
            const bud = m.searchBestMove(m.WasmGame.fromUciMoves(pos), {
                color, persona: 'material', depth: 6, budgetMs: 150, rootBonuses: {},
            });
            const loss = judge(m, pos, ref.uci) - judge(m, pos, bud.uci);
            if (loss > 200) blunders.push(`${pos.length} plies: ${bud.uci} vs ${ref.uci} (-${Math.round(loss)} cp)`);
        }
        assert.deepEqual(blunders, []);
    });
});
