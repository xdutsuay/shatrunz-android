/**
 * Repetition "contempt" for the AI's root moves.
 *
 * The search only sees the board, not the game's history, so a move that
 * repeats an earlier position looks exactly as good as it did last time.
 * Two engines that both like the same squares then shuffle (Qg4/Qi4,
 * Ra9/Rb9 ...) until the 5-fold rule calls it a draw, even when one side is
 * clearly better. This adds a per-move penalty, in centipawns, for moves
 * that recreate a position already seen, scaled by how often it was seen
 * and by whether the mover has anything to play for.
 */

/** cp penalty per earlier occurrence, by the mover's material situation. */
export const CONTEMPT_CP = { ahead: 60, level: 20, behind: 0 };

/**
 * @param {number} seenCount  times the resulting position already occurred
 * @param {number} moverMaterialCp  material balance from the mover's side
 * @returns {number} a bonus <= 0 to add to the move's root score
 */
export function repetitionPenalty(seenCount, moverMaterialCp) {
    if (!seenCount) return 0;
    let per = CONTEMPT_CP.level;
    if (moverMaterialCp >= 100) per = CONTEMPT_CP.ahead;
    else if (moverMaterialCp <= -100) per = CONTEMPT_CP.behind;
    return per ? -per * seenCount : 0;
}

/**
 * How often the position after `uci` has already occurred in `game`.
 * Plays the move on the wasm game and undoes it; the JS mirror is untouched.
 */
export function seenCountAfter(game, uci) {
    const w = game?._wasm;
    if (!w || !game.positionHistory || !w.executeUci(uci)) return 0;
    const key = w.positionKey();
    w.undoLastMove();
    return game.positionHistory[key] || 0;
}
