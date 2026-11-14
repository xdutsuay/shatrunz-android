import { COLORS } from '../constants.js';

/**
 * Split the engine's status line ("CHECKMATE! White Wins", "Draw by
 * Repetition") into a big headline and a reason for the game-over card.
 */
export function gameOverHeadline(status) {
    const msg = status?.msg || '';
    let title = 'Draw';
    if (status?.winner === COLORS.WHITE) title = 'White wins';
    else if (status?.winner === COLORS.BLACK) title = 'Black wins';
    let reason = msg;
    if (/checkmate/i.test(msg)) reason = 'by checkmate';
    else if (/stalemate/i.test(msg)) reason = 'by stalemate';
    else if (/repetition/i.test(msg)) reason = 'by threefold repetition';
    else if (/adjudicated/i.test(msg)) reason = 'on material after 240 moves';
    return { title, reason };
}
