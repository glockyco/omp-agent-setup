---
name: writing-agent-instructions
description: Use when creating, reviewing, or updating AGENTS.md, CLAUDE.md, .github/agents/*.md, or similar coding-agent instruction files for repository commands, conventions, boundaries, and tool workflows.
---

# Writing Agent Instructions

## Core principle

Agent instruction files are loaded context. Every line must prevent a real mistake, expose a repo-specific command, or point to the current source of truth.

## Living sources

Consult current sources before encoding generic guidance:

- AGENTS.md open format: https://agents.md/
- OpenAI Codex AGENTS.md behavior: https://developers.openai.com/codex/guides/agents-md
- OpenAI Codex skills behavior: https://developers.openai.com/codex/skills
- Agent Skills specification: https://agentskills.io/specification
- OMP project: https://github.com/can1357/oh-my-pi
- OMP local docs when available: `omp://context-files.md`, `omp://skills.md`, `omp://task-agent-discovery.md`, `omp://tools/task.md`, `omp://system-prompt-customization.md`

Do not copy generic advice from those sources into a repo file. Use them to verify current platform behavior, then write only the local consequence.

## Before editing

Inspect only what can ground the instruction file:

- Existing root and nested agent instruction files.
- README and docs to avoid duplication.
- Package manifests, task runners, CI, hooks, and scripts for exact commands.
- Test layout and code layout for repo-specific loops.
- Generated files, deployed copies, migrations, vendored code, secrets, plugin forks, patches, and other boundaries.
- Referenced local skills and rules; confirm the names exist before linking `skill://...`.

Use OMP-native tools available in the session (`read`, `grep`, `glob`, LSP, AST tools). Do not shell out for file discovery or content search.

## File policy

- Prefer `AGENTS.md` as the canonical OMP/cross-agent source of truth.
- Use `CLAUDE.md` only when Claude Code compatibility is required; keep it as a symlink or tiny adapter when possible.
- Add nested instruction files only for materially different commands, generated artifacts, ownership, safety boundaries, or tool workflows.
- Keep global/user instructions and project instructions separate; do not hide project-specific policy in global files.

## Content model

Root `AGENTS.md` usually includes:

| Section | Include |
|---|---|
| Purpose | One sentence naming the repo and managed surface |
| Setup | Install/bootstrap command, if real |
| Commands | Exact scripts for verify, test, lint/typecheck, build, fix, deploy |
| Architecture | Facts agents cannot infer cheaply |
| Tests | Locations, scoped loop, final gate |
| Commits / PRs | Repo policy or `skill://commit` |
| Boundaries | Generated/deployed files, secrets, migrations, forks, runtime traps |
| Recovery | Repo-specific failure signals and fixes |

## Rules

- Put commands early.
- Keep loaded instruction files concise; link deep details.
- Use concrete, verifiable statements over generic advice.
- Prefer positive instructions; use `Don't / Instead` tables for dangerous recurring mistakes.
- Reference a skill only when a project convention depends on it.
- Distinguish guidance from enforcement. If a rule must be guaranteed, prefer tooling, hooks, CI, or config.
- Delete stale process lore instead of rephrasing it.

## Verification

- Verify every referenced file or directory exists.
- Verify documented commands exist in manifests, task runners, or scripts.
- If changing documented commands, run only clearly read-only scoped checks unless the user approved broader commands.
- Do not run setup, bootstrap, install, deploy, migration, credentialed, expensive, networked, external-service, or write-config commands just to verify docs; verify static prerequisites and mark manual-only checks.
- Search living instruction/README/skill surfaces for stale names after renames or removals.

## Common mistakes

| Mistake | Fix |
|---|---|
| Generic `write clean code` / `follow best practices` | Replace with repo-specific commands or boundaries, or delete |
| README copied into AGENTS | Link README; keep only agent-operational facts |
| Full `CLAUDE.md` fork of `AGENTS.md` | Symlink or minimal compatibility adapter |
| Nested files for identical packages | Put shared workflow once at the lowest common ancestor |
| Project-wide tests as the default loop | Document scoped checks first and final gate separately |
| Stale methodology plugin references | Replace with current platform docs and local tooling |
