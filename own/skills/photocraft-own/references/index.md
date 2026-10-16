# Task routes

| Current need | Route | Completion / return |
|---|---|---|
| Install, update, diagnose | [manage installation](queries/manage-installation.md) | Resolved executable and installation state → N1 |
| Choose CLI, serve, MCP or live desktop | [choose interface](queries/choose-interface.md) | Surface, session owner and scope → N2 |
| Find an operation and its parameters | [discover command](queries/discover-command.md) | Current enabled ID and parameter contract → N3 |
| Open, edit and save layers/documents | [edit document](queries/edit-document.md) | Bounded operation and artifact plan → N3/N4 |
| Failed, timed-out or partial operation | [recover operation](queries/recover-operation.md) | Observed effects and recovery decision → N3/N4/N5 |
| Check files, layers, pixels and warnings | [verify output](queries/verify-output.md) | Evidence and accurate delivery state → N5 |

For desktop work, choose-interface links to the bridge topic only when the caller requests the live app. Recovery and verification are separate deferred branches. Compatibility entry: [editing](editing.md).
