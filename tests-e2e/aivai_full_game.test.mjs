/**
 * End-to-end: AI vs AI plays a whole game in a real browser.
 *
 * Unit tests can't catch "the board sits on Thinking... forever" or "the UI
 * thread froze": those only show up when the real page, worker and wasm run
 * together. This serves the repo root (so the app lives under /frontend/,
 * like the Android asset path, and root-absolute URLs break the same way),
 * forces the Android code path, and plays fast moves until the game ends.
 *
 * Needs Chrome/Chromium: set CHROME_PATH, or it tries common locations and
 * skips if none is found. Run: npm run test:e2e
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const TYPES = {
    '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
    '.css': 'text/css', '.wasm': 'application/wasm', '.json': 'application/json',
};

function findChrome() {
    const candidates = [
        process.env.CHROME_PATH,
        '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/opt/google/chrome/chrome',
        '/usr/bin/chromium', '/usr/bin/chromium-browser',
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    ];
    return candidates.find((p) => p && existsSync(p));
}

function serve() {
    const server = createServer(async (req, res) => {
        const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname));
        try {
            const body = await readFile(join(ROOT, path));
            res.writeHead(200, { 'Content-Type': TYPES[extname(path)] || 'application/octet-stream' });
            res.end(body);
        } catch {
            res.writeHead(404).end(); // like the Android shell: no backend here
        }
    });
    return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

const chrome = findChrome();

test('AI vs AI plays to a result without freezing the UI', { skip: !chrome && 'no Chrome found', timeout: 300_000 }, async () => {
    const { default: puppeteer } = await import('puppeteer-core');
    const server = await serve();
    const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--no-sandbox'] });
    try {
        const page = await browser.newPage();
        const errors = [];
        page.on('pageerror', (e) => errors.push(e.message));
        page.on('dialog', (d) => d.accept());
        const url = `http://127.0.0.1:${server.address().port}/frontend/play.html?mode=cvc&platform=android`;
        await page.goto(url, { waitUntil: 'networkidle0' });
        // Fastest settings: level 1, 50 ms per move (also the inter-ply delay).
        await page.evaluate(() => {
            localStorage.clear();
            localStorage.setItem('shatrunz_ai_level', '1');
            localStorage.setItem('shatrunz_think_time_ms', '50');
        });
        await page.reload({ waitUntil: 'networkidle0' });

        await page.evaluate(() => {
            // Longest gap between 50 ms ticks = longest main-thread stall.
            window.__maxGap = 0;
            window.__slides = 0;
            let last = performance.now();
            setInterval(() => {
                const now = performance.now();
                window.__maxGap = Math.max(window.__maxGap, now - last);
                last = now;
                // Piece slides (#27) run while the game plays at full speed.
                window.__slides = Math.max(window.__slides,
                    document.getAnimations().filter((a) => a.effect?.target?.classList?.contains('piece')).length);
            }, 50);
            document.getElementById('start-auto').click();
        });

        // Game over == auto-play stopped on its own (Start is enabled again).
        await page.waitForFunction(
            () => !document.getElementById('start-auto').disabled,
            { timeout: 240_000, polling: 1000 },
        );
        const result = await page.evaluate(() => ({
            status: document.getElementById('status').innerText,
            moves: document.getElementById('move-list').innerText,
            maxGap: Math.round(window.__maxGap),
            slides: window.__slides,
        }));

        assert.deepEqual(errors, [], 'no uncaught page errors');
        assert.match(result.status, /CHECKMATE|Draw|Stalemate|Adjudicated/, `game should end with a result, got "${result.status}"`);
        assert.doesNotMatch(result.status, /could not find a move|Illegal move/);
        assert.ok(result.maxGap < 1500, `UI thread stalled ${result.maxGap} ms`);
        assert.ok(result.slides > 0, 'moved pieces should slide into place');
        console.log(`e2e: "${result.status}", longest UI stall ${result.maxGap} ms`);
    } finally {
        await browser.close();
        server.close();
    }
});
