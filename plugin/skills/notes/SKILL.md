---
name: notes
description: Read, search, create or change notes, tasks, papers, projects, people, meetings or daily notes in the Obsidian vault `notes`, which holds work and personal notes. Use when work needs where something stands, what comes next, a deadline or an earlier decision, and before ending work that changes the state of an item such as a paper or project.
---

# Notes

The `notes` vault holds work and personal notes. `Conventions.md` in the vault defines folders, names, properties, tasks and editing. Read it before changing the vault, and follow it where it differs from this skill.

## Reach the vault

- While Obsidian runs, `vault://notes/<path>` reads and writes notes from any session, and `?op=` queries search, list tasks, backlinks, properties and unresolved links, and query bases.
- Home, the review, Portfolio and the panels in item and person notes are drawn by the Workbench plugin, so their notes hold only a `workbench` code block. While Obsidian runs, read the model Home shows with `obsidian eval code="app.plugins.plugins['glockyco-workbench'].api.now().then(model => JSON.stringify(model))"`, and the same way `api.review()` for the weekly review, `api.portfolio('<YYYY-MM>')` for Portfolio's month or `api.item('<note path>')` for one note's panel.
- Otherwise use the folder: `~/src/github.com/glockyco/notes` on Korolev and `~/notes` on the Mac.
- Create notes from their templates where `Conventions.md` says, with `obsidian create path="<path>" template=<template>`. Move and rename notes only with `obsidian move` and `obsidian rename`, because they update every link. Never move or rename note files directly.
- Checkboxes in `Templates/` are template content. Leave them out of task lists.

## Write

- The documentation rule does not cover vault notes, so notes keep dates and who decided what, as `Conventions.md` describes for Notes.
- Fix wrong or outdated notes in place. When a decision is reversed, record what changed and when.
- Propose a change to `Conventions.md` in Plannotator and make it only once approved, never as a side effect of other work. Describe a plugin's behavior in its README.

## Commit

- Both machines keep a Git clone of the vault, and neither is special. After changing the vault, pull with rebase, stage all pending changes, not only your own, commit them with `personal_commit` and push to `origin` right away. Vault commits are the one exception to asking before a push, because the repository is the vault's backup.
- Leave out files changed in the last 15 minutes, because another session or Obsidian may still be editing them. A later commit picks them up.
- Obsidian Sync brings the same edit to both clones. The rebase pull drops a change that upstream already has.
- The pre-commit hook scans for secrets with gitleaks. Never bypass it. If it fails because `gitleaks` is missing from PATH, report that instead of committing.
