/**
 * Worker/module imports must be relative to the importing file.
 *
 * The Android WebView serves the app from
 * https://appassets.androidplatform.net/assets/www/, so a root-absolute
 * import such as '/pkg/shatrunz_wasm.js' hits the offline-policy 403. In
 * the AI worker that failure was swallowed and every search fell back to
 * the UI thread, freezing the board for the whole think time.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const dir = new URL('../frontend/workers/', import.meta.url);

describe('worker import paths', () => {
    for (const name of readdirSync(dir).filter((f) => f.endsWith('.js'))) {
        it(`${name} has no root-absolute imports`, () => {
            const src = readFileSync(new URL(name, dir), 'utf8');
            assert.doesNotMatch(src, /import\s*\(\s*['"`]\//, 'use new URL(rel, import.meta.url)');
            assert.doesNotMatch(src, /from\s+['"`]\//, 'use a relative import');
        });
    }
});
