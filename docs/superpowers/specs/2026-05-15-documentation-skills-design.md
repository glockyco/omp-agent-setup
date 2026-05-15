# Documentation Skills Design

## Purpose

Create two local OMP-managed skills for recurring project documentation work:

1. `writing-project-readmes` for human-facing `README.md` files.
2. `writing-agent-instructions` for agent-facing `AGENTS.md`, `CLAUDE.md`, and closely related instruction files.

The skills should make agents produce concise, useful, source-backed documentation without duplicating content across files or introducing stale boilerplate.

## Decision

Write our own skills. Use external sources as design inputs, not installable dependencies.

Borrow from:

- GitHub README guidance: README explains why the project is useful, what users can do with it, and how to get started.
- The Good Docs Project: project description and user value come before technology details.
- AGENTS.md format: AGENTS.md is a README for agents, separate from human README content.
- Claude Code memory docs: CLAUDE.md is context, not enforcement; keep it concise and move conditional procedures into skills or scoped rules.
- OpenAI Codex AGENTS.md docs: AGENTS.md files layer from global to project to nested paths; closer files override earlier guidance.
- Sentry `agents-md`: commands early, concrete boundaries, positive wording, no generic instructions, iterate from observed failures.
- KemingHe `readme-creation`: README as entry point, 30-second test, link out instead of duplicating.

Do not adopt third-party skills wholesale. Existing skills either assume different harness rules, include provider-specific conventions, or blur README and agent-instruction audiences.

## Non-goals

- Do not create a generic documentation generator.
- Do not install third-party skill collections.
- Do not add auto-updating or network-fetching skill behavior.
- Do not enforce markdown style rules that are not already project conventions.
- Do not replace Superpowers planning, review, or TDD skills.
- Do not put long procedural workflows into `AGENTS.md` or `README.md`.

## Skill 1: `writing-project-readmes`

### Trigger

Use when creating, reviewing, or updating `README.md` files for software projects, especially when setup, usage, architecture, or maintainer onboarding information may be stale, missing, or duplicated.

### Audience

Human readers: future maintainers, contributors, users, and the owner returning after time away.

### Core principle

README is the entry point, not the manual. A reader should understand what the project is, why it exists, and how to start within the first screen.

### Required inspection

Before editing a README, inspect only what is needed to ground the change:

- Existing `README.md`.
- `AGENTS.md` or `CLAUDE.md` for agent-only content that should not be duplicated.
- Package manifests and task runners for actual commands.
- CI workflows for canonical gates when package scripts are ambiguous.
- `docs/`, `CONTRIBUTING.md`, `SECURITY.md`, `LICENSE`, and architecture docs when present.
- Existing code layout only enough to validate claims.

Use OMP-native tools: `read`, `find`, `search`, `ast_grep` when syntax-aware lookup matters, and task runner recipes where available. Do not use shell file-inspection substitutes.

### Content model

A root README should usually include:

- Project name and concise value statement.
- Audience or scope, including when not to use it if that matters.
- Requirements.
- Quickstart with commands verified against repo files.
- Common commands, preferably as a table.
- High-level architecture or layout only when it helps orientation.
- Operational notes: update, deploy, troubleshoot, rollback, or recovery when relevant.
- Links to deeper source-of-truth docs.
- License.

Subdirectory READMEs should be rarer. Create or update one only when a subtree is a meaningful entry point with different concepts, workflows, or ownership.

### Rules

- Keep README human-facing. Do not move agent operational constraints into README unless human maintainers also need them.
- Start with purpose and usefulness before technology stack.
- Link to source-of-truth docs instead of copying them.
- Use relative links for in-repo files.
- Prefer tested commands over inferred commands.
- Keep badges minimal and useful.
- Omit sections that do not apply.
- Remove placeholders, stale command output, and generic boilerplate.
- If changing setup or verification commands, run the smallest command that proves the documented command still exists or behaves as claimed.

### Anti-patterns

- README as exhaustive manual.
- README that begins with badges, file trees, or implementation details before purpose.
- Duplicating `AGENTS.md`, `CONTRIBUTING.md`, `SECURITY.md`, or generated CLI help.
- Long hand-written tables of every file in a changing tree.
- Untested quickstart commands.
- Generic open-source sections in private or personal repos.

## Skill 2: `writing-agent-instructions`

### Trigger

Use when creating, reviewing, or updating `AGENTS.md`, `CLAUDE.md`, `.github/agents/*.md`, or similar coding-agent instruction files for repository-specific commands, conventions, boundaries, and tool workflows.

### Audience

Coding agents operating in the repository.

### Core principle

Agent instruction files are loaded context. Every line must pay rent by preventing a real mistake or making necessary commands and constraints cheap to find.

### Required inspection

Before editing agent instructions, inspect:

- Existing `AGENTS.md`, `CLAUDE.md`, nested instruction files, and agent rules.
- README and relevant docs to avoid duplication.
- Package manifests, task runners, and CI workflows for exact commands.
- Test layout and code layout for repo-specific conventions.
- Generated files, deployment directories, migration folders, vendored code, secrets handling, and other boundaries.
- Existing skills referenced by the repo, especially `skill://commit` and Superpowers skills.

### File policy

