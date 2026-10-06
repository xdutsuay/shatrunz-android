---
name: android-native-game-ui
description: Use when implementing ShatrunZ Android screens, WebView shell behavior, board touch interactions, adaptive layout, accessibility, or Android lifecycle handling.
---

# ShatrunZ Android UI

The first Android MVP packages the current HTML/CSS/JavaScript UI in a native Activity using AndroidX `WebViewAssetLoader`. Follow `android/README.md` and `docs/mobile/ANDROID_ARCHITECTURE.md`.

- Keep the Rust/WASM rules source authoritative. UI highlights and touch handling are affordances; they do not decide legality.
- Serve local packaged assets under the appassets HTTPS origin. Do not switch to `file://`, `data:` URLs, remote HTML, or a permissive mixed-content setting.
- Keep WebView navigation/subresources restricted to packaged assets. Expose only narrow, bounded JavaScript bridge operations needed by the user-facing flow.
- Design the 9×9 board for narrow phones, landscape, tablets, large text, and system insets. Keep frequent actions reachable and make selection feedback distinguishable beyond color alone.
- Preserve the existing browser experience when adapting shared frontend files. Avoid hard-coded Android-only URLs or platform checks that change the website path.
- Ask before adding account, analytics, network, broad storage, native engine, or cloud behavior.

For a future native Compose/Swift UI, preserve the domain contract and bind to Rust; do not move rule logic into composables or duplicate it in Kotlin/Swift.
