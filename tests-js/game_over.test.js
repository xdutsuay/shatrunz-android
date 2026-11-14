import test from 'node:test';
import assert from 'node:assert/strict';
import { COLORS } from '../frontend/constants.js';
import { gameOverHeadline } from '../frontend/shared/game_over.js';

test('game-over headline names the winner and the reason', () => {
    assert.deepEqual(gameOverHeadline({ over: true, winner: COLORS.WHITE, msg: 'CHECKMATE! White Wins' }),
        { title: 'White wins', reason: 'by checkmate' });
    assert.deepEqual(gameOverHeadline({ over: true, winner: null, msg: 'Draw by Repetition' }),
        { title: 'Draw', reason: 'by threefold repetition' });
    assert.equal(gameOverHeadline({ over: true, winner: COLORS.BLACK, msg: 'x' }).title, 'Black wins');
});