- Prefer `AGENTS.md` as the canonical cross-agent source of truth in OMP-managed repos.
- Use `CLAUDE.md` only when Claude Code compatibility is required.
- If both are needed, avoid divergent copies:
  - Prefer a symlink when the content is identical and the environment supports it.
  - Otherwise use a minimal `CLAUDE.md` that imports `@AGENTS.md` and adds only Claude-specific deltas.
- Add nested instruction files only when a subtree has materially different commands, conventions, generated artifacts, or safety boundaries.

### Content model

A root `AGENTS.md` should usually include:

- One-sentence project purpose.
- Setup command.
- Commands table with install, test, lint/typecheck, build, verify, and fix commands when present.
- Architecture or layout facts agents cannot infer cheaply.
- Testing expectations and where tests live.
- Code style only when not fully enforced by tooling or easy to get wrong.
- Commit / PR conventions, preferably by referencing `skill://commit` or repo-specific source of truth.
- Boundaries: generated files, deployed copies, migrations, secrets, external services, plugin forks, non-obvious runtime constraints.
- Recovery or troubleshooting notes for common repo-specific failures.

### Rules

- Keep root instruction files concise: target under 100 lines; justify anything longer.
- Put commands early.
- Use concrete, verifiable statements over generic advice.
- Prefer positive instructions: `Use X` instead of `Do not forget X`.
- Use `Don't / Instead` tables for dangerous or recurring mistakes.
- Move multi-step workflows into skills or docs and reference them.
- Do not restate formatter, linter, or typechecker settings unless agents repeatedly violate them despite tooling.
- Do not list every installed skill. Reference a skill only when a project convention depends on it.
- Distinguish guidance from enforcement. If a rule must be guaranteed, prefer tooling, hooks, CI, or config.

### Anti-patterns

- Divergent `AGENTS.md` and `CLAUDE.md` copies.
- Generic slogans: `write clean code`, `follow best practices`, `be careful`.
- Long architecture prose duplicated from README.
- Rules that merely restate visible package metadata.
- Preemptive rules for mistakes not observed in this repo or common to this project type.
- Project-wide build/test commands when file-scoped commands exist and are the normal development loop.

## Shared verification behavior

Both skills must require evidence before claiming documentation is correct:

- Verify referenced files exist.
- Verify commands exist in manifests or task runners before documenting them.
- Run changed quickstart or verification commands when practical and scoped.
- If a command is destructive, credentialed, expensive, or external-service dependent, do not run it; document the reason and verify static prerequisites instead.
- Search for stale references after renaming or deleting documentation files.

## Expected implementation shape

Managed source files:

```text
agent/skills/writing-project-readmes/SKILL.md
agent/skills/writing-agent-instructions/SKILL.md
```

Bootstrap deploys each directory as a symlink under:

```text
~/.omp/agent/skills/<skill-name>
```

Bootstrap deploys both skill directories. `doctor` checks the deployed symlinks as managed agent files. `verify` includes both skills in loader-based `REQUIRED_SKILLS` discovery, as with `commit`.

This repo's managed-surface docs must be updated when the skill inventory changes. Update `README.md`, root `AGENTS.md`, and `agent/AGENTS.md` so maintainers can see every source-managed path deployed under `~/.omp/agent/`. Do not make unrelated user repos list installed skills.

## Testing plan for the skills

Follow `writing-skills`: no skill without failing scenarios first.

### Baseline pressure scenarios

Run each scenario without the new skill, document failures, then run again with the skill.

1. **README duplicates AGENTS**
   - Ask agent to improve a README in a repo with strong `AGENTS.md`.
   - Failure to catch: copies agent-only commands and boundaries into README.
   - Pass: README remains human-facing and links to AGENTS where useful.

2. **README quickstart hallucination**
   - Repo has package scripts with nonstandard names.
   - Failure to catch: documents `npm test` or `npm run build` by convention.
   - Pass: documents actual commands and verifies them statically or dynamically.

3. **Bloated AGENTS**
   - Ask agent to create AGENTS.md for a medium repo.
   - Failure to catch: long generic file with obvious style rules and repeated README content.
   - Pass: concise commands/conventions/boundaries only.

4. **Divergent CLAUDE copy**
   - Repo has `AGENTS.md`; ask to add Claude support.
   - Failure to catch: creates a separate full `CLAUDE.md` copy.
   - Pass: symlink or `@AGENTS.md` import with only Claude-specific deltas.

5. **Nested instructions overuse**
   - Monorepo-like structure with several packages but same workflow.
   - Failure to catch: creates nested AGENTS files everywhere.
   - Pass: root-only instructions unless subtree rules differ materially.

6. **Dangerous documentation command**
   - README references deploy or migration command.
   - Failure to catch: runs destructive/external command while verifying docs.
   - Pass: does not run it, verifies static prerequisites, marks manual verification.

### Quality gates

- Unit tests for bootstrap symlink planning, doctor managed-file checks, and verify `REQUIRED_SKILLS` discovery.
- `bun run ci` passes.
- `bun run bootstrap` deploys both skills.
- `bun run doctor` reports both skills healthy.
- `OMP_VERIFY_SKIP_ACCEPTANCE=1 bun run verify` discovers both skills.

## Open decisions

None for the initial implementation. The split into two skills is intentional; if usage shows agents need a shared documentation-architecture skill later, create it from observed failures rather than preemptively.
