# Execution modes and authority

| Surface | Use | Document/state owner |
|---|---|---|
| `photocraft-own exec -- …` | Bounded file conversion, info or command run | A fresh native process per invocation |
| `photocraft-own serve …` | Persistent headless JSON-lines session | That server process |
| `photocraft-own mcp …` | Persistent MCP tools through an MCP-capable host | That MCP server process |
| MCP with `--bridge` | Explicitly requested live desktop work | Connected desktop application |

One-shot `run`, independent serve and independent MCP do not share documents with each other or with an open desktop. Select one persistent process for a multi-step operation and keep its identity. A later file open sees saved bytes, not another process's unsaved state. UI tools require bridge mode; a tool listed in the catalog is not a promise of availability in every backend.

One-shot CLI uses ordinary OS paths. Its lack of a read/write root flag is not a sandbox. Preflight input and destination paths and constrain operations to the caller's scope.

Headless serve/MCP require explicit `--automation-read-root INPUT_DIR --automation-write-root OUTPUT_DIR` for filesystem access in each direction. A missing root denies that direction. Relative paths resolve beneath the corresponding root; absolute paths must remain beneath it. A generated `photocraft-own mcp-config --read-root INPUT_DIR --write-root OUTPUT_DIR` is a configuration definition, not automatic host registration. Apply it through the host's supported authorized configuration mechanism.

Use separate input/output folders where practical. File-writing tools may overwrite targets; annotations and roots do not authorize replacing known existing files. Local CLI/MCP has no cloud credential or service charge. AI provider features have separate configuration and authorization.
