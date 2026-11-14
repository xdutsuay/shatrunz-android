#!/usr/bin/env node
/**
 * Engine-vs-engine match: every opening is played twice with colours
 * swapped, at a fixed time per move, spread over worker threads.
 *
 *   node tools/match/match.mjs --a new --b base [--ms 100] [--openings 50]
 *        [--threads 8] [--persona material] [--out result.json]
 *
 * --a/--b name engines built by build_engine.sh (tools/match/engines/<name>).
 * Results are from A's point of view.
 */
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import os from 'node:os';
import { playGame, loadEngine } from './play.mjs';
import { eloFromWDL, formatElo } from './elo.mjs';

const here = dirname(fileURLToPath(import.meta.url));

if (isMainThread) {
    const args = Object.fromEntries(
        process.argv.slice(2).join(' ').split('--').filter(Boolean).map((s) => {
            const [k, ...v] = s.trim().split(/\s+/);
            return [k, v.join(' ') || true];
        }),
    );
    const a = args.a, b = args.b;
    if (!a || !b) { console.error('usage: match.mjs --a <engine> --b <engine> [--ms 100]'); process.exit(2); }
    const ms = Number(args.ms || 100);
    const threads = Number(args.threads || Math.min(8, os.cpus().length));
    const persona = args.persona || 'material';
    const openings = JSON.parse(readFileSync(join(here, 'openings.json'), 'utf8')).slice(0, Number(args.openings || 50));
    const dirs = { a: join(here, 'engines', a), b: join(here, 'engines', b) };
    for (const d of Object.values(dirs)) if (!existsSync(d)) { console.error(`missing engine ${d}; run build_engine.sh`); process.exit(2); }

    const jobs = [];
    openings.forEach((op, i) => { jobs.push({ i, op, aWhite: true }); jobs.push({ i, op, aWhite: false }); });
    const results = [];
    const tot = { w: 0, d: 0, l: 0 };
    const eng = { a: { moves: 0, depth: 0, nodes: 0, ms: 0 }, b: { moves: 0, depth: 0, nodes: 0, ms: 0 } };
    const t0 = Date.now();
    let next = 0, running = 0;
    await new Promise((resolve) => {
        const spawn = () => {
            if (next >= jobs.length) { if (running === 0) resolve(); return; }
            const job = jobs[next++];
            running++;
            const w = new Worker(fileURLToPath(import.meta.url), { workerData: { job, dirs, ms, persona } });
            w.once('message', (r) => {
                const aScore = r.result === '1/2-1/2' ? 0.5 : (r.result === '1-0') === job.aWhite ? 1 : 0;
                tot[aScore === 1 ? 'w' : aScore === 0 ? 'l' : 'd']++;
                const sa = job.aWhite ? r.stats.w : r.stats.b, sb = job.aWhite ? r.stats.b : r.stats.w;
                for (const [k, s] of [['a', sa], ['b', sb]]) for (const f of Object.keys(s)) eng[k][f] += s[f];
                results.push({ opening: job.i, aWhite: job.aWhite, result: r.result, reason: r.reason, plies: r.plies, moves: r.moves });
                process.stderr.write(`\r${results.length}/${jobs.length}  +${tot.w} =${tot.d} -${tot.l}   `);
            });
            w.once('exit', () => { running--; spawn(); });
            w.once('error', (e) => { console.error(e); });
        };
        for (let k = 0; k < threads; k++) spawn();
    });
    process.stderr.write('\n');
    const elo = eloFromWDL(tot.w, tot.d, tot.l);
    const per = (s) => ({
        avgDepth: +(s.depth / s.moves).toFixed(2),
        knps: Number.isFinite(s.nodes) ? Math.round(s.nodes / s.ms) : null,
        avgMs: Math.round(s.ms / s.moves),
    });
    const reasons = {};
    for (const r of results) { const k = r.reason.replace(/(White|Black)/, 'X'); reasons[k] = (reasons[k] || 0) + 1; }
    const summary = {
        a, b, ms, persona, games: results.length, w: tot.w, d: tot.d, l: tot.l,
        elo: Math.round(elo.elo), err: Math.round(elo.err), score: +elo.score.toFixed(3),
        engineA: per(eng.a), engineB: per(eng.b), reasons, wallSec: Math.round((Date.now() - t0) / 1000),
    };
    console.log(`${a} vs ${b} @ ${ms} ms/move, ${results.length} games: +${tot.w} =${tot.d} -${tot.l}  Elo ${formatElo(elo)} (95%)`);
    console.log(`  ${a}: depth ${summary.engineA.avgDepth}, ${summary.engineA.knps ?? 'n/a'} knps`);
    console.log(`  ${b}: depth ${summary.engineB.avgDepth}, ${summary.engineB.knps ?? 'n/a'} knps`);
    console.log(`  endings: ${JSON.stringify(reasons)}`);
    if (args.out) writeFileSync(args.out, JSON.stringify({ summary, results }, null, 1));
} else {
    const { job, dirs, ms, persona } = workerData;
    const A = loadEngine(dirs.a), B = loadEngine(dirs.b);
    const engines = job.aWhite ? { white: A, black: B } : { white: B, black: A };
    const r = playGame({ opening: job.op, engines, ms, persona });
    parentPort.postMessage(r);
}
