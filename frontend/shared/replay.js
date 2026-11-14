import { Game } from '../game.js';
import { parseUCIMove } from './uci.js';

export function replayGameFromUci(uciMoves, startFen = null) {
    let game;
    try {
        game = new Game({ fen: startFen });
    } catch (e) {
        return { game: null, uciMoveHistory: [], error: `Invalid start position: ${e?.message || e}` };
    }
    const history = [];

    for (const uci of uciMoves) {
        const parsed = parseUCIMove(uci);
        if (!parsed) {
            return { game: null, uciMoveHistory: [], error: `Invalid UCI: ${uci}` };
        }
        try {
            game.executeMove(parsed.from, parsed.to);
        } catch (e) {
            return { game: null, uciMoveHistory: [], error: `Illegal replay move: ${uci}` };
        }
        history.push(uci);
    }

    return { game, uciMoveHistory: history, error: null };
}
