# Open, edit and save

1. Preflight authorized paths and existing destinations. Inspect source dimensions and layer metadata. For headless persistent work use `doc_open`/`doc_new`, then `doc_inspect`; refresh active document and selection after commands that create or change documents.
2. Discover the requested command family and current parameter docs. Match caller intent to explicit operations. For editable color changes, discover adjustment-layer commands such as `layer.newAdjustmentLayer.vibrance`; application/caller chooses values and artistic direction. Confirm resulting layer kinds rather than assuming every adjustment preserves editability.
3. Execute a bounded operation, inspect returned effects/warnings, save a `.pcraft` or `.psd` when editable layers are required, and export PNG/JPEG separately for preview. Reopening is the verification gate; file extension alone does not prove feature preservation.

A small one-shot example, to be checked against installed help before use:

```sh
photocraft-own exec -- run --new '{"width":96,"height":64,"background":"#204080"}' --cmd type.create --params '{"x":4,"y":28,"text":"Agent","size":16}' --out NEW_OUTPUT.psd
photocraft-own exec -- info NEW_OUTPUT.psd --compact
```

`NEW_OUTPUT.psd` denotes a new authorized destination. Prefer argv execution over constructing shell text. For multiple input files, discover native `batch`/`droplet` help and action format; do not reuse MCP batch envelopes. Batch output must be separate from input unless replacement is explicitly authorized. Run unknown action files only within appropriate isolation.

## Text and fonts

Raster text replacement needs recognized or supplied content, placement and a background-repair capability. `type.create` creates editable type; it does not perform OCR or establish font licensing. Inspect installed fonts and text-layer properties before replacing. The caller chooses content, font and layout.

Missing font families produce stderr warnings in CLI convert/run, per-command warnings in run, and `warnings` in `info --compact`. A fallback render is not an exact font match. Saved font declarations remain unchanged. Discover `type.resolveMissingFonts` for an explicit list/replacement decision, and verify after saving; do not silently substitute a family.

## Embedded Smart Objects

Discover `layer.smartObjects.editContents`, `convertToLayers` and `saveContents`; target `params.layer` only as documented for the installed command. Editing contents changes active-document context. Save nested contents from inside outward with `saveContents` to update parents in memory, then save the parent project to its authorized path. `doc_save` on a contents document exports that document; it does not update its parent. Refresh session/document identities at each boundary. External linked sources may be refused by the control policy; report the limitation rather than expanding authority.
