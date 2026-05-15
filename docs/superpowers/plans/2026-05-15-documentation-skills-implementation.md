# Documentation Skills Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three local OMP-managed skills for README, agent-instruction, and OMP skill-authoring work, with deployment, discovery, docs, and tests.

**Architecture:** Skills live as source-managed directories under `agent/skills/<name>/SKILL.md`. `runBootstrap` symlinks those directories into `~/.omp/agent/skills/<name>`, `managedAgentChecks` reports them in doctor, and `REQUIRED_SKILLS` makes verify exercise loader discovery. Tests cover the managed inventory rather than brittle formatting.

**Tech Stack:** Bun, TypeScript, `bun:test`, OMP skill filesystem layout.

---

## RED evidence captured

Baseline pressure runs without the new local skills produced these failures:

- README agents duplicated AGENTS-only deployment/tooling boundaries into human README because the user asked for one file.
- README agents documented conventional `npm test`/`npm run build` despite only `check:test`, `check:types`, and `verify` being present.
- AGENTS agents produced generic best-practice boilerplate, duplicated README content, made divergent `CLAUDE.md` copies, and added nested files for identical package workflows.
- OMP skill agents drifted to generic `~/.claude/skills` / `~/.agents/skills`, under-reviewed third-party skill collections, considered drafting before pressure scenarios, and tolerated workflow-summary descriptions.

## File structure

- Create `agent/skills/writing-project-readmes/SKILL.md`: concise runtime guidance for human-facing README work.
- Create `agent/skills/writing-agent-instructions/SKILL.md`: concise runtime guidance for AGENTS/CLAUDE instruction files.
- Create `agent/skills/writing-omp-skills/SKILL.md`: OMP-local adapter around Superpowers skill-writing discipline.
- Modify `src/bootstrap.ts`: include all three skill directories in snapshot and managed link plans.
- Modify `src/cli.ts`: include all three in `REQUIRED_SKILLS` and `managedAgentChecks`.
- Modify `tests/cli.test.ts`: assert doctor and verify inventories include all local skills and distinguish `writing-omp-skills` from `writing-skills`.
- Modify `tests/integration/bootstrap.test.ts`: sandbox-create the skill dirs and assert symlinks.
- Modify `README.md`, `AGENTS.md`, `agent/AGENTS.md`: update managed-surface documentation only.

## Task 1: Local skill documents

**Files:**
- Create: `agent/skills/writing-project-readmes/SKILL.md`
- Create: `agent/skills/writing-agent-instructions/SKILL.md`
- Create: `agent/skills/writing-omp-skills/SKILL.md`

- [ ] **Step 1: Write minimal skill documents from RED evidence**

Each file must have standards-compliant frontmatter:

```yaml
---
name: writing-project-readmes
description: Use when creating, reviewing, or updating human-facing README.md files for software projects, especially when setup, usage, architecture, or maintainer onboarding may be stale, missing, or duplicated.
---
```

```yaml
---
name: writing-agent-instructions
description: Use when creating, reviewing, or updating AGENTS.md, CLAUDE.md, or similar coding-agent instruction files for repository commands, conventions, boundaries, and tool workflows.
---
```

```yaml
---
name: writing-omp-skills
description: Use when creating, reviewing, adapting, testing, or validating local OMP-managed skills under agent/skills/<name>/SKILL.md, including third-party skill material considered for adoption.
---
```

The bodies must directly counter the RED failures above and require scoped verification.

- [ ] **Step 2: Inspect the files**

Run: read each new `SKILL.md` and check the `name` matches the parent directory, descriptions are capability-plus-trigger without workflow summaries, and no helper scripts or extra files were added.

## Task 2: Managed deployment and discovery wiring

**Files:**
- Modify: `src/bootstrap.ts`
- Modify: `src/cli.ts`
- Modify: `tests/cli.test.ts`
- Modify: `tests/integration/bootstrap.test.ts`

- [ ] **Step 1: Write failing inventory tests**

Add tests that expect `writing-project-readmes`, `writing-agent-instructions`, and `writing-omp-skills` in `managedAgentChecks`, `REQUIRED_SKILLS`, and integration bootstrap symlinks.

Run: `bun test tests/cli.test.ts tests/integration/bootstrap.test.ts`
Expected before implementation: FAIL because the three skills are absent from inventories or sandbox setup.

- [ ] **Step 2: Implement minimal inventory changes**

Add a single local skill-name constant or equivalent low-duplication structure, then use it for required skills and managed checks. Add the three skill directories to bootstrap snapshot/link planning.

- [ ] **Step 3: Run focused tests**

Run: `bun test tests/cli.test.ts tests/integration/bootstrap.test.ts`
Expected after implementation: PASS.

## Task 3: Managed-surface docs

**Files:**
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `agent/AGENTS.md`

- [ ] **Step 1: Update only managed inventory references**

Document the new source paths and deployed symlink target shape. Do not duplicate skill contents.

- [ ] **Step 2: Verify docs references**

Use `search`/`read` to confirm all three new skill names appear in the managed-surface docs and no `agent/skills/writing-skills` path was introduced.

## Task 4: Verification and review

**Files:** all changed files.

- [ ] **Step 1: Run targeted tests**

Run: `bun test tests/cli.test.ts tests/integration/bootstrap.test.ts`
Expected: PASS.

- [ ] **Step 2: Run full gates**

Run in order:

```bash
bun run ci
bun run bootstrap
bun run doctor
OMP_VERIFY_SKIP_ACCEPTANCE=1 bun run verify
```

Expected: all exit 0; verify reports all three local skills as `ok` in loader discovery.

- [ ] **Step 3: Request independent review**

Use a reviewer subagent to check spec compliance and code quality before committing.

- [ ] **Step 4: Commit**

Use `skill://commit`. Commit message: `feat: add documentation skills`.
