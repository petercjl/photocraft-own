# Startup-update validation — 2026-10-16

User-selected behavior: check and automatically update at pc startup. Implemented in the npm manager; the native desktop/engine and executable contract are unchanged.

## Contract

Global npm launch/exec/mcp/serve entries check stable latest, with a five-second registry deadline. Read-only help/version/capabilities/doctor/status do not trigger updates. A persistent policy and environment opt-out are available. Source checkouts and non-global installs are excluded.

A startup lock serializes updaters. Operation leases retain managed activity across replacement and fresh-process handoff. Active managed desktop or headless sessions defer automatic changes. Unknown stale locks block dispatch and are preserved for inspection. npm updates back up package bytes and shim metadata, verify the exact new entry, synchronize the new binding and existing managed Skills, then relay through the new entry once. Failed npm replacement restores and verifies the old entry; failed recovery blocks dispatch with a diagnosis. Registry failures retain the installed package. Cancellation is forwarded to update children, restores the old entry when replacement was interrupted, and stops dispatch with the cancellation exit status. Native identity reuse preserves state/headless mode and downloads zero native bytes. Skill local edits are retained with warnings; removed targets remain removed. Diagnostics use stderr and protocol stdout passes through.

## Pre-release evidence

- macOS Apple Silicon: 34/34 tests with pinned native manifest, none skipped; syntax, packaged CLI/serve/MCP, Skill resource links, portability/knowledge/capability validators pass.
- Real npm update fixture: installed public manager 0.1.3 and native 0.1.1, upgraded through npm to an isolated packed candidate (test-only version 99.0.0), verified the new entry, synchronized a managed copied Skill, checked state bytes/version directories unchanged and zero native download, executed editable PSD through the handoff entry, then injected replacement failure and verified the restored real entry.
- A real failure exposed relative npm shim links becoming invalid when copied into backup folders. The final implementation records link targets/types and file permissions in the private backup receipt, and reconstructs them at their original location. Both actual npm entry restoration and synthetic failure cases pass.
- Deferred desktop/exec/mcp/serve activity, concurrent starts, offline/invalid metadata, policy persistence/backups, strict readonly controls, local-edited Skills, stale/live locks and downgrade avoidance have deterministic coverage.
- The same tests, packed native smoke and real npm update fixture run in the existing macOS/Windows release workflow before publication. Windows results are pending at this pre-release checkpoint; inspect the authorized release run for final status.

No background scheduler, cloud credentials or new Agent-host capability is required. No independent clean-context routing or new desktop visual validation was run. Native build-input fingerprint remains the existing 0.1.1 binding; release planning must verify it again before dispatch. Backups, logs and test fixtures are excluded from npm distribution.
