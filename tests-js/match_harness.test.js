/**
 * The engine-vs-engine match harness (tools/match): Elo maths and one
 * short game between two copies of the current engine.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { eloFromWDL } from '../tools/match/elo.mjs';
import { playGame, loadEngine, PLY_CAP } from '../tools/match/play.mjs';

describe('match harness', () => {
    it('Elo is 0 for an even score and antisymmetric', () => {
        assert.ok(Math.abs(eloFromWDL(10, 5, 10).elo) < 1e-9);
        const up = eloFromWDL(30, 10, 10), down = eloFromWDL(10, 10, 30);
        assert.ok(Math.abs(up.elo + down.elo) < 1e-9);
        assert.ok(Math.abs(up.elo - 147.2) < 0.5, `got ${up.elo}`); // score 0.7
        assert.ok(up.err > 0 && up.err < 200);
    });

    it('more games give a smaller error bar', () => {
        assert.ok(eloFromWDL(60, 40, 40).err < eloFromWDL(15, 10, 10).err);
    });

    it('plays a complete, legal game from an opening', () => {
        const dir = fileURLToPath(new URL('../frontend/pkg-node', import.meta.url));
        const m = loadEngine(dir);
        const r = playGame({ opening: ['e2e3', 'e8e7'], engines: { white: m, black: m }, ms: 2 });
        assert.match(r.result, /^(1-0|0-1|1\/2-1\/2)$/);
        assert.ok(r.plies > 2 && r.plies <= PLY_CAP);
        const replay = m.WasmGame.fromUciMoves(r.moves); // throws on an illegal move
        assert.equal(replay.checkStatus().over || r.plies >= PLY_CAP, true);
        assert.ok(r.stats.w.moves > 0 && r.stats.w.nodes > 0);
    });
});
