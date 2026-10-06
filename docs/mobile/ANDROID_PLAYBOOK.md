# ShatrunZ Android development playbook

**Snapshot:** 6 October 2026. Recheck platform policies before a release.
**Read with:** [ANDROID_PLAN.md](ANDROID_PLAN.md), [ANDROID_ARCHITECTURE.md](ANDROID_ARCHITECTURE.md), and [ANDROID_MVP_STATUS.md](ANDROID_MVP_STATUS.md).

## Product principles

The first app should make a local ShatrunZ game quick to start, teach the unusual rule in context, preserve unfinished games, and work without an account or network. A player should understand whose turn it is, which moves are legal, why Krishna behaves differently, and how to undo or start over.

What can make players like it: fast first play, correct and consistent variant rules, readable 9×9 squares, clear move feedback, forgiving local AI, instant resume, trustworthy export, no forced login or ads, and an honest explanation that this is a chess variant. Validate these with a small consented first-game study before expanding features.

Use DroidFish to notice mature workflows—board settings, move navigation, engine controls, import/export, orientation, and analysis modes. Do not copy its source, brand, icons, text, or piece art. Its repository is GPL-3.0; ShatrunZ licensing also needs resolution because this checkout has no root license file.

## Progress model and current gate

Call a percentage complete only after the exit evidence exists. The implementation can have code for the next stage while the gate remains open.

| Gate | Work and evidence required | Current status |
| --- | --- | --- |
| **5% — audit** | Inspect rules, source, assets, formats, build, license, services, and reuse candidates. Produce a source map and concrete open decisions. | **Complete** for the checked-out repository. Root license/provenance remains a release question. |
| **10% — product/architecture** | Commit to user/modes, source reuse, data boundaries, package/min API/distribution assumptions, and explicit non-goals. | **Complete for MVP scope.** App identity and release channel are provisional. |
| **20% — rules boundary** | Confirm one authoritative rules kernel; preserve replay/undo/serialization contracts; capture test evidence from existing tests or fixtures. | **Core exists and was inspected.** Current-turn test evidence is pending. Do not duplicate it. |
| **40% — playable alpha** | Build/install Android; complete PvP, PvAI, and AIvAI flows; undo, resume after process recreation, and share a game; inspect network/permission behavior. | **Debug APK build and package inspection passed; exit gate pending** emulator/device interaction and lifecycle evidence. |
| **60% — feature-complete beta** | Close agreed MVP UX: first-run rules help, essential preferences, game history/export, reliability, accessible board, landscape/tablet behavior; collect structured beta feedback. | Not started. |
| **80% — release candidate** | Test device/API coverage, privacy/licensing, store listing, target API, signed bundle, test-track plan, crash/performance review. | Not started. |
| **100% — launch and care** | Publish through the selected channel, verify install/update, assign support and issue triage, schedule post-release review. | Not authorized or started. |

For planning, ShatrunZ is ready for 40% gate review. The APK builds, but the gate remains open until a playable demo is checked on an emulator/device.

## Reuse map: original ShatrunZ → Android MVP

| Existing source | Treatment |
| --- | --- |
| `docs/rules.md`, `crates/shatrunz-core` | Preserve as rule spec and authority. No new Kotlin rules engine. |
| `crates/shatrunz-wasm`, `frontend/game.js` | Build and package. Keep wasm-bindgen as the current UI boundary. |
| `frontend/play.html`, `frontend/ui.js`, `frontend/game.js`, board/mode modules, `frontend/style.css` | Reuse existing game loop; adapt mode routing, mobile ordering/touch layout, a small AI-level control, and Android text sharing. Preserve browser routes. |
| `frontend/shared/replay.js`, `frontend/pgn.js`, existing UCI move history | Reuse for local replay/history and active-game restoration. Validate replay before applying saved state. The variant extension is not equivalent to standard chess PGN/FEN. |
| `frontend/shared/engine_move.js`, JS/WASM AI search | Reuse offline for PvAI and AIvAI. The existing C engine route expects a service and is not included in Android. |
| Flask backend, admin, optional ML APIs | Exclude from offline mobile first release. Revisit with a separate feature/security plan. |
| `.mcp.json`, `crates/shatrunz-mcp` | Keep as local developer tooling. Audit current tool exposure before giving an agent access; do not package it as an Android feature. |
| DroidFish source, pieces, graphics, text | Do not copy. Use workflow inspiration only unless a deliberate GPL-compatible reuse decision is made. |

## Cross-platform core strategy

