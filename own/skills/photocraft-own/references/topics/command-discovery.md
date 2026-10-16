# Discover the installed contract

Probe manager `version`, `capabilities`, `doctor --json`; then use native `photocraft-own exec -- --help` and subcommand help. Search narrowly with `photocraft-own exec -- commands --json --filter TEXT`. In a persistent MCP session use `command_list` with `filter`; serve exposes methods through its live discovery/help. Discover after opening a document when availability depends on state.

Command entries are a bare array with `id`, `label`, `menu`, `shortcut`, `params`, `enabled`, `disabledReason`, `needsDocument`. `params` may be a documentation string rather than JSON Schema. Read it; preserve documented key casing, units, ranges and defaults. `needsDocument`/disabled reasons are contextual observations; a fresh one-shot catalog cannot describe a document in another session. Re-query relevant state after opening, selecting or editing.

Use `doc_inspect`/native `info` for dimensions, layer tree/kinds, selection and history. Resolve layer IDs from the actual document, including nested children. Do not carry document indices or layer IDs across unrelated sessions or assume selection survives opening/closing documents.

| Intent | One-shot CLI | MCP | Serve control method |
|---|---|---|---|
| Discover commands | `commands --json --filter TEXT` | `command_list` | `engine.commands` |
| Execute command | `run … --cmd ID --params JSON` | `command_run` with `id`, `params` | `engine.execute` with `command`, `params` |
| Inspect file/active document | `info FILE --compact` | `doc_inspect` | `doc.inspect` |
| Open/save | `run INPUT … --out OUTPUT` | `doc_open` / `doc_save` | `doc.open` / `doc.save` |

The table maps concepts, not interchangeable parameter envelopes. For MCP discover `tools/list` input schemas; for serve inspect live methods. Use structured argv arrays; each CLI `--params` JSON object belongs to the preceding `--cmd`. Serialize user text as JSON data, never interpolate it as shell code. On Windows preserve argv quoting through the host executor. An unsupported operation returns a capability gap to the caller.
