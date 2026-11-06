---
alwaysApply: true
description: Keep the handoffs of papers, projects, supervisions, talks and topics current across sessions.
---

# Project handoff

The `notes` vault has a note for each paper, project, supervision, talk and topic, which it calls items. An item note lists its repositories under `links`, and its `Resume here:` line says how to pick the work up. The steps are tasks in the note, and decisions that last are under its Notes heading.

- When a session works on an item, link the session to it with the `workbench` tool, which returns the item's note with its `Resume here:` line, steps, waiting follow-ups and repository work. A session that starts in an item's repository is linked already and receives that handoff with its first prompt. Link again when the work moves to another item. Without the tool, find the note whose `links` contain the repository's URL, which a search of `vault://notes/` for the URL finds, and read the note before you start.
- Before you finish such a session, rewrite the item's `Resume here:` line and put each fact it leaves out where `Conventions.md` says under Item notes.
- Change and commit the vault as the `notes` skill describes.
- Skip the handoff when no note exists for the work.
