# Connect the live desktop

Use this branch only when the caller needs the open desktop document/UI. Inspect the running application's process, control endpoint and authorized root configuration first. Preserve unsaved user work. Do not restart an existing desktop merely to change its automation flags.

For a new authorized automation desktop, discover manager `launch --help` and native startup flags. The baseline desktop supports `--control PORT`, `--control-token-file FILE`, `--automation-read-root DIR` and `--automation-write-root DIR`. Use a loopback endpoint and a private token file outside artifacts/npm/Skill. Never print the token or embed it in delivered documentation. A missing token file can be created by the desktop; verify owner-only access (including Windows ACL handling).

Start `photocraft-own mcp --bridge HOST:PORT --control-token-file FILE` only with the actual endpoint and native help-confirmed syntax. Desktop launch owns filesystem authority; headless MCP roots do not grant additional authority to the desktop. Authentication and path errors return a configuration diagnosis without broadening scope automatically.

Inspect `ui_inspect` and current document state before editing. For document/menu switching discover `control_call`, live methods and `ui.menu.list`; use the returned menu IDs with `ui.menu.invoke`. Headless `doc_select` and `doc_close` are not desktop switching APIs. Several file helpers have backend-specific availability even when present in tools/list. A headless-only/bridge-only error returns to N2 surface selection or N3 discovery.

Inspect rendered/UI state after a live action, preserve active document identity, and save only to the requested authorized destination. Bridge timeout recovery is described by the recover-operation route. Report untested host/UI paths honestly.
