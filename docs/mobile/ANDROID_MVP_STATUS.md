# Android MVP status

**Repository:** `xdutsuay/shatrunz-android`
**Status:** debug APK builds and installs on a physical Android device; board startup and Android system-bar overlap are fixed, gameplay acceptance is pending.
**Last updated:** 6 October 2026.

## Implemented in source

- Java Activity with appassets-backed `WebViewAssetLoader`, app-local navigation, JavaScript/DOM storage, no Internet/storage permissions, blocked remote requests, and a bounded Sharesheet bridge.
- Gradle Android app module targeting API 36; asset task to build the Rust/WASM frontend and package its files.
- Browser route-query support and relative WASM loading for asset packaging.
- Android board-first responsive layout with compact player rows, turn status in the app bar, adjacent move navigation shown only after the first move, board rotation, and persisted wood/green board themes. These follow familiar DroidFish workflows with ShatrunZ's own presentation; no DroidFish code or artwork is included.
- Edge-to-edge Android 15+ layout with system-bar insets applied to the WebView container instead of drawing the app toolbar underneath the status bar.
- PvP/PvAI/AIvAI navigation, compact controls, local/offline note, Krishna explanation, and AI strength control. AIvAI uses the existing local JavaScript strategies; the service-backed C Engine option is omitted on Android.
- Per-mode local active-game save/restore with replay validation, undo saves, reset confirmation, persisted AI side, and Android PGN sharing.
- Cursor project instructions, four project skills, nine specialist subagent roles, and a next-gate command.

## Device evidence and remaining checks

- APK installation/reinstallation succeeded on physical device `SM_E366B`; the installed package is `com.xdutsuay.shatrunz.debug`.
- Physical-screen inspection found a status-bar overlap and unnecessary blank mobile UI blocks; those were corrected, rebuilt, and installed. The latest rebuild/reinstall adds AIvAI. WebView inspection in AIvAI confirms three visible mode links, visible white/black strategy controls, a visible Start AI button, 81 rendered squares, and no service-backed C Engine option. A clean unobstructed screenshot of the final build is still outstanding.
- PvP/PvAI/AIvAI moves and mode switching, rotate/theme controls, undo/reset confirmation, process recreation, PGN sharing, portrait/landscape, offline launch, and TalkBack still need physical-device runtime review. A clean unobstructed screenshot of the final build is still outstanding.
- `node --check` for the changed frontend modules, `git diff --check`, and the Android debug build passed. No project test suite was run; existing suites remain part of the normal merge/release gate.
- No root project license was found; license and asset provenance are release blockers.

## Next actions

1. Capture the final screen without system overlays and exercise PvP/PvAI/AIvAI, board rotation/theme, legal moves, undo/reset, PGN share, mode switching, process recreation, offline behavior, and portrait/landscape; fix failures.
2. Review touch/accessibility behavior with large text and TalkBack. Run the existing project suites in the normal CI/merge gate.
3. Resolve ShatrunZ license and asset provenance before public distribution; then confirm permanent package identity, signing owner, privacy disclosures, and release channel.
4. Review the resulting diff and create a user-owned commit/PR only if requested. Do not publish the APK to Google Play without a separate explicit request.
