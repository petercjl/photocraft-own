# Distribution contract

The native Rust engine and desktop remain upstream-owned. The optional `own` feature isolates desktop identity, help links and user data. `own/` owns npm lifecycle, portable invocation documentation, binary provenance and release QA. Applications own image-editing strategy and visual acceptance.

Confirmed: public @petercjl scope, Codex and SealSeek adapters, macOS Apple Silicon and Windows x64. Traceable source: upstream CLI/MCP schemas and codex-own sync/release implementation. Verified execution: local CLI/serve/MCP image editing and native PSD text roundtrip. Hypotheses: Windows desktop readiness and SealSeek invocation require runtime evidence.

Configuration and session scopes are external to immutable version directories. Downloads require exact npm identity, bounded sizes, SHA-256 and safe archive entries. Activation uses a state pointer with recoverable backups; live desktop sessions prevent replacement. CLI/MCP sessions retain their previous runtime. Interrupted transactions stop later activation. Rollback switches software only.

First distribution uses separate compressed CLI and desktop assets. Content-defined chunking is deferred until measured asset size/reuse justify its complexity. Release QA runs both native targets before OIDC publication. Upstream synchronization opens deterministic candidate PRs; protected own paths survive merges and conflicts remain reviewable. Stable promotion requires actual acceptance of the candidate.

Known release work: npm bootstrap/trusted-publisher account setup, notarization/Windows signing, GUI update menu, host-specific live SealSeek verification. These are explicit pending items rather than assumed runtime support.

Release dispatch, diagnostics and Trusted Publisher setup use npm-release-kit. Its default internal release-it arguments hard-code `v${version}`, which collides with upstream PhotoCraft tags (including v0.1.0). The committed workflow uses the same pinned release-it/OIDC path with `own-v${version}` for manager tags. Runtime payloads are immutable same-package prereleases under desktop-assets. No local publication or write tokens are used.