The existing Rust core has already avoided the biggest cross-platform trap: separate Android and web rules engines. Keep `shatrunz-core` free from Android, browser, storage, networking, and engine-process APIs. The current WASM wrapper is a web boundary, not yet an agreed JNI/iOS ABI.

If native UI becomes worthwhile, expose explicit operations over portable values: create/replay a game, query current state and legal actions, apply/undo an action, report terminal status, and encode/decode a versioned save. Then bind that API to Kotlin through a measured JNI or UniFFI adapter and to Swift if an iOS client is approved. Keep async engine search outside mutable game state, return typed failures, and revalidate moves with the same core. Differentially compare WASM and native bindings on a shared fixture set before switching a UI.

Do not adopt Kotlin Multiplatform merely to share rules already written in Rust. Do not replace Rust with a second rules core merely to obtain Compose. Share presentation only if product scope later justifies it; native interaction can differ while domain semantics remain the same.

## Challenges to plan for

1. **Variant correctness:** Krishna, 9×9 coordinates, non-standard castling destinations, promotion, end states, and UI-generated legal highlights. The core must decide every transition.
2. **Notation/data compatibility:** project PGN contains a custom `UciMoves` tag and a 9×9 variant/FEN-like field. Do not advertise orthodox FEN compatibility or silently import a position that loses Krishna/rules semantics.
3. **Browser routing in an asset origin:** the website uses route paths and absolute asset URLs. The Android entry uses local `play.html?mode=...`; JS/CSS/WASM imports must remain relative and app-local.
4. **Generated WASM:** `frontend/pkg` is ignored. A clean Android build must compile Rust/WASM before asset sync and fail clearly when Rust/wasm-pack is unavailable.
5. **Engine latency and heat:** local wasm search competes for CPU and battery. Measure useful levels on low/mid devices; cancellation and UI responsiveness matter more than a chess-engine feature checklist.
6. **WebView attack surface:** an enabled JS bridge can become dangerous with remote content. Restrict top-level pages and subresources to packaged assets, deny file/content paths and permissions, keep the bridge narrow, and do not add external frames.
7. **State loss/migration:** localStorage is acceptable for an MVP save but not a permanent cross-device database. Add a save schema version, bounds, replay validation, corruption recovery, and a migration plan before long-term release.
8. **9×9 ergonomics/accessibility:** nine files make phone squares small. Test target size, contrast, non-color feedback, TalkBack names, font scaling, orientation, safe areas, and thumb reach on real devices.
9. **License uncertainty:** no root `LICENSE` appeared in this checkout, while README references third-party engines. Resolve ownership, code/asset licenses, required notices, and source offers before public distribution.
10. **Store readiness:** a debug APK does not prove target API, privacy, identity verification, app access, tester, signing, or listing requirements are met.

## Engineering practices and quality controls

- Keep a short decision log for package ID, UI architecture, save schema, game format, networking, and any switch from WebView to native UI. Separate owner decisions from reversible implementation choices.
- Change one layer at a time; keep diffs small and buildable. The lead owns Gradle/root config, shared contracts, integration, and release decisions.
- Keep core transitions deterministic and platform-neutral. Engine and network replies are untrusted input; apply them through the core.
- Keep the saved game schema versioned. Write active saves atomically where storage permits, bound sizes, validate every UCI token, replay via the rules core, and recover safely from corrupt/mismatched data.
- Add coverage to the established Rust/frontend/Android layers as work progresses: rule edge cases, WASM/native parity, undo/replay, save process-death restore, malformed imports, offline startup, and navigation. Run only the focused suites relevant to a change, then the full release gate.
- Build from a clean checkout through the Gradle wrapper and build-generated WASM assets. Cache toolchains in CI; never check in API keys, release signing keys, generated app output, or private player games.
- Add CI stages for formatting/static checks, Rust and JavaScript correctness, debug Android build, manifest/permission review, dependency/license inventory, and signed release only from protected secret storage.
- Use Android Studio Device Manager, `adb`, Logcat, WebView remote inspection, Android Studio Profiler, and accessibility scanner/TalkBack. Test at least a narrow phone, one landscape layout, and a tablet-size window before claiming adaptive behavior.
- Use code review for rules, security, state loss, and licensing. Review agent results; do not merge independent agent edits to the same contract/Gradle files without integration.
- Collect no analytics by default. If telemetry is later approved, list exact events, purpose, retention, opt-out, privacy declarations, and deletion behavior before implementation.

## Android toolchain and native services

