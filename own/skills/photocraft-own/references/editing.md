# Native editing contract

Choose `exec` for isolated operations, `serve` for a persistent document session, or `mcp` when the host supports MCP. All three use the same native PhotoCraft CLI. Native CLI help and command schemas are authoritative for the installed version.

Discover: `photocraft-own exec -- --help`, `photocraft-own exec -- commands --json`, and `photocraft-own exec -- describe COMMAND --json`. Confirm syntax in help before using uncertain flags.

Example isolated editable document:

```sh
photocraft-own exec -- run --new '{"width":96,"height":64,"background":"#204080"}' --cmd type.create --params '{"x":4,"y":28,"text":"Agent","size":16}' --out NEW_OUTPUT.psd
photocraft-own exec -- info NEW_OUTPUT.psd --compact
```

Native argument handling depends on the host shell; pass structured argument arrays when supported, especially on Windows. Never interpolate user text as shell code.

Persistent sessions require `--automation-read-root INPUT_DIR --automation-write-root OUTPUT_DIR`. Prefer separate input/output folders. Obtain a host-ready server definition with `mcp-config --read-root INPUT_DIR --write-root OUTPUT_DIR`; apply it only through the host’s authorized configuration mechanism. A generated definition does not automatically register a server.

Save `.pcraft` or `.psd` when editable layers are required and a separate PNG/JPEG for previews. Inspect actual layer kinds after reopening. Text replacement requires recognized or user-supplied text, positions, suitable fonts and background repair. Color grading uses the installed engine’s adjustment commands; the application chooses artistic intent.
