# Engine-vs-engine match harness

Measures whether an engine change makes the AI stronger, using the same
wasm search, per-move budget, repetition contempt and game-end rules as the
app's AI vs AI mode.

```sh
# build two engines (any git ref, or the uncommitted working tree)
tools/match/build_engine.sh origin/main base
tools/match/build_engine.sh WORKTREE new
# 100 openings x 2 colours = 200 games at 100 ms/move on 8 threads (~8 min)
node tools/match/match.mjs --a new --b base --ms 100 --openings 100 --out /tmp/new-vs-base.json
```

Output, from A's point of view:

```
new vs base @ 100 ms/move, 200 games: +87 =21 -92  Elo -9 ± 46 (95%)
  new: depth 3.42, 311 knps
  base: depth 3.42, n/a knps
```

- **Openings** (`openings.json`): 100 seeded random 8-ply walks that a depth-3
  search rates as roughly level. Each is played twice with colours swapped, so
  an unbalanced opening cancels out. Regenerate with `make_openings.mjs`.
- **Elo ± error**: 95% interval from the W/D/L variance (`elo.mjs`). An A/A
  match of an engine against itself should land within the error bar of 0.
- **depth / knps**: average depth completed per move and thousands of search
  nodes per second. Engines built before node counting show `n/a`.
- Time-limited search is not deterministic, so two runs differ slightly.
  Don't run other CPU-heavy work during a match: it skews the timings.
- Games the rules never end are stopped at 320 plies and scored as draws.
