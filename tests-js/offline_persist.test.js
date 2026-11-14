/**
 * The offline Android app must not call the website backend at game end.
 */
import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { persistGameAndBrains } from '../frontend/shared/brain_utils.js';
import { isOfflineApp } from '../frontend/shared/platform.js';

const prevWindow = globalThis.window;
const prevFetch = globalThis.fetch;
afterEach(() => { globalThis.window = prevWindow; globalThis.fetch = prevFetch; });

const pgnManager = {
    getGame: () => ({ white: 'w', black: 'b', moves: [] }),
    exportPGN: () => '',
    getHelpSummary: () => ({}),
};

describe('offline persistence', () => {
    it('detects the Android shell', () => {
        globalThis.window = { location: { search: '?mode=cvc&platform=android' } };
        assert.equal(isOfflineApp(), true);
        globalThis.window = { location: { search: '?mode=cvc' } };
        assert.equal(isOfflineApp(), false);
        globalThis.window = { AndroidApp: {}, location: { search: '' } };
        assert.equal(isOfflineApp(), true);
    });

    it('makes no network calls in the Android app', async () => {
        let calls = 0;
        globalThis.fetch = async () => { calls++; return { json: async () => ({}) }; };
        globalThis.window = { AndroidApp: {}, location: { search: '' } };
        await persistGameAndBrains({ pgnManager, uciMoveHistory: [], pgnResult: '1-0', mode: 'hvh' });
        assert.equal(calls, 0);
    });

    it('still saves to the backend on the website', async () => {
        let calls = 0;
        globalThis.fetch = async () => { calls++; return { json: async () => ({}) }; };
        globalThis.window = { location: { search: '?mode=hvh' } };
        await persistGameAndBrains({ pgnManager, uciMoveHistory: [], pgnResult: '1-0', mode: 'hvh' });
        assert.ok(calls >= 2, 'save-game and analyze-game');
    });
});
