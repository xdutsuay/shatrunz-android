/**
 * Time-budgeted search must work in wasm.
 *
 * Regression: `std::time::Instant::now()` panics on wasm32-unknown-unknown,
 * so any `searchBestMove` call with `budgetMs > 0` trapped with
 * "RuntimeError: unreachable" instead of returning a move.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getWasm } from '../frontend/shared/wasm_boot.js';

describe('wasm searchBestMove with budgetMs', () => {
    it('returns a legal move within roughly the budget', () => {
        const { WasmGame, searchBestMove } = getWasm();
        const game = WasmGame.fromUciMoves([]);
        const legal = game.allLegalUci();
        const t0 = performance.now();
        const res = searchBestMove(game, {
            color: 'w', persona: 'material', depth: 6, budgetMs: 200, rootBonuses: {},
        });
        const elapsed = performance.now() - t0;
        assert.ok(res.uci, 'expected a move');
        assert.ok(legal.includes(res.uci), `${res.uci} should be legal`);
        assert.ok(res.depthReached >= 1);
        // Generous upper bound: deadline checks happen per node, so overshoot is tiny.
        assert.ok(elapsed < 2000, `search took ${elapsed}ms for a 200ms budget`);
    });
});
