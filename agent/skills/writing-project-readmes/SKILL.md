---
name: writing-project-readmes
description: Use when creating, reviewing, or updating human-facing README.md files for software projects, especially when setup, usage, architecture, or maintainer onboarding may be stale, missing, or duplicated.
---

# Writing Project READMEs

## Core principle

README is the human entry point, not the manual. A reader should understand what the project is, why it exists, and how to start within the first screen.

## Living sources

Use current public guidance for generic README expectations instead of preserving stale local doctrine:

- GitHub README documentation: https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-readmes
- The Good Docs README template: https://www.thegooddocsproject.dev/template/readme

Use repo-local sources for facts:

- `package.json`, task runners, CI, hooks, lockfiles, and tool version files for commands.
- Existing README/docs for audience and terminology.
- `AGENTS.md` for agent-only workflows that should usually be linked, not copied.
- `LICENSE`, `CONTRIBUTING.md`, `SECURITY.md`, architecture docs, and deployment docs when present.

## Before editing

Inspect only enough to ground the change:

- Existing `README.md`.
- Agent instruction files so agent-only constraints stay out of human docs.
- Manifests, task runners, CI, and scripts for real commands.
- Docs and code layout only enough to validate claims.
- Referenced files/directories before linking them.

Use OMP-native tools available in the session (`read`, `grep`, `glob`, LSP, AST tools). Do not shell out for file discovery or content search.

## Content model

Root README usually includes:

| Section | Purpose |
|---|---|
| Project name + value | What this is and why it exists |
| Scope / audience | Who should use it; when not to use it if important |
| Requirements | Runtime/tool prerequisites |
| Quickstart | Verified commands, not conventional guesses |
| Common commands | Table of actual scripts/tasks |
| Architecture / layout | Only orientation facts that help humans |
| Operations | Update, deploy, rollback, or recovery only when humans need it |
| Links | Deeper source-of-truth docs instead of copied content |
| License | Link or short statement |

Subdirectory READMEs are rare. Add one only when the subtree is a real entry point with distinct concepts, workflows, or ownership.

## Rules

- Keep README human-facing. Link to agent instructions instead of copying agent-only boundaries or tool constraints.
- Start with purpose and usefulness before technology stack.
- Prefer source-backed commands. If `package.json` has `check:test`, do not document `npm test` by habit.
- Link to source-of-truth docs instead of duplicating them.
- Use relative links for in-repo files.
- Omit sections that do not apply.
- Remove placeholders, stale output, generic boilerplate, and process lore.
- If changing setup or verification commands, verify command existence statically by default.
- Do not run setup, bootstrap, install, deploy, migration, credentialed, expensive, networked, external-service, or write-config commands just to verify docs; verify static prerequisites and mark manual-only checks.

## Verification

- Verify every referenced file or directory exists.
- Verify documented scripts exist in manifests or task runners.
- Search for stale references after renaming or deleting documentation files.
- If a command was removed from the manifest, remove it from README command tables in the same change.

## Common mistakes

| Mistake | Fix |
|---|---|
| Copying `AGENTS.md` into README | Keep README human-facing; link to `AGENTS.md` for agent operations |
| Documenting conventional `npm test` / `npm run build` | Inspect manifests and document actual commands |
| Long hand-written file trees | Describe stable concepts and link to docs |
| Badges and internals before purpose | Put value and quickstart first |
| Generic best-practice prose | Cite current external guidance or delete it |