The checked-in build selects Android Gradle Plugin **8.13.2**, Gradle wrapper **8.13**, target/compile API **36**, Java 17 source, AndroidX WebKit, and Rust **1.94.1** with `wasm32-unknown-unknown` plus `wasm-pack`. Google’s compatibility table states AGP 8.13 supports API 36 and requires Gradle 8.13/JDK 17; verify again on upgrade.

Native Android components to use now:

- `Activity` owns the WebView lifecycle, back behavior, and system bars.
- `WebViewAssetLoader` serves shipped HTML/CSS/JS/WASM from the reserved HTTPS appassets origin; do not load `file://` content.
- Android Sharesheet handles explicit PGN text sharing without broad filesystem permission.
- Standard Android SDK/Studio: SDK Platform 36, Build Tools, Device Manager/emulator, `adb`, Logcat, profiler, build analyzer, and WebView debugging in debug builds only.
- Minimal native dependencies; no Compose/Room/DataStore yet because the UI/state adapter and one active local game remain web-backed. Extract native modules when there is a concrete UI/data need.

The official Android guide recommends `WebViewAssetLoader` for packaged in-app content and explicitly warns against broad file URL access. The current Android manifest intentionally has no `INTERNET` permission. If networking is later added, update the threat model, network security config, consent/privacy, Play disclosures, offline behavior, and external platform adapter first.

## “OCI” / engine protocol decision

I could not find a distinct chess engine protocol or standard named **OCI** in the primary chess-engine sources I checked. The common GUI-to-engine protocol is **UCI (Universal Chess Interface)**; Stockfish’s official project describes itself as a UCI chess engine. This ShatrunZ checkout also has a Rust binary whose module and command loop speak UCI. I am treating the current engineering need as UCI only where it refers to that engine interface. If you intended a different OCI standard, add its exact full name and primary reference before building an adapter.

UCI does not define variant rules, online matchmaking, or fair-play permission. An orthodox engine is not automatically ShatrunZ-compatible. The MVP uses the project’s JS/WASM fallback; it does not launch a native UCI process.

## API choices: no cloud dependency for v1

No external API is needed to play ShatrunZ. Local Rust/WASM rules, local AI, WebView localStorage, and PGN text sharing work offline. Avoid spending effort on an account or API integration before players ask for a specific benefit.

Potential later integrations, subject to feature approval and current provider terms:

