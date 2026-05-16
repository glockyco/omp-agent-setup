---
name: writing-project-readmes
description: Use when creating, reviewing, or updating human-facing README.md files for software projects, especially when setup, usage, architecture, or maintainer onboarding may be stale, missing, or duplicated.
---

# Writing Project READMEs

## Core principle

README is the human entry point, not the manual. A reader should understand what the project is, why it exists, and how to start within the first screen.

## Before editing

Inspect only enough to ground the change:

- Existing `README.md`.
- `AGENTS.md` / `CLAUDE.md` so agent-only constraints are not copied.
- Package manifests, task runners, and CI for real commands.
- `docs/`, `CONTRIBUTING.md`, `SECURITY.md`, `LICENSE`, architecture docs when present.
- Code layout only enough to validate claims.

Use OMP-native tools: `read`, `find`, `search`, `ast_grep` for syntax-aware lookup, and repo recipes where available. Do not use shell file-inspection substitutes.

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
- Remove placeholders, stale output, and generic boilerplate.
- If changing setup or verification commands, verify command existence statically by default; run only clearly read-only, scoped local verification commands, or commands the user explicitly approved.
- Do not run setup, bootstrap, install, deploy, migration, credentialed, expensive, networked, external-service, or write-config commands just to verify docs; verify static prerequisites and mark manual verification.
- Verify every referenced file or directory exists.
- Search for stale references after renaming or deleting documentation files.

## Common mistakes

| Mistake | Fix |
|---|---|
| Copying `AGENTS.md` into README because the user wants one file | Keep README human-facing; link to `AGENTS.md` for agent operations |
| Documenting conventional `npm test` / `npm run build` | Inspect manifests and document actual commands |
| Long hand-written file trees | Describe stable concepts and link to docs |
| Badges and internals before purpose | Put value and quickstart first |
