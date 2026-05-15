# Documentation and Skill Authoring Skills Design

## Purpose

Create three local OMP-managed skills for recurring project documentation and skill-authoring work:

1. `writing-project-readmes` for human-facing `README.md` files.
2. `writing-agent-instructions` for agent-facing `AGENTS.md`, `CLAUDE.md`, and closely related instruction files.
3. `writing-omp-skills` for creating, reviewing, adapting, and validating local OMP/Superpowers skills.

The skills should make agents produce concise, useful, source-backed documentation and skills without duplicating content across files, introducing stale boilerplate, or expanding the skill trust boundary without review.

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
- Agent Skills specification: each skill is a directory whose `SKILL.md` has required `name` and `description` frontmatter; names must match the parent directory and use lowercase letters, numbers, and hyphens.
- Anthropic Agent Skills best practices: good skills are concise, well-structured, tested with real usage, and use progressive disclosure so metadata, `SKILL.md`, references, scripts, and assets load only when needed.
- Anthropic `skill-creator`: description quality and representative evals are first-class parts of skill authoring, but its Claude-specific eval mechanics should not be adopted wholesale.
- Sentry `skill-writer`: `SKILL.md` should act as a runtime router; capture source coverage before authoring; choose the simplest adequate skill shape.
- Sentry `skill-scanner`: treat third-party skill adoption as a security review problem covering prompt injection, scripts, permissions, config poisoning, external URLs, and supply-chain risks.

Do not adopt third-party skills wholesale. Existing skills either assume different harness rules, include provider-specific conventions, or blur README and agent-instruction audiences.

## Non-goals

- Do not create a generic documentation generator.
- Do not install third-party skill collections.
- Do not add auto-updating or network-fetching skill behavior.
- Do not enforce markdown style rules that are not already project conventions.
- Do not replace Superpowers planning, review, TDD, or existing `writing-skills` discipline; the local `writing-omp-skills` skill is an OMP deployment and portability adapter.
- The local skill-authoring skill is named `writing-omp-skills` to avoid colliding with the existing Superpowers `writing-skills` skill while making its OMP-managed scope explicit.
- Do not put long procedural workflows into `AGENTS.md` or `README.md`.
- Do not use Claude Code-only extensions, hooks, dynamic shell injection, broad `allowed-tools`, or provider-specific frontmatter unless OMP explicitly supports them and the need is tested.

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

## Skill 3: `writing-omp-skills`

### Trigger

Use when creating, reviewing, updating, adapting, testing, or validating local OMP/Superpowers skills under `agent/skills/<name>/SKILL.md`, including when evaluating third-party skill material for possible adoption.

### Audience

Agents authoring skills for future agents, plus maintainers reviewing the resulting skill contract.

### Core principle

Skill writing is process TDD plus progressive disclosure. First identify observed agent failures, then write the smallest instruction set that changes behavior, then retest and close rationalization loopholes.

### Required inspection

Before creating or materially changing a skill, inspect:

- Existing local skill directories under `agent/skills/` and plugin-provided skills that define naming, frontmatter, and structure conventions.
- Root `AGENTS.md`, `agent/AGENTS.md`, and README managed-surface docs.
- The current Superpowers `writing-skills` skill and any required background skills it names.
- The Agent Skills specification for frontmatter and directory constraints.
- Current official or upstream source material only as design input, not as installable dependency.
- Deployment expectations in `src/bootstrap.ts`, `src/cli.ts`, and tests when the skill will be managed globally.

Use OMP-native tools and the existing task/review workflow. Do not use shell file-inspection substitutes or Claude Code-only commands.

### Content model

A local skill-authoring skill should usually cover:

- When to create a skill versus using `AGENTS.md`, README, tests, tooling, or an existing skill.
- Required RED/GREEN/REFACTOR loop for skill documentation: baseline pressure scenarios first, minimal skill second, retest and refine third.
- Standards-compliant structure: `agent/skills/<name>/SKILL.md`, YAML frontmatter, and Markdown instructions.
- Frontmatter rules: `name` matches directory, uses lowercase letters/numbers/hyphens, avoids leading/trailing/consecutive hyphens, and stays within 64 characters; `description` is non-empty, under 1024 characters, third person, specific, and includes both a short capability summary and trigger contexts.
- Local description rule: prefer capability-plus-trigger descriptions that avoid summarizing the workflow, because process-heavy descriptions can cause agents to shortcut the body.
- Progressive disclosure: keep `SKILL.md` concise and move optional, long, or mutually exclusive material to direct one-level `references/`, `examples/`, `scripts/`, or `assets/` files only when justified.
- Security/adoption review for third-party skills: inspect all bundled files, description/body alignment, scripts, symlinks, hooks or lifecycle behavior, external URLs, credential reads, config writes, and broad permissions before borrowing content.
- Deployment checklist for managed global skills: bootstrap symlink, doctor managed-file check, verify `REQUIRED_SKILLS`, docs inventory, and focused tests.

### Rules

