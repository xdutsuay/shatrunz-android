/**
 * Custom start positions (#30). A start is `placement side`, FEN-style:
 * 9 ranks from rank 9 down to rank 1, digits for empty runs, upper case =
 * White, `z`/`Z` = Krishna, then `w` or `b` for the side to move.
 * Validation lives in Rust (`Game::from_start_fen`) so the UI, the AI
 * worker and restore all agree on what's legal.
 */
import { BOARD_SIZE, COLORS } from '../constants.js';
import { getWasm } from './wasm_boot.js';

export const START_FEN_KEY = 'shatrunz_start_fen';
export const STANDARD_START = 'rnbqkbznr/ppppppppp/9/9/9/9/9/PPPPPPPPP/RNBQKBZNR w';

/** The configured start, or null for the standard setup. */
export function getStartFen() {
    try {
        const v = (localStorage.getItem(START_FEN_KEY) || '').trim();
        return v && v !== STANDARD_START ? v : null;
    } catch { return null; }
}

export function setStartFen(fen) {
    const v = (fen || '').trim();
    if (!v || v === STANDARD_START) localStorage.removeItem(START_FEN_KEY);
    else localStorage.setItem(START_FEN_KEY, v);
}

/** null if `fen` is a valid start, else a human-readable reason. */
export function validateStartFen(fen) {
    try {
        getWasm().WasmGame.fromStartFen((fen || '').trim());
        return null;
    } catch (e) {
        return String(e?.message || e);
    }
}

/** The current board as a start string (for "Copy current position"). */
export function boardToStartFen(board, turn) {
    const ranks = [];
    for (let r = 0; r < BOARD_SIZE; r++) {
        let s = '';
        let empty = 0;
        for (let c = 0; c < BOARD_SIZE; c++) {
            const p = board[r][c];
            if (!p) { empty++; continue; }
            if (empty) { s += empty; empty = 0; }
            s += p.color === COLORS.WHITE ? p.type.toUpperCase() : p.type;
        }
        if (empty) s += empty;
        ranks.push(s);
    }
    return `${ranks.join('/')} ${turn === COLORS.BLACK ? 'b' : 'w'}`;
}
