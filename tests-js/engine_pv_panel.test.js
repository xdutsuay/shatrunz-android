import test from 'node:test';
import assert from 'node:assert/strict';
import { formatEngineScore, formatPvLine } from '../frontend/shared/engine_pv_panel.js';

test('engine score: pawns for normal scores, # for found mates', () => {
    assert.equal(formatEngineScore(130), '+1.3');
    assert.equal(formatEngineScore(-45), '-0.5');
    assert.equal(formatEngineScore(100003), '#+');
    assert.equal(formatEngineScore(-100002), '#−');
    assert.equal(formatEngineScore(null), '—');
});

test('engine line shows depth, nodes and best move', () => {
    const html = formatPvLine({ cp: 120, depth: 5, nodes: 412345, pv: ['e2e4'] });
    assert.match(html, /\+1\.2/);
    assert.match(html, /depth 5/);
    assert.match(html, /412k nodes/);
    assert.match(html, /e4/);
});
