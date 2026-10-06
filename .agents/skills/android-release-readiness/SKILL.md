---
name: android-release-readiness
description: Use when preparing or reviewing a ShatrunZ Android beta, signed build, direct distribution, or Google Play submission.
---

# Android release readiness

Review the exact candidate and chosen channel. Confirm current official policy and toolchain requirements at the time of release.

- Verify package ID, versioning, min/target SDK, supported devices, signing ownership, release notes, privacy text, and channel/country scope.
- Inventory every permission, network endpoint, SDK, native binary, model, font, icon, and game asset. Reconcile actual behavior with privacy disclosures and store forms.
- Review project and third-party license obligations; preserve notices and required source offers. Do not assume the repository has a root license until verified.
- Build a signed Android App Bundle for Play; protect signing keys outside source control. For sideload builds, review applicable developer-verification requirements in the release region.
- Validate install/upgrade, cold start, offline play, local saves, lifecycle restoration, and device layouts on an emulator and physical device where available.
- Verify the current Google Play target API requirement. As of 31 August 2026, new submissions target Android 16 / API 36 or newer; confirm again before submission.
- Report release blockers; do not sign/upload/publish, change Play Console, or invite testers without explicit owner authorization.
