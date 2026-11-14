/**
 * Root-move repetition contempt (see frontend/shared/repetition.js).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { repetitionPenalty, seenCountAfter, CONTEMPT_CP } from '../frontend/shared/repetition.js';
import { Game } from '../frontend/game.js';

describe('repetition contempt', () => {
    it('is zero for new positions and when behind', () => {
        assert.equal(repetitionPenalty(0, 500), 0);
        assert.equal(repetitionPenalty(3, -400), 0);
    });

    it('grows with the count and with the advantage', () => {
        assert.equal(repetitionPenalty(1, 0), -CONTEMPT_CP.level);
        assert.equal(repetitionPenalty(2, 300), -2 * CONTEMPT_CP.ahead);
        assert.ok(repetitionPenalty(1, 300) < repetitionPenalty(1, 0));
    });

    it('counts earlier occurrences without changing the game', () => {
        const g = new Game();
        // Nc3 Nc7 Nb1 Nb9 returns to the start position.
        const cycle = [[{ r: 8, c: 1 }, { r: 6, c: 2 }], [{ r: 0, c: 1 }, { r: 2, c: 2 }],
            [{ r: 6, c: 2 }, { r: 8, c: 1 }], [{ r: 2, c: 2 }, { r: 0, c: 1 }]];
        for (const [from, to] of [...cycle, ...cycle.slice(0, 3)]) assert.ok(g.executeMove(from, to));
        const before = g.getHash();
        const plies = g.moveHistory.length;
        assert.ok(seenCountAfter(g, 'c7b9') >= 1, 'Nb9 repeats the start position');
        assert.equal(seenCountAfter(g, 'a7a6'), 0, 'a fresh pawn move is new');
        assert.equal(g.getHash(), before, 'probe must undo its move');
        assert.equal(g.moveHistory.length, plies);
    });
});
