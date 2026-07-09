---
name: writing-plans
description: Use when turning approved requirements, a spec, or a multi-subsystem change into an executable implementation plan under docs/plans/.
---

# Writing Plans

## Core principle

A plan is an executable task sequence for a fresh competent agent. It names the files, order of work, verification evidence, and commit boundaries needed to ship the change without guessing.

## Relationship to planning-files

Use `skill://planning-files` for plan location, frontmatter, document type, status lifecycle, `INDEX.md`, `omp-plans index`, `omp-plans check`, `omp-plans complete`, and archive rules.

This skill only covers the task-sequence body of a `type: plan`. Do not add design, rationale, acceptance criteria, or evidence tables to a plan; those belong in a companion `spec` or `audit` and should be referenced by slug.

## Before writing

Inspect only enough to ground the plan:

- approved requirements, issue, or spec;
- current code paths and callsites;
- tests covering the affected behavior;
- package scripts and CI commands;
- docs, config, deployed surfaces, or generated artifacts the change affects;
- repo boundaries such as migrations, vendored code, patches, generated files, and secrets.

Reuse existing conventions. A second convention beside an existing one is a planning failure.

## File structure first

Before tasks, map the affected files and their responsibilities:

```markdown
## File map

- Modify `src/foo.ts`: owns parsing and validation.
- Modify `tests/foo.test.ts`: covers parser behavior and validation errors.
- Remove `src/legacy-foo.ts`: obsolete entry point; all callers migrate to `src/foo.ts`.
```

Use the map to lock decomposition decisions:

- Give each file one clear responsibility where practical.
- Keep files that change together near each other.
- Follow existing project structure.
- If a file is already large, plan only the split needed to make the requested change safer.

## Task shape

Each task should be independently reviewable and committable.

```markdown
### Task N: Short task name

**Files:**
- Create: `exact/path/new-file.ts`
- Modify: `exact/path/existing-file.ts`
- Test: `tests/exact/path.test.ts`

- [ ] Implement `<specific behavior or contract>`.
  Verification: `bun test tests/exact/path.test.ts -t '<test name>'`
  Expected: passes and proves `<observable result>`.

- [ ] Commit.
  Message: `type(scope): imperative summary`
```

Prefer logical atomic tasks over artificial tiny steps. For changes with testable behavior, a red/green step sequence is often the clearest plan:

```markdown
- [ ] Add the focused test for `<specific behavior>`.
  Run: `bun test tests/exact/path.test.ts -t '<test name>'`
  Expected before implementation: fails because `<missing behavior>`.

- [ ] Implement the minimal behavior.

- [ ] Re-run the focused test.
  Expected after implementation: passes.
```

## Required detail

Every task needs:

- exact paths;
- specific behavior or contract;
- test or verification command;
- expected result;
- commit boundary.

For behavior changes, prefer explicit evidence:

- test or smoke check to add or run;
- expected result before the change when a failing test is practical;
- expected result after implementation.

For docs/config-only changes, include static verification:

- referenced files exist;
- documented commands exist;
- stale names are searched;
- generated indexes are refreshed.

## Code in plans

Include code when it prevents ambiguity:

- test skeletons;
- public API shapes;
- config schemas;
- migration examples;
- command examples;
- tricky edge cases.

Do not paste large implementation bodies that should be derived from current source. Large code blocks go stale and encourage cargo-cult edits.

## No placeholders

Never write:

- `TBD`
- `TODO`
- `implement later`
- `add appropriate error handling`
- `add validation`
- `handle edge cases`
- `write tests`
- `update docs`
- `similar to Task N`
- references to undefined functions, files, types, routes, commands, or settings.

Replace vague work with observable behavior:

Bad:

```markdown
- [ ] Add validation and error handling.
```

Good:

```markdown
- [ ] Reject empty `name` before writing config.
  Test: `rejects empty config name`
  Expected error: `Config name is required`
```

## OMP-native compatibility

Do not add process gates beyond the user request and OMP defaults.

- Use plans for changes that actually need a durable plan.
- Do not require worktrees, subagents, review tools, or execution modes in the plan body.
- Do not pre-plan speculative cleanup. Plan only what makes the request work; final cleanup follows once behavior is verified.
- Mention delegation only when a task boundary is independently executable and OMP task agents are the right tool.

## Self-review

Before saving the plan:

1. **Source coverage:** every approved requirement or referenced spec acceptance item maps to a task.
2. **File coverage:** every touched file appears in the file map.
3. **Placeholder scan:** no vague or deferred work remains.
4. **Name consistency:** functions, types, commands, routes, and files use the same names across all tasks.
5. **Verification coverage:** every task names evidence that can prove it worked.
6. **Atomicity:** task boundaries line up with commits.
7. **Scope control:** cleanup, docs, and tests are included only where they serve the requested change or final verification.

After saving, run:

```bash
omp-plans index
omp-plans check
```
