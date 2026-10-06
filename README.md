# ShatrunZ Android

This is the standalone Android repository for ShatrunZ. It gives Android its own development and release lifecycle while keeping the ShatrunZ 9×9 rules and existing frontend available in the repository for a self-contained build.

The current MVP uses a native Java Activity and AndroidX `WebViewAssetLoader` to host the bundled HTML/CSS/JavaScript UI and Rust rules compiled to WebAssembly. Android-specific layout, board controls, persistence hooks, and the native Sharesheet bridge live here. This is a starting point for Android evolution, not a claim that the current board is a native Compose UI.

## Current Android MVP

- Offline PvP, PvAI, and AIvAI using the ShatrunZ Rust/WASM rules and local JavaScript AI strategies.
- 9×9 board with tap-to-select, legal-move highlights, undo, guarded new game, move history, and local resume.
- Board orientation and color preferences, a short Krishna rules explanation, and PGN text sharing.
- No account, ads, analytics, service calls, Internet permission, or broad storage permission.
- The service-backed C Engine and admin/ML workflows are excluded from the packaged Android experience.

The debug MVP runs from source but has not been released to Google Play. See [Android MVP status](docs/mobile/ANDROID_MVP_STATUS.md) and the [delivery playbook](docs/mobile/ANDROID_PLAYBOOK.md).

## Build

Requirements: JDK 17, Android SDK Platform 36 and Build Tools 35+, Rust 1.94.1 with `wasm32-unknown-unknown`, and `wasm-pack`.

From the repository root on Windows:

```powershell
.\scripts\build_android.ps1
```

On macOS/Linux, run `./gradlew :app:assembleDebug` from `android/`. Gradle builds `crates/shatrunz-wasm`, syncs `frontend/` into ignored Android assets, and packages the result. The generated `frontend/pkg` and APK outputs are not committed.

Install the debug APK on a connected device:

```sh
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

## Project map

- `android/` — Android Activity, WebView security boundary, resources, and Gradle build.
- `frontend/` — UI, mobile presentation, existing game controllers, and JavaScript AI.
- `crates/shatrunz-core/` — authoritative 9×9 game rules.
- `crates/shatrunz-wasm/` — browser/WASM adapter for the Rust core.
- `docs/rules.md` — normative variant specification.
- `docs/mobile/` — architecture, decisions, completion gates, and Cursor agent roles.
- `.agents/skills/` and `.cursor/agents/` — project skills and specialist review/implementation prompts.
- `UPSTREAM.md` — source snapshot and future synchronization policy.

## Development guidance

Read [`AGENTS.md`](AGENTS.md), [`docs/mobile/ANDROID_PLAN.md`](docs/mobile/ANDROID_PLAN.md), and the relevant skill before changing architecture or game behavior. Preserve the Rust core as the rules authority, keep offline play offline, and do not copy DroidFish code or artwork. Resolve ShatrunZ licensing and asset provenance before public distribution.