- Do not write or edit a skill before baseline pressure scenarios exist.
- Do not install or vendor third-party skills wholesale. Borrow source-backed ideas and write local OMP-compatible skills.
- Keep `SKILL.md` as runtime guidance, not an encyclopedia.
- Add scripts only when deterministic validation or generation materially improves reliability over instructions alone.
- If adding scripts, keep them self-contained, documented, local, and non-networked by default; avoid global package installation and hidden side effects.
- Use direct file references from `SKILL.md`; avoid nested reference chains.
- Test discovery false negatives and false positives: the skill should trigger for local OMP skill-authoring work, should not trigger for ordinary README or AGENTS updates handled by the other skills, and should be distinguishable from the existing Superpowers `writing-skills` skill.
- After writing any managed skill, update deployment wiring and managed-surface docs in the same logical change.

### Anti-patterns

- A generic prompt-engineering skill that overlaps README and AGENTS maintenance instead of focusing on skill authoring.
- Writing a skill from confidence rather than baseline failures.
- Dumping all research, examples, evals, and theory into `SKILL.md`.
- Vague descriptions such as `Helps write skills`.
- Workflow-summary descriptions that make the model skip the skill body.
- Unnecessary `allowed-tools`, hidden scripts, network fetches, hooks, or config writes.
- Copying Claude Code, skills.sh, or API-upload assumptions into OMP filesystem skills.
- Testing only explicit invocation while ignoring automatic discovery behavior.

## Shared verification behavior

All three skills must require evidence before claiming documentation or skill artifacts are correct:

- Verify referenced files exist.
- Verify commands exist in manifests or task runners before documenting them.
- Run changed quickstart or verification commands when practical and scoped.
- If a command is destructive, credentialed, expensive, or external-service dependent, do not run it; document the reason and verify static prerequisites instead.
- Search for stale references after renaming or deleting documentation files.
- For skills, verify the skill directory exists, frontmatter parses, directory/name match, references resolve, and pressure scenarios exist before implementation.

## Expected implementation shape

Managed source files:

```text
agent/skills/writing-project-readmes/SKILL.md
agent/skills/writing-agent-instructions/SKILL.md
agent/skills/writing-omp-skills/SKILL.md
```

Bootstrap deploys each directory as a symlink under:

```text
~/.omp/agent/skills/<skill-name>
```

Bootstrap deploys all three skill directories. `doctor` checks the deployed symlinks as managed agent files. `verify` includes all three skills in loader-based `REQUIRED_SKILLS` discovery, as with `commit`.

This repo's managed-surface docs must be updated when the skill inventory changes. Update `README.md`, root `AGENTS.md`, and `agent/AGENTS.md` so maintainers can see every source-managed path deployed under `~/.omp/agent/`. Do not make unrelated user repos list installed skills.

## Testing plan for the skills

Follow the existing Superpowers `writing-skills` discipline: no skill without failing scenarios first.

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

7. **Skill without baseline**
   - Ask agent to create a skill from a vague idea.
   - Failure to catch: drafts `SKILL.md` immediately from intuition.
   - Pass: defines and runs baseline pressure scenarios before authoring.

8. **Overbroad skill discovery**
   - Draft skill has a vague or workflow-summary description.
   - Failure to catch: keeps a description like `Helps write documentation` or summarizes the whole process.
   - Pass: rewrites description as capability-plus-trigger, specific, third-person, and validates should-trigger and should-not-trigger prompts without summarizing the workflow.

9. **OMP path mismatch**
   - Ask agent to adapt a Claude Code skill.
   - Failure to catch: writes under `.claude/skills` or uses Claude-only invocation/tooling.
   - Pass: targets `agent/skills/<name>/SKILL.md`, OMP tool names, and managed deployment semantics.

10. **Local skill versus Superpowers skill**
    - Ask for an OMP-managed skill under `agent/skills/<name>/SKILL.md`.
    - Failure to catch: follows only the generic Superpowers `writing-skills` path and recommends `.claude/skills`, `~/.claude/skills`, or provider-specific deployment.
    - Pass: applies Superpowers TDD discipline while using `writing-omp-skills` guidance for OMP paths, deployment, verification, and managed-surface docs.

11. **Oversized skill body**
    - Provide many source notes, examples, and edge cases.
    - Failure to catch: dumps all material into `SKILL.md`.
    - Pass: keeps `SKILL.md` concise and routes optional material to direct one-level references only when justified.

12. **Unsafe third-party adoption**
    - Ask agent to install a community skill.
    - Failure to catch: copies or symlinks it wholesale after reading the README.
    - Pass: audits bundled files, permissions, scripts, external URLs, symlinks, hooks, lifecycle behavior, and description/body alignment before recommending borrow, adapt, or reject.

13. **Unnecessary helper script**
    - Ask for a skill with helper scripts where instructions would suffice.
    - Failure to catch: creates script scaffolding to appear robust.
    - Pass: keeps the skill instructions-only unless deterministic validation or generation materially improves reliability.

### Quality gates

- Unit tests for bootstrap symlink planning, doctor managed-file checks, and verify `REQUIRED_SKILLS` discovery.
- `bun run ci` passes.
- `bun run bootstrap` deploys all three skills.
- `bun run doctor` reports all three skills healthy.
- `OMP_VERIFY_SKIP_ACCEPTANCE=1 bun run verify` discovers all three skills.

## Open decisions

None for the initial implementation. The split into three skills is intentional; if usage shows agents need a shared documentation-architecture skill later, create it from observed failures rather than preemptively.
