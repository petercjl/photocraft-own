# Persistent session protocol

## MCP

Connect through the host's advertised MCP client, or a supported stdio client using the command-execution capability. Follow MCP initialize/initialized negotiation before tools/list and tools/call. Do not send serve requests to an MCP process. The manager passes protocol stdout through unchanged; diagnostics belong on stderr.

A tool invocation envelope is:

```json
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"command_run","arguments":{"id":"image.adjustments.invert","params":{}}}}
```

Requires an opened/created document. Tool schemas govern envelopes (often snake_case, e.g. `stop_on_error`, `max_side`); nested engine parameters keep their own documented casing. Unknown tool arguments or batch-step keys receive JSON-RPC `-32602` before execution. Tool execution errors return `isError:true`; inspect that flag and decode text content JSON before interpreting results. A successful batch tool reply can contain failed steps. Invalid JSON returns `-32700` with null ID; the next valid line can still be processed.

Headless main line: `doc_open`/`doc_new` → `command_list` → `command_run`/`command_batch` → `doc_inspect`/`render_preview` → `doc_save`/`doc_export`. Discover every tool's current arguments; read root is for opening, write root for saving. `session_list` identifies documents; headless `doc_select` activates a live index; `doc_close` discards a document without saving. Confirm save/discard intent first.

Live resources `photocraft://document` and `photocraft://commands` reflect current state; resource reads are uncached even when catalogs are cached. Catalog presence does not override backend restrictions. UI tools require bridge mode; `doc_select`/`doc_close` are headless-only in the supported baseline.

## Serve

Serve uses newline-delimited control JSON, not MCP JSON-RPC:

```json
{"id":1,"method":"engine.execute","params":{"command":"image.adjustments.invert","params":{}}}
```

An opened document is required. Read replies by matching `id`: success has `ok:true,result`; failure has `ok:false,error`. Keep the same process alive for subsequent operations. Inspect `photocraft-own serve --help` and the control request `{"id":1,"method":"methods","params":{}}` in that serve session before selecting control methods; never infer a tool name by changing punctuation. EOF ends a stdio session and its unsaved state. Verify files before closing the process.

For jobs/partial operations enter the recovery route at N4; tool-specific job and progress support cannot be inferred from `wait:false` alone.
