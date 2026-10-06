# ShatrunZ Android MVP plan

**Status:** standalone repository `xdutsuay/shatrunz-android`; debug APK built, installed, and inspected on `SM_E366B`; board startup and system-bar insets are fixed, gameplay acceptance is pending.
**Purpose:** scope and acceptance baseline for Android work in Cursor.
**Reference:** [DroidFish](https://github.com/peterosterlund2/droidfish) for feature discovery only.

## Product goal

Make ShatrunZ easy to try on Android while preserving the existing variant rules and keeping local play offline. DroidFish is a mature chess app reference for workflows such as game modes, move navigation, settings, and PGN handling. ShatrunZ should use its own visual identity and keep its distinctive rules explicit.

## Source audit and decisions

- ShatrunZ is a 9×9 chess variant. [`docs/rules.md`](../rules.md) is the rule specification; Krishna (`Z`) moves one square like a king to empty squares only, cannot capture or be captured, and does not give check. Castling and promotion have 9×9-specific behavior.
- `crates/shatrunz-core` is the Rust game kernel. `crates/shatrunz-wasm` binds it for the browser, and `frontend/game.js` is its UI facade. The JS `frontend/rules.js` still helps present legal destinations; the core remains the transition authority.
- The existing frontend has local PvP, PvAI, AIvAI, admin, history/replay, and a JS/WASM AI path. The C/UCI engine and some admin/ML flows rely on a local service and are excluded from Android MVP.
- `frontend/pkg` is generated and ignored by Git. Android Gradle builds the web/WASM assets before packaging.
- The repo already has a local developer MCP server configured by `.mcp.json`; do not add a second MCP for Android.
- No root `LICENSE` file was present in the inspected checkout. Establish project licensing and asset provenance before any public distribution. Do not copy DroidFish code or art.
- Android implementation choice: a native Java Activity and AndroidX `WebViewAssetLoader` host the existing UI and Rust/WASM rules. This reuses real ShatrunZ behavior quickly; it is a deliberate MVP bridge, not the final native UI architecture.
- Current Android values are provisional: `com.xdutsuay.shatrunz`, min API 26, target/compile API 36, version 0.1.0. Confirm the permanent package name and signing owner before release.

## MVP included

- Local PvP, PvAI, and AIvAI using the existing JavaScript strategies; 9×9 board, tap-select-tap moves, turn/result status, undo, guarded new game, and existing move/review list.
- ShatrunZ Krishna explainer and a small AI strength control.
- Active-game autosave/resume, per-mode local settings/history, and PGN-text sharing through Android's Sharesheet.
- Offline launch; packaged Rust/WASM and JS AI only. No Android network or broad storage permission.
- A responsive board-first Android layout for portrait/landscape and system insets.

## Explicitly deferred

Online multiplayer, cloud sync, accounts, ads/analytics, admin, service-backed C-engine calls, puzzles, external chess-platform integration, native Compose board, PGN/FEN import, clocks as an Android-supported feature, and a full preference screen. Add each only after an owner-approved product slice.

## Architecture and portability

```text
Android Activity + WebViewAssetLoader
   └── packaged frontend UI (HTML/CSS/JS) + generated WASM
          └── wasm-bindgen adapter
                 └── shatrunz-core (authoritative rules)

Existing native/service integrations: separate, optional adapters
Future Android/iOS native UIs: call the same Rust domain through a stable FFI
```

Use the browser UI for the first Android vertical slice. Keep its Android-specific layout and share affordance small and guarded by the native bridge. If a native Compose/iOS UI is later justified, extract a stable platform-neutral Rust API and evaluate JNI/UniFFI. Do not reimplement game rules in Kotlin, Swift, or WebView UI.

## Delivery gates

Percentages in [the playbook](ANDROID_PLAYBOOK.md) are earned by verified exit criteria, not lines of code. The **40% playable-alpha gate is not passed** until the built APK is installed and exercised on an emulator/device.

1. Source/rules audit and reuse map: done.
2. Scope and architecture: implemented as a local-first MVP; permanent package identity and licensing remain open.
3. Android app shell, asset task, local game resume, and mobile UI: source written; debug APK build and packaged WASM verified. A premature module import that stopped WASM startup has been fixed; Android now loads the UI module only after WASM is ready.
4. Install/run, first-game usability, lifecycle restoration, and accessibility: APK installation, 81-square rendering, and status-bar-safe screen layout are verified. PvP/PvAI/AIvAI interactions, lifecycle, portrait/landscape, and accessibility still need device acceptance.
5. Beta/release compliance: later; there is no store submission authorization in this task.

## Acceptance for playable alpha

- `:app:assembleDebug` succeeds from a clean checkout with the documented Rust/Android dependencies.
- PvP, PvAI, and AIvAI launch without a network and use the ShatrunZ 9×9 rules; the human can make and undo legal moves in human-play modes.
- A started game survives Activity/process recreation and resumes with its saved move list; an invalid save is rejected safely.
- Reset asks before discarding a live game. PGN sharing opens the Android Sharesheet.
- Android manifest requests no unnecessary permission; WebView loads only packaged app assets, rejects remote URLs, and has file/content URL access disabled.
- Board and controls remain usable in portrait and landscape, including system bars and narrow screens; accessibility still needs physical/emulator review.
- Browser play keeps working after shared frontend changes.

## Cursor handoff

Open this repository in Cursor and read `AGENTS.md`, this plan, the playbook/status docs, and the relevant `.agents/skills` entry. Start by checking the working tree and toolchain. Build the APK before claiming the MVP is shipped. Split later work by subsystem and use the read-only reviewer agents in `.cursor/agents`; the Cursor lead owns integration and user decisions.
