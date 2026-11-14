/**
 * The local engine must always get a time budget.
 *
 * Regression: with clocks off, jsBudgetMs() returned 0, so the search ran
 * to a fixed depth (level 3 => depth 6). From the start position that is
 * tens of seconds per move and far longer in the middlegame, so AI vs AI
 * sat on "Thinking..." forever.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { jsBudgetMs } from '../frontend/shared/engine_move.js';
import { thinkTimeMsForLevel, levelToJsDepth } from '../frontend/shared/persona.js';
import { COLORS } from '../frontend/constants.js';

describe('think budget', () => {
    it('is positive and grows with level', () => {
        let prev = 0;
        for (let lv = 1; lv <= 6; lv++) {
            const ms = thinkTimeMsForLevel(lv);
            assert.ok(ms > prev, `level ${lv} should think longer than level ${lv - 1}`);
            prev = ms;
        }
    });

    it('clamps out-of-range levels', () => {
        assert.equal(thinkTimeMsForLevel(-5), thinkTimeMsForLevel(1));
        assert.equal(thinkTimeMsForLevel(99), thinkTimeMsForLevel(6));
        assert.equal(levelToJsDepth(6), 8);
    });

    it('jsBudgetMs never returns 0 when clocks are off', () => {
        for (let lv = 1; lv <= 6; lv++) {
            assert.equal(jsBudgetMs(COLORS.WHITE, lv), thinkTimeMsForLevel(lv));
        }
        assert.ok(jsBudgetMs(COLORS.BLACK) > 0, 'falls back to the saved level');
    });
});
