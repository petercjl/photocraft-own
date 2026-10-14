# Installation and updates

Use the host command executor. Discover Node/npm from PATH; Node 22+ is required. For a published package install `npm install --global @petercjl/photocraft-own` (or an explicitly selected prerelease tag). Verify `photocraft-own version` and the resolved executable before continuing.

Run `photocraft-own install --yes` after the user authorizes installation. `--headless` installs only the native CLI. The package downloads immutable npm payloads, checks sizes and SHA-256, extracts into a new version directory, verifies native executables, then activates its state pointer. Native projects, images and user settings are external to runtime versions. macOS ad-hoc builds may require separate OS trust approval; do not disable OS protections.

Install the canonical Skill with `photocraft-own skill install --agent codex`. For SealSeek resolve its configured Skill root from host context and pass `--agent sealseek --target-root ROOT`. Link/junction is preferred; `--copy` uses verified managed copies. Never guess another Agent’s root. Inspect `skill status --agent ... --json` afterward.

For an authorized update: update the npm package, then run `photocraft-own update install --yes`, update the current Agent’s managed Skill, and run doctor. Ordinary image calls do not update software. `update check` is read-only. Use `--channel next` only when the user selected prereleases. Existing copied Skills retain user-added files and interface metadata, with backups before replacement. Local edits to managed core files stop synchronization.

`photocraft-own launch` opens the independent desktop. `rollback --yes` switches to a previously verified runtime after authorized recovery; it does not restore edited images. Doctor reports pending transactions and sessions; preserve recovery evidence. Interrupted locks require checking the recorded PID and transaction before a separate recovery decision.

Developer-only local artifacts can be installed with `install --manifest FILE --asset-dir DIR --yes`; this does not represent a registry release.

For SealSeek hosts using workspace-skill-manifest.v1 and skill-pool-manifest.v1, resolve the configured workspace registry and Skill pool from host configuration. After Skill installation run `skill register --agent sealseek --target-root ROOT --registry FILE --pool-root DIR`. This backs up the manifests, adds only this package’s records and pool link, and preserves managed UI choices. Existing unknown records are refused. Other host schemas return an explicit unsupported error. Registration files do not prove live host discovery; confirm it in the host when available.
