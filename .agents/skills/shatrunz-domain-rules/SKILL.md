---
name: shatrunz-domain-rules
description: Use when changing or reviewing ShatrunZ rules, game state, legal moves, results, or serialized positions. The Rust core and docs/rules.md are authoritative.
---

# ShatrunZ domain work

Read `docs/rules.md` and inspect `crates/shatrunz-core` before changing behavior. The game is a 9×9 chess variant with a Krishna piece; it is not standard chess.

- Keep one rules authority in `shatrunz-core`. Do not reimplement legality in Android UI, JavaScript, engine adapters, or MCP tools.
- Preserve all state needed for move legality, replay, undo, and persistence. Validate imported or engine-provided moves through the core.
- Keep platform, storage, networking, UI, and engine lifecycles outside the core crate.
- Treat `frontend/game.js` as a facade over WASM. If its mirror diverges, repair the adapter or core; do not create another rules source.
- Update the normative rules document and compatibility notes when behavior changes. Use established project tests for rule changes when the task authorizes testing.
- If a rules detail is unclear, report the uncertainty instead of borrowing standard chess behavior.

For Android architecture and persistence boundaries, also read `docs/mobile/ANDROID_ARCHITECTURE.md`.
