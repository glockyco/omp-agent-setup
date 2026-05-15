---
name: writing-agent-instructions
description: Use when creating, reviewing, or updating AGENTS.md, CLAUDE.md, or similar coding-agent instruction files for repository commands, conventions, boundaries, and tool workflows.
---

# Writing Agent Instructions

## Core principle

Agent instruction files are loaded context. Every line must pay rent by preventing a real mistake or making necessary commands and constraints cheap to find.

## Before editing

Inspect:

- Existing `AGENTS.md`, `CLAUDE.md`, nested instruction files, and rules.
- README and docs to avoid duplication.
- Package manifests, task runners, and CI for exact commands.
- Test and code layout for repo-specific conventions.
- Generated files, deployed copies, migrations, vendored code, secrets, plugin forks, and other boundaries.
- Referenced skills, especially `skill://commit` and required Superpowers skills.

Use OMP-native tools; do not use shell file-inspection substitutes.

## File policy

- Prefer `AGENTS.md` as the canonical OMP/cross-agent source of truth.
- Use `CLAUDE.md` only when Claude Code compatibility is required.
- If `CLAUDE.md` and `AGENTS.md` share content, avoid divergent copies:
  - Prefer a symlink when identical and supported.
  - Otherwise use a minimal `CLAUDE.md` that imports `@AGENTS.md` and adds only Claude-specific deltas.
- Add nested instruction files only when a subtree has materially different commands, conventions, generated artifacts, or safety boundaries.

## Content model

Root `AGENTS.md` usually includes:

| Section | Include |
|---|---|
| Purpose | One sentence |
| Setup | Install/bootstrap command |
| Commands | Table for test, lint/typecheck, build, verify, fix when present |
| Architecture | Facts agents cannot infer cheaply |
| Tests | Where they live and scoped expectations |
| Style | Only repo-specific pitfalls not enforced by tools |
| Commits / PRs | Link to `skill://commit` or repo policy |
| Boundaries | Generated/deployed files, secrets, migrations, forks, runtime traps |
| Recovery | Common repo-specific failures and fixes |

## Rules

- Put commands early.
- Keep root instruction files concise; target under 100 lines and justify anything longer.
- Use concrete, verifiable statements over generic advice.
- Prefer positive instructions: `Use X` instead of `Do not forget X`.
- Use `Don't / Instead` tables for dangerous recurring mistakes.
- Move multi-step workflows into skills or docs and reference them.
- Do not restate formatter, linter, or typechecker settings unless agents repeatedly violate them despite tooling.
- Do not list every installed skill. Reference a skill only when a project convention depends on it.
- Distinguish guidance from enforcement. If a rule must be guaranteed, prefer tooling, hooks, CI, or config.

## Verification

- Verify every referenced file or directory exists.
- Verify documented commands exist in package manifests, task runners, CI, or repo docs before writing them.
- If the edit changes setup, test, deploy, or recovery commands, run the smallest safe scoped command that proves the documented behavior when practical.
- Do not run destructive, credentialed, expensive, or external-service commands; verify static prerequisites and mark manual verification instead.
- Search for stale references after renaming or deleting instruction files.

## Common mistakes

| Mistake | Fix |
|---|---|
| Generic `write clean code` / `follow best practices` | Replace with repo-specific commands or boundaries, or delete |
| Long AGENTS copied from README architecture | Link README; keep only agent-operational facts |
| Full `CLAUDE.md` copy of `AGENTS.md` | Symlink or minimal import adapter |
| Nested AGENTS files for identical packages | Put shared workflow once at the lowest common ancestor |
| Project-wide tests as the default loop when scoped tests exist | Document the scoped loop and the final gate separately |
