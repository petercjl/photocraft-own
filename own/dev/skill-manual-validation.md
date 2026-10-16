# Companion operating-manual validation — 2026-10-16

Scope: canonical bundled Skill plus README and test-only MCP helper. Manager remains 0.1.2; native remains 0.1.1 / upstream 0.8.2. No release or runtime-engine change.

Responsibility: CLI/MCP own explicit operations; companion Skill owns invocation/state/recovery/verification; caller applications own artistic/business choices. Portable Skill Creator governed the update using the current base Skill Creator, hybrid knowledge and existing command.execute adapters. Runtime knowledge is contained in the package.

## Gates

- macOS Apple Silicon: 24/24 npm tests with the pinned native manifest; no skipped tests. Added case-sensitive local resource resolution to catch broken packaged routes.
- Fresh npm pack/install: 39 packed files; actual installed CLI used for one-shot editable PSD, persistent serve adjustment/PNG, Skill install and MCP.
- MCP: 25 advertised tools; session-aware discovery, successful edit/export, path traversal rejection, non-atomic batch partial success and default stopping, strict unknown-argument rejection without document effects, headless UI rejection, and editable native save/reopen passed.
- The test helper now honors PHOTOCRAFT_SMOKE_CLI so packed MCP validation reaches the installed package rather than the source CLI.
- Skill format, shareable portability, hybrid knowledge layer, capability contract and adapter-gap validators: zero errors/warnings. Mappings remain implemented; these validators do not upgrade host execution evidence.
- npm syntax check and git whitespace check passed. cargo xtask layers: 29 crates, no layering violations. No Rust/runtime implementation changed.
- Native input fingerprint remains d82958ff05d2e8a44fafa594f0ec9c1b6c5c7d800a2825e4cb5b94b06436db62. Pure release classification selects manager reuse, native 0.1.1; no publication was dispatched.
- Viewed the generated 96×64 preview: blue background and legible Agent text, without clipping. This synthetic artifact verifies the test task, not arbitrary artistic quality.

## Runtime reading audit

The bounded file task uses SCHEMA/index/recent log once, choose-interface → execution-modes at N2, discover-command → command-discovery and edit-document → document-operations at N3. Persistent tasks additionally load session-protocol. The partial-failure test triggers recover-operation → recovery at N4; verification loads verify-output → verification at N5. Bridge, lifecycle and maintenance provenance remain deferred for the image task. This is a manual route/contract audit with deterministic execution, not an independent Agent routing test.

## Limits

This iteration ran on macOS only. Earlier release gates established Windows x64 protocol/lifecycle coverage; the expanded manual and new failure checks have not received a fresh Windows run. Desktop bridge/UI and complex engine commands are not exhaustively verified. No clean-context regression or autonomous host discovery was run. No user-approved standard artifact was added to runtime resources. Status: main-run-pass, clean-regression-not-run.
