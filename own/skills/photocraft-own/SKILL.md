---
name: photocraft-own
description: Install, update, diagnose and use PhotoCraft Own for local image editing, editable text and adjustment layers, PSD/native projects, and Agent CLI or MCP sessions. Use when the user selects PhotoCraft Own or asks to manage @petercjl/photocraft-own.
---

# PhotoCraft Own

## Contract and responsibility

Input: an explicit local image operation, input files, desired output, and authorized file scope; or an installation/update request. Output: verified artifacts and their absolute paths, or a structured diagnosis. This capability executes image operations. The calling application owns design choices, prompts, asset selection and visual acceptance.

The canonical Skill ships in `@petercjl/photocraft-own`. Discover it with `photocraft-own skill source --json`; managed Agent copies are installation targets. No nested Skill dependency is required. Runtime configuration and credentials stay outside this package.

## Main line

1. Determine the Agent and OS from host context. Load only its adapter in `adapters/`. Resolve logical `command.execute` through the host’s advertised command execution tool. If unavailable, return `CAPABILITY_UNAVAILABLE`; do not invent an adapter.
2. Probe `photocraft-own version`, `capabilities`, and `doctor --json`. For installation, update or diagnosis load [lifecycle](references/lifecycle.md), perform that branch, then return here. An installed npm manager and an installed native runtime are distinct states.
3. Inspect the input and intended output paths. Preserve existing files with a new filename or a verified backup. Use `photocraft-own exec -- --help` and native command schemas to discover current operations. Load [editing](references/editing.md) when choosing CLI, persistent session or MCP. Keep the caller’s parameters and placement intent explicit.
4. Execute the requested operation through `photocraft-own exec`, `serve`, or `mcp`. Use narrowly scoped read/write roots for persistent sessions. Engine failures return to command discovery; unsupported requirements return `FEATURE_UNSUPPORTED` to the caller.
5. Reopen outputs through the native CLI, confirm dimensions/layers and the requested change, then inspect rendered pixels through the host’s image-view capability when available. If visual inspection is unavailable, report it. Deliver absolute paths and distinguish editable projects from flattened exports.

## Boundaries and recovery

Local CLI/MCP needs no cloud credentials and incurs no service charge. Additional AI providers require separate configuration and user authorization. OCR and font-license verification are separate capabilities: native text layers do not establish a font’s license or automatically recognize raster text.

MCP/serve stdout is reserved for the native protocol; manager errors go to stderr. Preserve native exit status. Handle `NOT_INSTALLED` via lifecycle; `APP_RUNNING` by asking the user to close the desktop before activation; `BUSY` or `RECOVERY_REQUIRED` by inspecting doctor and transaction records. Never delete a lock without checking its process. `CHECKSUM_MISMATCH`, `UNSAFE_ARCHIVE`, `INVALID_RUNTIME` stop activation and retain the previous version. `UNMANAGED_TARGET` and `LOCAL_EDITS` preserve the existing Skill and return a migration choice to the owner.

## QA and evolution

Verify through the real CLI entry point; schema compatibility alone is not runtime evidence. macOS Apple Silicon and Windows x64 have native distribution, installation, CLI/MCP image-editing and lifecycle integration coverage. The macOS desktop has been visually inspected. Windows desktop interaction, live SealSeek invocation and clean-context regression remain unverified. Report OS execution evidence separately from Agent-host evidence.

Keep application-specific image strategies outside this capability Skill. Add recurring atomic operations to the stable CLI contract with validation and recovery tests.
