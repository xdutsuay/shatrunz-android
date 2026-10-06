# ShatrunZ Android MVP

This is a native Android app shell that packages ShatrunZ's existing web UI and Rust rules engine compiled to WebAssembly. It is deliberately a thin adapter: game rules remain in `crates/shatrunz-core`, and the Android app does not contain a second chess implementation.

## MVP scope

- Offline local two-player, player-vs-AI, and AI-vs-AI games on the 9×9 ShatrunZ board.
- Existing Rust/WASM rules and the local JavaScript AI strategies for PvAI and AIvAI.
- Tap a piece, then tap a highlighted destination; undo and guarded new-game actions.
- Move history, local completed-game history, Android share sheet for PGN, and active-game resume from local storage.
- Responsive portrait/landscape layout, a short Krishna rules explainer, and a small AI-strength control.
- No account, network service, analytics, ads, external engine download, or requested Android permission.

This is a reviewable MVP build, not a Google Play release candidate. It does not include online play, admin, service-backed C-engine calls, clocks as a supported Android feature, a native Compose board, cloud sync, or a first-run tutorial.

## Build requirements

- Android Studio or Android SDK command-line tools with Android SDK Platform 36 and Build Tools 35.0.0 or newer.
- JDK 17.
- Rust 1.94.1 with `wasm32-unknown-unknown` and `wasm-pack`.
- `wasm-pack` on `PATH`, or set `WASM_PACK` to its executable, so Gradle can compile the shared Rust rules to WASM.

From the repository root:

```powershell
.\scripts\build_android.ps1
```

The helper uses the ignored repo-local `.tooling` SDK/Rust toolchain when present, while respecting `ANDROID_HOME`, `RUSTUP_HOME`, `CARGO_HOME`, and `WASM_PACK` supplied by your environment. It then runs the checked-in Gradle wrapper. You can also build directly from `android/` with `./gradlew :app:assembleDebug` on macOS/Linux or `.\gradlew.bat :app:assembleDebug` on Windows.

The Gradle `syncWebAssets` task builds WASM from `crates/shatrunz-wasm` and then copies the complete `frontend` tree, including generated `frontend/pkg`, into app assets before Android packaging. The MVP skips the optional Binaryen `wasm-opt` pass; release work should measure and decide whether to add it. Run `./gradlew :syncWebAssets` (macOS/Linux) or `.\gradlew.bat :syncWebAssets` (Windows) from `android/` to refresh only the web assets. Generated `frontend/pkg` and APK outputs are ignored by Git.

Debug APK output:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

Install on a connected device with `adb install -r android/app/build/outputs/apk/debug/app-debug.apk`.

## Boundaries

- `WebViewAssetLoader` serves packaged assets from `https://appassets.androidplatform.net`; the app has no `INTERNET` permission and rejects non-packaged navigation/subresources.
- File/content URL access and mixed content are disabled. The JavaScript bridge only shares bounded plain text through Android's Sharesheet.
- Use the existing `docs/rules.md` as the normative variant rule source. UCI-style move strings are internal replay data; do not treat ordinary FEN/PGN as lossless for the variant without compatibility metadata.
- The application ID `com.xdutsuay.shatrunz` and current target SDK are MVP values. Confirm the permanent Play identity, signing, target SDK, policy declarations, third-party notices, and privacy text before a store submission.
- WebView localStorage is the MVP save store. Before multi-device sync or long-term release, move to a versioned repository format with explicit migrations and lifecycle/backup behavior.

## Reusable build choice

For a later native Android or iOS interface, keep Rust as the single rule authority and expose a stable, platform-neutral API from `shatrunz-core`. Add JNI/UniFFI (or another measured binding) behind an adapter when native UI work is approved; do not reimplement rules in Kotlin/Swift. The current wasm-bindgen interface is a browser boundary, not yet a cross-platform native ABI.
