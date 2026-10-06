# Cursor specialist agents for Android work

The executable Cursor subagent definitions are under `.cursor/agents/`; project skills are under `.agents/skills/`. Use a specialist when it removes a real review or implementation bottleneck. The main Cursor agent remains responsible for scope, shared interfaces, integration, and owner decisions.

| Roadmap stage | Agents to use | Parallel work boundary |
| --- | --- | --- |
| Audit / 5–10% | `source-archaeologist` and `rules-regression-auditor`; lead records licensing and owner decisions. | Audit first. Do not ask multiple agents to invent architecture independently. |
| Existing rules / 20% | `domain-rules-implementer`, then `rules-regression-auditor`. | One implementation owner; read-only review after implementation. |
| Playable alpha / 40% | `android-web-implementer`, then `android-webview-reviewer` and `accessibility-player-reviewer`. | Partition Activity/resources from frontend files; do not edit the same surface concurrently. |
| Data/resume | `game-data-implementer`, then rules and Android reviewers as needed. | Save schema has one owner; announce schema/API changes before dependent UI work. |
| Beta / 60% | `accessibility-player-reviewer` plus a scoped engineer for accepted findings. | Findings first; assign implementation files by surface. |
| Proposed external integration | `platform-api-reviewer` before any provider implementation. | Research only until owner approves a provider and use case. |
| Release candidate / 80% | `release-guardian`, `rules-regression-auditor`, `android-webview-reviewer`. | Independent read-only checks; lead owns the one integrated release candidate. |
| Launch / 100% | Release owner and support/feedback triage. | No concurrent publication changes; owner authorizes external release steps. |

## Assignment contract

Give each delegated agent:

1. The accepted scope and exact question/artifact.
2. The source files or subsystem it may inspect or own.
3. The relevant `docs/mobile` plan and skill.
4. Whether edits or commands are authorized. The reviewers in `.cursor/agents` are read-only.
5. The output format: findings with file/line and scenario, or implementation with exact files, decisions, commands/results, limitations, and next dependency.

Avoid shared ownership of Rust core semantics, save schema, Gradle root config, and package identity. Merge/review changes through the lead. Agent count is not a completion metric.
