import { BOARD_SIZE, COLORS, PIECES, SYMBOLS, WEIGHTS } from '../constants.js';

// Pieces each side starts with on the 9×9 board (Krishna can't be captured).
const START = { p: 9, r: 2, n: 2, b: 2, q: 1 };
const ORDER = ['q', 'r', 'b', 'n', 'p'];

/**
 * What each side has taken, and who is ahead in material, from the board
 * alone (so undo, replay and restored games are always right).
 * Promotions can leave a side with "more than it started with"; that just
 * counts as nothing captured of that type.
 * @returns {{ w: string[], b: string[], diffPawns: number }} `w` = black
 *   pieces White has captured (as symbols), `b` = white pieces Black has
 *   captured, `diffPawns` > 0 when White is ahead.
 */
export function capturedSummary(board) {
    const have = { w: {}, b: {} };
    let diff = 0;
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            const p = board[r]?.[c];
            if (!p || p.type === PIECES.KING || p.type === PIECES.KRISHNA) continue;
            have[p.color][p.type] = (have[p.color][p.type] || 0) + 1;
            diff += (p.color === COLORS.WHITE ? 1 : -1) * WEIGHTS[p.type];
        }
    }
    const takenFrom = (color) => ORDER.flatMap((t) =>
        Array(Math.max(0, START[t] - (have[color][t] || 0))).fill(SYMBOLS[color][t]));
    return { w: takenFrom(COLORS.BLACK), b: takenFrom(COLORS.WHITE), diffPawns: Math.round(diff / 100) };
}
