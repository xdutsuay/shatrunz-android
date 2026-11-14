/**
 * Module worker: loads wasm and runs persona searchBestMove off the UI thread.
 */

let ready = null;

async function ensureWasm() {
    if (ready) return ready;
    ready = (async () => {
        // Resolve beside this worker, not from the site root: the Android
        // WebView serves the app from /assets/www/, where '/pkg/...' is
        // blocked, which silently pushed every search onto the UI thread.
        const m = await import(new URL('../pkg/shatrunz_wasm.js', import.meta.url).href);
        if (typeof m.default === 'function') {
            await m.default();
        }
        return m;
    })();
    return ready;
}

self.onmessage = async (ev) => {
    const msg = ev.data || {};
    if (msg.type !== 'search') return;
    try {
        const m = await ensureWasm();
        const game = m.WasmGame.fromUciMoves(msg.uciMoves || []);
        const result = m.searchBestMove(game, msg.opts || {});
        self.postMessage({ type: 'result', result });
    } catch (err) {
        self.postMessage({
            type: 'error',
            message: err?.message || String(err),
        });
    }
};
