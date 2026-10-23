---
name: notes
description: Read, search, create or change notes, tasks, commitments, papers, projects, people, meetings or daily notes in the owner's Obsidian vault `notes`. Use when work needs where something stands, what comes next, a deadline or an earlier decision, and before ending work that changes a commitment's state.
---

# Notes

The `notes` vault holds the owner's work and personal notes, and you maintain them together with the owner. `Conventions.md` in the vault defines names, note types, properties, tasks and editing. Read it before changing the vault, and follow it where it differs from this skill.

## Reach the vault

- While Obsidian runs, `vault://notes/<path>` reads and writes notes from any session, and `?op=` queries search, list tasks, backlinks, properties and unresolved links, and query bases.
- Otherwise use the folder: `~/src/github.com/glockyco/notes` on Korolev and `~/notes` on the Mac.
- Create typed notes from their templates with `obsidian create name="<name>" template=<template>`. Rename notes only with `obsidian rename`, because it updates every link. Never move or rename note files directly.
- Checkboxes in `Templates/` are template content. Leave them out of task lists.

## Write

- The documentation rule does not cover vault notes. Keep dates, history and who decided what.
- Fix wrong or outdated notes in place. When a decision is reversed, record what changed and when.
- Before you stop working on a commitment, update its `Resume here:` line and its dated tasks.

## Commit

- Only Korolev's copy is a Git repository. After changing the vault there, stage your changes, commit them with `personal_commit` and push to `origin` right away. Vault commits are the one exception to asking before a push, because the repository is the vault's backup.
- The pre-commit hook scans for secrets with gitleaks. Never bypass it. If it fails because `gitleaks` is missing from PATH, report that instead of committing.
- The Mac has no repository. Obsidian Sync carries its changes to Korolev, where the next commit includes them.
