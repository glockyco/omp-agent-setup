---
alwaysApply: true
description: Keep the handoffs of papers, projects, supervisions, talks and topics current across sessions.
---

# Project handoff

The `notes` vault has a note for each paper, project, supervision, talk and topic, which it calls items. An item note lists its repositories under `links`, and its `Resume here:` line says where the work stands. The steps are tasks in the note, and decisions that last are under its Notes heading.

- When a session works on an item, link the session to it with the `workbench` tool, which returns the item's note with its `Resume here:` line, steps, waiting follow-ups and repository work. A session that starts in an item's repository is linked already and receives that handoff with its first prompt. Link again when the work moves to another item. Without the tool, find the note whose `links` contain the repository's URL, which a search of `vault://notes/` for the URL finds, and read the note before you start.
- Before you finish such a session, write a new `Resume here:` line that says where each piece of work in progress stands now, in a sentence or two each, because Home shows the line under the item's next step and the review shows its first sentence. Leave out work that is finished or not started yet, and the steps, decisions, commits and checks that the note's tasks and Notes, Git and Workbench already show. Then find a place for each fact of the old line that the new line leaves out, including facts that other sessions wrote:
  - A step that an OpenSpec change or an issue tracks stays there, because Workbench shows it.
  - Any other step, or a fact that calls for one, becomes a task in the note, the next one first, with its date when it has one. Waiting on someone becomes a `#waiting` task that names them.
  - A decision or constraint that outlasts the work, such as content a developer asked to keep unpublished, goes under Notes with its date.
  - History is left out, and so is what Git, the repository and Workbench already show, such as commits, pushes, checks and how the code works.
- Change and commit the vault as the `notes` skill describes.
- Skip the handoff when no note exists for the work.
