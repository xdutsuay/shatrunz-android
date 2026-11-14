#!/usr/bin/env node
/**
 * Regenerate tools/match/openings.json: seeded random 8-ply walks from the
 * start, kept only if a depth-3 search calls the position roughly level
 * (|score| < 80 cp), so neither colour starts from a won game.
 *   node tools/match/make_openings.mjs [count=100] [engineDir=frontend/pkg-node]
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { loadEngine } from './play.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const count = Number(process.argv[2] || 100);
const m = loadEngine(resolve(process.argv[3] || join(here, '../../frontend/pkg-node')));
let seed = 20261114;
const rand = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 2 ** 32);
const out = [], seen = new Set();
while (out.length < count) {
    const g = m.WasmGame.fromUciMoves([]);
    const line = [];
    for (let p = 0; p < 8; p++) {
        const ms = g.allLegalUci();
        if (!ms.length) break;
        const u = ms[Math.floor(rand() * ms.length)];
        g.executeUci(u); line.push(u);
    }
    if (line.length < 8 || g.checkStatus().over || seen.has(line.join(' '))) continue;
    const r = m.searchBestMove(g, { color: g.turn(), persona: 'material', depth: 3, rootBonuses: {} });
    if (Math.abs(r.bestScore) >= 80) continue;
    seen.add(line.join(' '));
    out.push(line);
}
writeFileSync(join(here, 'openings.json'), JSON.stringify(out).replace(/\],\[/g, '],\n[') + '\n');
console.log(`wrote ${out.length} openings`);
