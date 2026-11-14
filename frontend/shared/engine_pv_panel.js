import { COLORS } from '../constants.js';
import { formatEvalPawns } from './persona.js';

const files = 'abcdefghi';

function uciToSan(uci) {
    if (!uci || uci.length < 4) return uci || '';
    const fromC = files.indexOf(uci[0]);
    const fromR = 9 - parseInt(uci[1], 10);
    const toC = files.indexOf(uci[2]);
    const toR = 9 - parseInt(uci[3], 10);
    if (fromC < 0 || toC < 0) return uci;
    const toSq = `${files[toC]}${9 - toR}`;
    const cap = uci.length > 4;
    return cap ? `x${toSq}` : toSq;
}

// Search scores at or beyond this are "a forced mate was found" (the Rust
// search returns MATE_SCORE = 100000 plus remaining depth), not material.
const MATE_THRESHOLD = 50000;

/** Score from the thinking side's point of view: "+1.3", or "#+" / "#-" for a found mate. */
export function formatEngineScore(cp) {
    if (cp == null || Number.isNaN(cp)) return '—';
    if (cp >= MATE_THRESHOLD) return '#+';
    if (cp <= -MATE_THRESHOLD) return '#−';
    return formatEvalPawns(cp);
}

function formatNodes(n) {
    if (!n) return '';
    if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M nodes`;
    if (n >= 1e3) return `${Math.round(n / 1e3)}k nodes`;
    return `${n} nodes`;
}

export function formatPvLine(evt) {
    const cp = formatEngineScore(evt.cp);
    const depth = evt.depth != null ? `depth ${evt.depth}` : '';
    const pv = Array.isArray(evt.pv) ? evt.pv.map(uciToSan).join(' ') : (evt.pvSan || '');
    const nodes = formatNodes(evt.nodes);
    const mate = Math.abs(evt.cp ?? 0) >= MATE_THRESHOLD ? ' engine-pv-mate' : '';
    return `<div class="engine-pv-line" title="Engine score for the side that moved, search depth and best move">`
        + `<span class="engine-pv-score${mate}">${cp}</span>`
        + `<span class="engine-pv-depth">${depth}</span>`
        + (nodes ? `<span class="engine-pv-nodes">${nodes}</span>` : '')
        + `<span class="engine-pv-moves">${pv}</span></div>`;
}

export function clearEnginePv(side) {
    const el = side === COLORS.WHITE
        ? document.getElementById('engine-pv-bottom')
        : document.getElementById('engine-pv-top');
    if (el) el.innerHTML = '';
    resetPvThrottle();
}

export function renderEnginePv(side, events) {
    const el = side === COLORS.WHITE
        ? document.getElementById('engine-pv-bottom')
        : document.getElementById('engine-pv-top');
    if (!el) return;
    const lines = (events || []).slice(-3);
    el.innerHTML = lines.map(formatPvLine).join('');
}

const lastPvPaintAt = { w: 0, b: 0 };
const PV_THROTTLE_MS = 200;

export function handleSearchUpdate(side, evt) {
    if (!evt || evt.type !== 'info') return;
    const key = side === COLORS.WHITE ? 'w' : 'b';
    const now = performance.now();
    // The final line (the move that will actually be played) always paints,
    // bypassing the throttle, so the panel ends on the engine's real choice.
    if (!evt.final && now - lastPvPaintAt[key] < PV_THROTTLE_MS) return;
    lastPvPaintAt[key] = now;

    const el = side === COLORS.WHITE
        ? document.getElementById('engine-pv-bottom')
        : document.getElementById('engine-pv-top');
    if (!el) return;
    const row = formatPvLine(evt);
    const existing = el.querySelectorAll('.engine-pv-line');
    if (existing.length >= 3) {
        existing[0].remove();
    }
    el.insertAdjacentHTML('beforeend', row);
}

export function resetPvThrottle() {
    lastPvPaintAt.w = 0;
    lastPvPaintAt.b = 0;
}
