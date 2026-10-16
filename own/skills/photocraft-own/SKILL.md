---
name: photocraft-own
description: Install, update, diagnose and use PhotoCraft Own (pc) for local image editing through CLI or MCP, including editable text and adjustment layers, PSD/native projects, persistent sessions and desktop bridge. Use when the user selects pc or PhotoCraft Own to edit images, or asks to manage @petercjl/photocraft-own.
---

# PhotoCraft Own

## Responsibility and contract

**pc** is the user-facing short name. Install/update `@petercjl/photocraft-own`; execute through `photocraft-own`.

Input: the caller's explicit operation, local input files or live document, parameters/placement, desired outputs and authorized file scope. The caller owns artistic and business decisions, asset selection and visual acceptance. This Skill owns correct invocation, scope, state inspection, recovery and verifiable results. Preserve caller intent; return unsupported requirements for resolution rather than choosing a different operation.

Output: absolute artifact paths, editable/flattened format, actual operations and relevant parameters, warnings, completion state and verification evidence. Distinguish structurally verified results from visually inspected results. Incomplete or uncertain operations include the retained session/job identity and next recovery step. Local work has no service task ID or monetary charge unless a separately authorized provider was used.

This npm package's bundled Skill is the source of truth: `photocraft-own skill source --json`. Agent directories are managed installation targets. No nested Skill is required. Runtime operation uses this manual and live help/catalogs; contributor and API documents are maintenance sources.

## Execution main line

### N1 — Resolve and probe

Resolve the current Agent's mapping in `adapters/` and logical `command.execute` against advertised host tools. It must support argv, stdio, exit status and local files. If absent, return `CAPABILITY_UNAVAILABLE`; never invent a tool. Probe `photocraft-own version`, `capabilities` and `doctor --json`. Manager installation and native installation are separate states.

Installation, update or diagnostic request: enter [manage installation](references/queries/manage-installation.md), execute only the authorized lifecycle operation, verify the entry and managed Skill, then return to N1. Ordinary image requests do not update software.

### N2 — Choose execution surface and authority

Determine whether the input is a file, a persistent headless document or the user's live desktop document. Enter [choose interface](references/queries/choose-interface.md). Record the selected surface, session ownership and read/write scope. Use one-shot CLI for bounded file work, serve/MCP for persistent headless work, and explicit bridge mode for live desktop work. Default headless sessions do not share open desktop documents.

### N3 — Discover and inspect before editing

Enter [discover command](references/queries/discover-command.md), then [edit document](references/queries/edit-document.md) for the requested operation. Load these routes before analyzing the input. Inspect paths, dimensions, document/layer identity and relevant current state; preserve existing destinations with a new filename or a verified backup. Obtain current IDs and parameter docs from live discovery. Record a bounded operation and output plan. If inputs are missing, clarify only what cannot be inferred safely.

### N4 — Execute and track effects

Invoke the selected interface using structured argv/JSON. Keep engine parameters distinct from transport envelopes. Inspect every command/batch result, stderr and warnings; retain session/job identifiers. A successful transport response alone is not proof that the operation succeeded.

On command failure, partial batch, timeout, job uncertainty or recovery request, enter [recover operation](references/queries/recover-operation.md). Inspect actual effects before deciding a retry, undo or new session. Return to N3 for a corrected operation, N4 for a monitored job, or N5 for a recovered result. Return `FEATURE_UNSUPPORTED`, `PERMISSION_REQUIRED` or an explicit unresolved diagnosis when execution cannot continue within scope.

### N5 — Verify and deliver

Before output inspection, enter [verify output](references/queries/verify-output.md). Reopen saved projects, verify requested dimensions/layer properties, and inspect exported previews through an advertised host image-view capability when available. Report missing visual inspection and relevant warnings. Deliver only verified existing paths and an accurate completion state; retain recoverable work when acceptance fails.

## On-demand knowledge

At the first knowledge-dependent node, read [SCHEMA](references/SCHEMA.md), [index](references/index.md) and the recent [log](references/log.md), then batch-read only the current query and its linked topics. Return to the named main-line node with its completion output. Defer later QA/recovery pages until their trigger. The source manifest is maintenance provenance, not a runtime prerequisite.

## Boundaries and evolution

CLI/MCP local operations require no cloud credential. Additional AI providers require separate configuration and authorization. Raster text recognition, background reconstruction and font-license verification are separate capabilities; editable text does not prove font licensing. Keep application-specific image recipes outside this capability manual.

MCP/serve stdout is protocol-only. Preserve native exit status and manager stderr. Version-specific help, tool schemas and live command state govern invocation; this manual governs method and recovery. On a material contradiction, inspect state and return a diagnosis rather than trusting a generic hint.

macOS Apple Silicon and Windows x64 have native distribution and CLI/MCP integration coverage. Host mappings are implemented; a new host, bridge operation or workflow needs its own execution evidence. Protocol smoke is not clean-context Agent routing or visual acceptance. Maintain the evidence and gaps in the knowledge log; test recurring recovery cases through the real packaged entry.