| API/source | Useful later | Limits and caution |
| --- | --- | --- |
| [Lichess API](https://lichess.org/api) | User-consented game import/export, selected public player/tournament data, or opening exploration where positions are standard-compatible. | API guidance says serialize requests and pause at least a minute after HTTP 429. Respect OAuth scopes, cache/data licenses, and fair-play rules. Do not query for a ShatrunZ position unless variant/position semantics are supported. |
| [Chess.com PubAPI](https://support.chess.com/en/articles/9650547-what-is-the-pubapi-and-how-do-i-use-it) | Public player/game archive, club, and tournament reads. | The official help page calls it read-only; it cannot submit moves or authenticate connected play. Honor caching and 429 responses. |
| Lichess puzzle/open datasets | Optional training or study content after licensing and format review. | Standard-chess puzzle positions are not necessarily ShatrunZ-compatible; check each dataset's license and attribution. Do not bundle large content without measuring APK size. |
| ShatrunZ-owned backend | Accounts, cross-device saves, ShatrunZ matchmaking/tournaments, if demand justifies operations. | Costs, abuse, auth, moderation, privacy, uptime, data deletion, and game-authoritative server logic become project responsibilities. A “free tier” is not a service guarantee. |

Never scrape pages, automate gameplay against provider policy, ship private credentials in the APK, or make external API uptime a condition of local play.

## MCP: dev tool, not a player feature

The repository already has a ShatrunZ MCP server at `crates/shatrunz-mcp` launched through `.mcp.json`. Current source comments describe tools for new/get state, legal moves, making moves, perft, evaluation, engine moves, and self-play; PGN/FEN tools are noted as deferred. This is local developer tooling and can help Cursor inspect game behavior.

Do not add an MCP client/server to the Android player MVP. MCP is an agent-tool protocol, not a chess engine interface or online-play standard. Do not expose live rated games to an AI move tool. If the dev MCP is extended, use disposable/in-memory games, strict schemas, bounded depth/time/plies, no arbitrary file writes/secrets, and clearly separate analysis tools from gameplay. Consider a small CLI/test fixture before growing MCP scope.

## Google Play and chess-platform paths

These are separate tracks:

**Google Play** is Android app distribution. As of 31 August 2026, new apps and updates generally need target API 36 or higher. A new personal Play developer account created after 13 November 2023 must meet the current closed-test gate: at least 12 testers opted in continuously for 14 days before requesting production access. Before submission, confirm application identity, target SDK, signing, store listing/graphics, privacy policy and Data safety, content rating, ads declaration, app access, permissions, license/attribution notices, release testing, and Play policy. A debug APK does not satisfy these gates.

Android developer verification began regional enforcement on 30 September 2026 for participating stores in selected regions; Google Play handles registration for most Play apps. Recheck its rollout and package registration requirements for any sideload or third-party-store plan.

**Chess-platform integration** needs an official documented integration plus provider authorization and fair-play compliance. A local ShatrunZ variant may not be playable on standard-chess servers. Do not use site scraping, browser automation, game bots, or engine assistance in rated play. Chess.com PubAPI is read-only. Lichess API access and game use are constrained by its terms and fair-play rules. Obtain any required OAuth/partner approval and make online play a separate adapter that degrades cleanly. Do not imply platform affiliation or tournament certification.

**Tournament/federation recognition** is separate from app-store listing and from using a public API. If the goal is sanctioned play, ask the relevant organizer/federation what rules, clock, pairing, anti-cheat, audit, and variant approval are required; do not claim standard-chess compliance for ShatrunZ.

## Specialist Cursor agents

Cursor-specific specialists live in `.cursor/agents/`; reusable workflows live in `.agents/skills/`. Delegate only after task boundaries are clear, and keep the main Cursor agent responsible for product decisions and integration.

| Agent | Spawn for | Boundary |
| --- | --- | --- |
| `rules-regression-auditor` | Any core, WASM, notation, replay, or undo change. | Read-only; reviews rules authority and concrete failure scenarios. |
| `android-webview-reviewer` | Activity, WebView, packaging, Gradle, or network/security changes. | Read-only; reviews local asset/security/lifecycle behavior. |
| `accessibility-player-reviewer` | Playable alpha and after board/layout changes. | Read-only; source inspection unless a device artifact is explicitly provided. |
| `release-guardian` | Before beta or distribution. | Read-only; current policy, privacy, package, license, and store blockers. |

Use parallel agents only for independent deliverables (e.g. source review and accessibility review). Do not parallel-edit core rules, save schema, or Gradle root configuration. Ask agents for file/line evidence, assumptions, checks actually run, and outstanding risks.

## Remaining decisions before beta/release

- Confirm the permanent Android package ID, public app name, distribution channels, target regions, and who owns the Play/developer account.
- Add the ShatrunZ license, confirm all source/piece/UI asset ownership, and document third-party notices/source obligations.
- Decide whether active local saves should migrate from WebView storage to a versioned native repository and what uninstall/device-transfer behavior users expect.
- Decide the first-run rules guide, board-side/orientation/theme settings, whether clocks ship, languages, privacy text, support contact, and the feedback path.
- Decide whether PGN export needs a real `.pgn` document provider/SAF file instead of text sharing, and define the variant export format.
- Get emulator and physical-device evidence for install, move legality, undo, game finish/history, process death/resume, no-network startup, and accessibility.
- Keep online APIs, play-platform support, cloud, ratings, purchases, and ads as separate signed-off features.

## Primary references

- [Android packaged local content and WebViewAssetLoader](https://developer.android.com/develop/ui/views/layout/webapps/load-local-content)
- [AndroidX WebViewAssetLoader API](https://developer.android.com/reference/androidx/webkit/WebViewAssetLoader)
- [AGP compatibility table](https://developer.android.com/build/releases/about-agp)
- [Google Play target API requirements](https://support.google.com/googleplay/android-developer/answer/11926878)
- [Google Play personal-account test requirements](https://support.google.com/googleplay/android-developer/answer/14151465)
- [Android developer verification](https://developer.android.com/developer-verification)
- [Lichess API and rate-limit tips](https://lichess.org/api), [API tips](https://lichess.org/page/api-tips), [fair-play policy](https://lichess.org/page/fair-play)
- [Chess.com PubAPI overview](https://support.chess.com/en/articles/9650547-what-is-the-pubapi-and-how-do-i-use-it)
- [Stockfish official UCI engine description](https://github.com/official-stockfish/Stockfish)
- [DroidFish repository and GPL-3.0 license](https://github.com/peterosterlund2/droidfish)
