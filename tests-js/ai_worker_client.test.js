/**
 * Worker client: each search gets its own answer, and cancel really cancels.
 *
 * Regressions: (1) every pending search listened to every worker message, so
 * after Stop -> Start the new search resolved with the OLD position's move
 * ("Illegal move rejected — auto-play stopped"); (2) Stop let the old search
 * finish and its move was still played.
 */
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

class FakeWorker {
    static instances = [];
    constructor() {
        this.listeners = { message: [], error: [] };
        this.posted = [];
        this.terminated = false;
        FakeWorker.instances.push(this);
    }
    addEventListener(type, fn) { this.listeners[type].push(fn); }
    postMessage(msg) { this.posted.push(msg); }
    terminate() { this.terminated = true; }
    reply(data) { for (const fn of this.listeners.message) fn({ data }); }
}

let client;
before(async () => {
    globalThis.Worker = FakeWorker;
    client = await import('../frontend/workers/ai_worker_client.js');
});

describe('ai_worker_client', () => {
    it('routes results by request id and drops unknown ids', async () => {
        const a = client.searchViaWorker({ moveHistory: [] }, { depth: 1 });
        const b = client.searchViaWorker({ moveHistory: [] }, { depth: 2 });
        const w = FakeWorker.instances.at(-1);
        const [idA, idB] = w.posted.map((m) => m.id);
        assert.notEqual(idA, idB);
        w.reply({ type: 'result', id: 9999, result: { uci: 'zzzz' } }); // stale: ignored
        w.reply({ type: 'result', id: idB, result: { uci: 'b' } });
        w.reply({ type: 'result', id: idA, result: { uci: 'a' } });
        assert.equal((await a).uci, 'a');
        assert.equal((await b).uci, 'b');
    });

    it('cancelWorkerSearch rejects pending with AbortError and terminates the worker', async () => {
        const p = client.searchViaWorker({ moveHistory: [] }, { depth: 6 });
        const w = FakeWorker.instances.at(-1);
        client.cancelWorkerSearch();
        await assert.rejects(p, (err) => client.isAbortError(err));
        assert.equal(w.terminated, true);
        // Next search gets a fresh worker.
        client.searchViaWorker({ moveHistory: [] }, { depth: 1 });
        assert.notEqual(FakeWorker.instances.at(-1), w);
    });

    it('cancel with nothing pending keeps the warm worker', () => {
        const before = FakeWorker.instances.at(-1);
        before.reply({ type: 'result', id: before.posted.at(-1).id, result: {} });
        client.cancelWorkerSearch();
        assert.equal(before.terminated, false);
    });
});
