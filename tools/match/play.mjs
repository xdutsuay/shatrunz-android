/**
 * One engine-vs-engine game, played the way the app's AI vs AI mode plays:
 * same wasm search, same per-move budget, same repetition contempt as
 * frontend/shared/repetition.js, and the game's own end rules (mate,
 * stalemate, 5-fold repetition, 240-ply material adjudication).
 */
import { createRequire } from 'node:module';
import { repetitionPenalty } from '../../frontend/shared/repetition.js';

const require = createRequire(import.meta.url);
const cache = new Map();
export function loadEngine(dir) {
    if (!cache.has(dir)) cache.set(dir, require(`${dir}/shatrunz_wasm.js`));
    return cache.get(dir);
}

/** Hard stop for games the rules never end (e.g. level material past ply 240). */
export const PLY_CAP = 320;

/**
 * @param {object} o
 * @param {string[]} o.opening  UCI moves to start from
 * @param {{white: object, black: object}} o.engines  loaded wasm modules
 * @param {number} o.ms  budget per move
 * @param {string} [o.persona]
 * @returns {{result: '1-0'|'0-1'|'1/2-1/2', reason: string, plies: number, stats: object}}
 */
export function playGame({ opening, engines, ms, persona = 'material' }) {
    // Rules come from the white engine's build; both sides share one game.
    const rules = engines.white;
    const game = rules.WasmGame.fromUciMoves(opening);
    const history = new Map();
    const bump = (k) => history.set(k, (history.get(k) || 0) + 1);
    // Rebuild the opening's position history the same way Game does.
    {
        const g = rules.WasmGame.fromUciMoves([]);
        bump(g.positionKey());
        for (const u of opening) { g.executeUci(u); bump(g.positionKey()); }
    }
    const stats = { w: newStats(), b: newStats() };
    const moves = [...opening];
    for (;;) {
        const st = game.checkStatus();
        if (st.over) {
            const result = st.winner === 'w' ? '1-0' : st.winner === 'b' ? '0-1' : '1/2-1/2';
            return { result, reason: st.msg, plies: moves.length, stats, moves };
        }
        if (moves.length >= PLY_CAP) {
            return { result: '1/2-1/2', reason: 'ply cap', plies: moves.length, stats, moves };
        }
        const turn = game.turn();
        const eng = turn === 'w' ? engines.white : engines.black;
        const material = game.getScore();
        const mover = turn === 'w' ? material : -material;
        const rootBonuses = {};
        for (const u of game.allLegalUci()) {
            if (!game.executeUci(u)) continue;
            const seen = history.get(game.positionKey()) || 0;
            game.undoLastMove();
            const b = repetitionPenalty(seen, mover);
            if (b) rootBonuses[u] = b;
        }
        // Each engine searches its own copy so its build's Game is used.
        const own = eng.WasmGame.fromUciMoves(moves);
        const t0 = performance.now();
        const r = eng.searchBestMove(own, { color: turn, persona, depth: 8, budgetMs: ms, rootBonuses });
        const dt = performance.now() - t0;
        const s = stats[turn];
        s.moves++; s.depth += r.depthReached; s.ms += dt;
        if (typeof r.nodes === 'number') s.nodes += r.nodes; else s.nodes = NaN;
        if (!r.uci || !game.executeUci(r.uci)) {
            // An engine that returns no/illegal move loses.
            return { result: turn === 'w' ? '0-1' : '1-0', reason: `bad move ${r.uci}`, plies: moves.length, stats, moves };
        }
        moves.push(r.uci);
        bump(game.positionKey());
    }
}

function newStats() {
    return { moves: 0, depth: 0, nodes: 0, ms: 0 };
}
