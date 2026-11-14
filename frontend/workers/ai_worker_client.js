/**
 * Main-thread client for the AI wasm worker.
 * Falls back by throwing so AIPlayer uses in-process searchBestMove.
 */

import { moveToUCI } from '../shared/uci.js';

function uciMovesFromGame(game) {
    if (!Array.isArray(game?.moveHistory)) return [];
    return game.moveHistory
        .map((h) => moveToUCI(h.from, h.to, h.movedPiece))
        .filter(Boolean);
}

let _worker = null;
let _workerBroken = false;

function getWorker() {
    if (_workerBroken) return null;
    if (_worker) return _worker;
    if (typeof Worker === 'undefined') {
        _workerBroken = true;
        return null;
    }
    try {
        _worker = new Worker(new URL('./ai_worker.js', import.meta.url), { type: 'module' });
        _worker.addEventListener('message', onWorkerMessage);
        _worker.addEventListener('error', onWorkerError);
        return _worker;
    } catch {
        _workerBroken = true;
        return null;
    }
}

let _nextId = 1;
/** id -> { resolve, reject } for searches the worker has not answered yet. */
const _pending = new Map();

function abortError() {
    const err = new Error('search cancelled');
    err.name = 'AbortError';
    return err;
}

export function isAbortError(err) {
    return err?.name === 'AbortError';
}

function onWorkerMessage(ev) {
    const data = ev.data || {};
    const entry = _pending.get(data.id);
    // Results for cancelled or unknown requests are dropped, never handed to
    // whichever search happens to be waiting now.
    if (!entry) return;
    _pending.delete(data.id);
    if (data.type === 'result') entry.resolve(data.result);
    else entry.reject(new Error(data.message || 'worker error'));
}

function onWorkerError(err) {
    _workerBroken = true;
    for (const entry of _pending.values()) entry.reject(err);
    _pending.clear();
}

/**
 * Stop any in-flight search right away. The worker is single-threaded and
 * cannot be interrupted mid-search, so it is terminated and lazily
 * recreated on the next search. Pending promises reject with AbortError.
 */
export function cancelWorkerSearch() {
    if (_pending.size === 0) return;
    for (const entry of _pending.values()) entry.reject(abortError());
    _pending.clear();
    if (_worker) {
        _worker.terminate();
        _worker = null;
    }
}

/**
 * @param {object} game
 * @param {object} searchOpts
 * @param {function} [_onSearchUpdate]
 * @returns {Promise<object>} searchBestMove result
 */
export function searchViaWorker(game, searchOpts, _onSearchUpdate) {
    const worker = getWorker();
    if (!worker) {
        return Promise.reject(new Error('ai worker unavailable'));
    }

    const id = _nextId++;
    const uciMoves = uciMovesFromGame(game);
    return new Promise((resolve, reject) => {
        _pending.set(id, { resolve, reject });
        worker.postMessage({ type: 'search', id, uciMoves, startFen: game?.startFen || null, opts: searchOpts });
    });
}
