---
name: notes
description: Read, search, create or change notes, tasks, papers, projects, people, meetings or daily notes in the Obsidian vault `notes`, which holds work and personal notes. Use when work needs where something stands, what comes next, a deadline or an earlier decision, and before ending work that changes the state of an item such as a paper or project.
---

# Notes

The `notes` vault holds work and personal notes. `Conventions.md` in the vault defines folders, names, properties, tasks and editing. Read it before changing the vault, and follow it where it differs from this skill.

## Reach the vault

- While Obsidian runs, `vault://notes/<path>` reads and writes notes from any session, and `?op=` queries search, list tasks, backlinks, properties and unresolved links, and query bases.
- Home and the panels in item and person notes are drawn by the Workbench plugin, so their notes hold only a `workbench` code block. While Obsidian runs, read the model they show with `obsidian eval code="JSON.stringify(app.plugins.plugins['glockyco-workbench'].api.home())"`, or `api.item('<note path>')` for one note's panel.
- Otherwise use the folder: `~/src/github.com/glockyco/notes` on Korolev and `~/notes` on the Mac.
- Create notes from their templates where `Conventions.md` says, with `obsidian create path="<path>" template=<template>`. Move and rename notes only with `obsidian move` and `obsidian rename`, because they update every link. Never move or rename note files directly.
- Checkboxes in `Templates/` are template content. Leave them out of task lists.

## Write

- The documentation rule does not cover vault notes. Keep dates, history and who decided what.
- Fix wrong or outdated notes in place. When a decision is reversed, record what changed and when.

## Commit

- Only Korolev's copy is a Git repository. After changing the vault there, stage your changes, commit them with `personal_commit` and push to `origin` right away. Vault commits are the one exception to asking before a push, because the repository is the vault's backup.
- The pre-commit hook scans for secrets with gitleaks. Never bypass it. If it fails because `gitleaks` is missing from PATH, report that instead of committing.
- The Mac has no repository. Obsidian Sync carries its changes to Korolev, where the next commit includes them.
