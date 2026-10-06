---
name: chess-interoperability
description: Use when integrating ShatrunZ with chess engine protocols, game formats, datasets, online platforms, or chess APIs.
---

# Chess interoperability

Read `docs/rules.md` first and verify each external format or service against the 9×9 variant.

- The common chess engine interface is **UCI** (Universal Chess Interface). This repository already uses UCI-style move strings and engine plumbing. The user previously referred to “OCI”; searches did not establish a separate chess protocol by that name, so confirm the full name/source if OCI is a real requirement.
- UCI is an engine process protocol, not an online-match protocol or a statement that an engine understands ShatrunZ. Verify variant compatibility and licensing separately.
- Do not claim standard FEN or PGN is lossless for ShatrunZ. The repository uses a custom 9×9 position and a `UciMoves` PGN tag; test round trips before format claims.
- Prefer official documented APIs. Recheck terms, OAuth scopes, rate limits, fair-play rules, and dataset licenses for each integration. Keep integrations optional and leave local play usable offline.
- Never scrape websites, embed private API secrets in the APK, or use local engine assistance in a rated external game unless the platform explicitly allows it.

Current product decision: external chess APIs and platform accounts are not part of the Android MVP. See `docs/mobile/ANDROID_PLAYBOOK.md` before proposing them.
