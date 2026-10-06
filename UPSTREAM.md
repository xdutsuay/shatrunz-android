# Upstream source and synchronization

The canonical ShatrunZ source repository is [xdutsuay/shatrunZ](https://github.com/xdutsuay/shatrunZ). This Android repository starts from its source tree at `a81d92143d5f3036c48ca2a78b5002e11e0af4cf`, with the Android prototype's mobile frontend adaptations included in this snapshot.

The rules core, WASM adapter, and frontend are versioned here so the Android project can build and evolve independently. They are not fetched as a Git submodule at build time. This intentionally avoids coupling every Android build to the browser project's branch state.

When a change lands in the canonical repository that should affect Android:

1. Review the change against `docs/rules.md` and this app's offline/security boundaries.
2. Port or sync only the needed files into this repository; do not blindly replace Android-specific layout and bridge behavior.
3. Run the Rust/core and frontend checks relevant to the change, rebuild the Android APK, and verify mode behavior on a device or emulator.
4. Record the upstream commit and any intentional divergence in this file.

Keep one authoritative implementation of variant rules within this repository: `crates/shatrunz-core`. Do not reimplement the rules in Android Java or UI code.
