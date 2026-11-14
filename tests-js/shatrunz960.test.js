import test from 'node:test';
import assert from 'node:assert/strict';

import { Game } from '../frontend/game.js';
import { validateStartFen } from '../frontend/shared/start_position.js';
import {
    SHATRUNZ960_COUNT, SHATRUNZ960_STANDARD_ID, backRankFor, idForStartFen, startFenFor,
} from '../frontend/shared/shatrunz960.js';

test('#4671 is the standard Shatrunz setup', () => {
    assert.equal(backRankFor(SHATRUNZ960_STANDARD_ID), 'rnbqkbznr');
    assert.equal(startFenFor(SHATRUNZ960_STANDARD_ID), 'rnbqkbznr/ppppppppp/9/9/9/9/9/PPPPPPPPP/RNBQKBZNR w');
});

test('all 8400 starts are distinct and follow the 960 rules', () => {
    const seen = new Set();
    for (let id = 0; id < SHATRUNZ960_COUNT; id++) {
        const r = backRankFor(id);
        assert.equal([...r].sort().join(''), 'bbknnqrrz', r);
        const bishops = [...r].flatMap((p, i) => (p === 'b' ? [i % 2] : []));
        assert.notEqual(bishops[0], bishops[1], `${id} bishops same colour`);
        const k = r.indexOf('k');
        assert.ok(r.indexOf('r') < k && k < r.lastIndexOf('r'), `${id} king not between rooks`);
        seen.add(r);
    }
    assert.equal(seen.size, SHATRUNZ960_COUNT);
});

test('number round-trips, and sampled starts are legal games', () => {
    for (let id = 0; id < SHATRUNZ960_COUNT; id += 97) {
        const fen = startFenFor(id);
        assert.equal(idForStartFen(fen), id);
        assert.equal(validateStartFen(fen), null, fen);
        const g = new Game({ fen });
        assert.ok(g.hasLegalMoves('w'));
    }
    assert.equal(idForStartFen('4k4/9/9/9/9/9/9/9/4K4 w'), null);
});
