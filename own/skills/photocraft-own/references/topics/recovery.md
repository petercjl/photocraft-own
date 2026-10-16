# Observe effects before recovery

| Observation | Required next step |
|---|---|
| Unknown/disabled command or invalid params | Refresh catalog and document state; correct the explicit operation at N3 |
| MCP `-32602` unknown envelope key | Correct schema; rejected envelope did not execute |
| MCP tool `isError:true` / serve `ok:false` | Inspect the message and state; it does not prove earlier work was rolled back |
| Batch `failed > 0` | Read every result, `completed` and live document/history before continuing |
| Reply budget says current step may have completed | Inspect that step's effects before retry or undo |
| Desktop `timeout: not run` | Request was not dispatched; retry only after correcting the cause |
| Desktop `timeout: no reply in 60s` / connection lost after submission | Outcome uncertain; inspect document/jobs, do not replay automatically |
| Job ID returned | Retain ID; use `jobs_list` until done/failed/cancelled; save only after effects are applied |

`command_batch` is ordered, non-atomic; `stop_on_error` defaults true. Earlier successful steps remain applied. Record a pre-operation snapshot/history where recovery matters. Commands do not necessarily add one history entry each. For undoable edits, discover `edit.undo` and apply once per actual undoable entry added, inspecting as you recover. Undo does not reverse disk writes.

For experiments use discovered `image.duplicate` with `{}` or `history.newDocument` with `{}` before editing. Both create a new active document; refresh identity and preserve the source. Optional historical state must be selected explicitly.

Long job-capable commands can return `{job: id}` with `wait:false`; `jobs_list` reports progress and finished results, and applies finished work. Cancel only the intended job via discovered `jobs_cancel` arguments; preserve its returned final state. Direct headless `file.export.renderVideo` is a special synchronous operation even with `wait:false`; MCP progress/cancellation needs its documented progress token/request ID. Batch and bridge exports have different restrictions. Discover those capabilities before using them rather than treating all commands as asynchronous.

Manager failures: `NOT_INSTALLED` → lifecycle; `APP_RUNNING` → preserve unsaved work and arrange closure before native activation; `BUSY`/`RECOVERY_REQUIRED` → inspect doctor, recorded process and transaction. Never delete a live lock. `CHECKSUM_MISMATCH`, `UNSAFE_ARCHIVE`, `INVALID_RUNTIME` stop activation and retain the previous version. `UNMANAGED_TARGET`/`LOCAL_EDITS` preserve the Skill and return a migration choice. An unchanged native identity update need not close the desktop.

Startup auto-update defers while another desktop/CLI/MCP/serve session is live. Concurrent startup updates queue; an unresolved live updater lock returns BUSY rather than racing a replacement. A dead updater lock blocks startup pending doctor/status inspection and explicit recovery; it is not silently deleted. Cancelling an update stops dispatch and forwards cancellation to its child; an interrupted replacement restores and verifies the previous entry. Registry checks time out and keep the installed version. npm manager replacement keeps a package/shim backup and verifies the restored entry after failure. Skill local edits are preserved and reported as warnings.

Unrecoverable/uncertain state is a valid terminal diagnosis: report known applied effects, session/job identity, saved paths, remaining uncertainty and the next authorized recovery step. Never describe it as success or silently discard it in a new session.
