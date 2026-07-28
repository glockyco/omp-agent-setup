---
name: remnote
description: Operating the RemNote knowledge base over MCP - recovery when the bridge is down, and write safety
---
RemNote notes are reachable from every session through the `remnote` MCP server
on `http://127.0.0.1:3001/mcp`. A launchd agent keeps the local daemon alive, so
there is no manual start step.

Tools need RemNote.app open, because the daemon reaches the knowledge base
through a bridge plugin running inside the app. When a `remnote_*` tool reports
`connected: false` or "RemNote plugin not connected", run `open -a RemNote`,
wait a few seconds, then retry once. Do not ask the user to start it manually.

Never fall back to reading or writing the SQLite store directly at
`~/remnote/remnote-<userId>/remnote.db`. Reads there miss unsynced state, and
writes bypass the sync layer's per-field update clocks and are lost or
corrupted on the next sync.

Writes are real and sync to the user's account. `remnote_replace_children` is
destructive by design and clears all children when passed empty content. Only
`remnote_move_note` and `remnote_set_document_status` default to `dryRun: true`.
Confirm with the user before a first-time destructive write.
