# ShatrunZ agent guidance

## Source of truth

- `docs/rules.md` is the normative ShatrunZ variant specification.
- `crates/shatrunz-core` is the authoritative game-rules implementation. `crates/shatrunz-wasm` adapts it for the existing browser client; `frontend/game.js` is a UI-facing facade, not an independent rules authority.
- Android MVP sources are under `android/`. The UI is the packaged existing frontend inside a native WebView shell. Keep offline gameplay self-contained.
- Read `docs/mobile/ANDROID_PLAN.md`, `docs/mobile/ANDROID_PLAYBOOK.md`, and the matching `.agents/skills/*/SKILL.md` before architectural changes.

## Invariants

- Do not duplicate or silently change the 9×9 variant rules. Apply engine moves through the same rules core.
- Keep normal PvP/PvAI gameplay offline. The Android app must not gain Internet or broad storage permissions without an approved product change and a new security review.
- The Android JavaScript bridge is exposed only to packaged ShatrunZ pages; do not add remote content, arbitrary native methods, or file/content URL access.
- Preserve existing browser behavior when changing shared frontend code. Keep generated `frontend/pkg` assets out of Git; build them from Rust as documented.
- Keep PGN/FEN/UCI compatibility claims explicit. The app's 9×9 variant data is not ordinary standard-chess FEN/PGN.
- Do not copy DroidFish implementation or artwork. Use it only as a workflow reference; inspect its license before any code reuse.
- Do not publish, sign, upload, or submit the app without an explicit owner request.

## Build and handoff

- Android build: from `android/`, run `./gradlew.bat :app:assembleDebug` in PowerShell after installing documented Android/Rust prerequisites.
- WASM asset generation/sync: `:syncWebAssets` through the Android Gradle wrapper.
- Use separate Cursor agents for read-only audits and implementation slices with explicit file ownership. The lead integrates and resolves conflicts. See `.cursor/agents/` and `docs/mobile/ANDROID_AGENT_ROLES.md`.
- Before handing work back, state exact changed files, commands and outputs, remaining blockers, and whether a device/emulator was actually used.
