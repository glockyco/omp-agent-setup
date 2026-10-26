---
alwaysApply: true
description: Keep the handoffs of papers, projects, supervisions, talks and topics current across sessions.
---

# Project handoff

The `notes` vault has a note for each paper, project, supervision, talk and topic, which it calls items. An item note lists its repositories under `links`, and its `Resume here:` line says where the work stands and what comes next.

- When a session works on an item, link the session to it with the `workbench` tool, which returns the item's note and `Resume here:` line. A session that starts in an item's repository is linked already and receives that handoff with its first prompt. Link again when the work moves to another item. Without the tool, find the note whose `links` contain the repository's URL, which a search of `vault://notes/` for the URL finds, and read its `Resume here:` line before you start.
- Before you finish such a session, rewrite the line so that a session with no other context can continue from it: where the work stands and the next step. Add or update dated tasks for steps that have a date. Change and commit the vault as the `notes` skill describes.
- Skip both when no note exists for the work.
