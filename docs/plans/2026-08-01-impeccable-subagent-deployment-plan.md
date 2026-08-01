---
title: Impeccable Subagent Deployment Plan
type: plan
status: active
created: 2026-08-01
parent: 2026-08-01-impeccable-subagent-deployment-spec
superseded_by:
archived:
---

This plan implements the contracts in [Impeccable Subagent Deployment Spec](./2026-08-01-impeccable-subagent-deployment-spec.md).

Both documents are `draft`. Set each to `status: active` in the first commit of Task 1.

## File map

- Create `src/managed-agents.ts`: exports `LOCAL_MANAGED_AGENTS`, the fourth deployment registry.
- Create `src/impeccable-agents.ts`: pure translation from Claude agent front-matter to OMP's agent schema.
- Create `tests/impeccable-agents.test.ts`: covers the translation, its error cases, and idempotence.
- Modify `src/impeccable-update.ts`: vendor `.claude/agents/*.md` through the translation during `updateImpeccableFromBundle`, and report the written agents in `UpdateImpeccableResult`.
- Modify `tests/impeccable-update.test.ts`: extend the bundle fixture with `.claude/agents` and assert the vendored output.
- Modify `src/bootstrap.ts`: snapshot and link `agent/agents/<name>.md` into `~/.omp/agent/agents/`.
- Modify `tests/bootstrap.test.ts`: assert the four agent symlinks are planned.
- Modify `src/cli.ts`: add the agents to `managedAgentChecks` and print the vendored agent count in the `update-impeccable` report.
- Create `agent/agents/`: generated payload, four files, committed.
- Modify `AGENTS.md`: add the registry row and the `update-impeccable` behaviour.
- Modify `README.md`: same, where it lists what bootstrap deploys.

## Tasks

### Task 1: Add the registry and the payload directory

**Files:**
- Create: `src/managed-agents.ts`
- Modify: `AGENTS.md`

- [ ] Export `LOCAL_MANAGED_AGENTS` as a `const` tuple naming the four agents in the order they appear in the spec's translation table: `impeccable-finish-reviewer`, `impeccable-documenter`, `impeccable-asset-producer`, `impeccable-manual-edit-applier`.
  Verification: `bun run check:types`
  Expected: passes, and `LOCAL_MANAGED_AGENTS` is typed as a readonly tuple of literals the way `LOCAL_MANAGED_SKILLS` is.

- [ ] Add the `src/managed-agents.ts` row to the registry table in `AGENTS.md`, matching the three existing rows: payload `agent/agents/<name>.md`, deployed at `~/.omp/agent/agents/<name>.md` as a symlink.
  Verification: `grep -c 'managed-agents' AGENTS.md`
  Expected: `1`.

- [ ] Commit.
  Message: `feat(agents): add the managed agent registry`

### Task 2: Write the front-matter translation

**Files:**
- Create: `src/impeccable-agents.ts`
- Create: `tests/impeccable-agents.test.ts`

- [ ] Add the failing test first. Cover the finish reviewer's real front-matter as the happy path:

  ```ts
  const CLAUDE_SOURCE = [
    "---",
    "name: impeccable-finish-reviewer",
    "description: Reviews a finished Impeccable build.",
    "tools: Read, Bash, Glob, Grep",
    "model: inherit",
    "effort: high",
    "maxTurns: 30",
    "---",
    "# Impeccable Finish Reviewer",
    "",
    "Body text.",
  ].join("\n");
  ```

  Assert `translateClaudeAgent(CLAUDE_SOURCE, "impeccable-finish-reviewer.md")` returns front-matter carrying `name`, a quoted `description`, `tools` as the list `read, bash, glob, grep, yield`, `thinkingLevel: high`, no `model` key, no `maxTurns` key, no `output` key, and the body verbatim after the closing delimiter.
  Run: `bun test tests/impeccable-agents.test.ts`
  Expected before implementation: fails because `src/impeccable-agents.ts` does not exist.

- [ ] Implement `translateClaudeAgent(source: string, fileName: string): string` in `src/impeccable-agents.ts`, pure and IO-free, applying the spec's translation table. Export the tool map and the accepted `thinkingLevel` values as named constants so the tests and the error messages share one source.
  Run: `bun test tests/impeccable-agents.test.ts`
  Expected after implementation: passes.

- [ ] Add the error cases: an unrecognised tool name, an `effort` value outside OMP's vocabulary, and a file with no front-matter delimiter each throw an `Error` whose message names the file and the offending value.
  Run: `bun test tests/impeccable-agents.test.ts -t 'rejects'`
  Expected: three passing cases, each asserting on the message text rather than only that it threw.

- [ ] Add the idempotence case: translating already-translated output is a no-op, which is what keeps a re-vendor from producing a diff.
  Run: `bun test tests/impeccable-agents.test.ts -t 'idempotent'`
  Expected: passes.

- [ ] Commit.
  Message: `feat(agents): translate Claude agent front-matter to the OMP schema`

### Task 3: Vendor the agents during the Impeccable update

**Files:**
- Modify: `src/impeccable-update.ts`
- Modify: `tests/impeccable-update.test.ts`

- [ ] Extend the bundle fixture in `tests/impeccable-update.test.ts` with a `.claude/agents/` directory holding one agent file, then assert `updateImpeccableFromBundle` writes the translated file to `agent/agents/` and returns it on the result.
  Run: `bun test tests/impeccable-update.test.ts`
  Expected before implementation: fails because nothing writes `agent/agents/`.

- [ ] Add `CLAUDE_AGENTS_RELATIVE = [".claude", "agents"]` and a `vendorAgents` step to `updateImpeccableFromBundle`, called after `assertPiImpeccableVariant`. It clears `agent/agents/`, reads every `impeccable-*.md` from the bundle's `.claude/agents/`, runs each through `translateClaudeAgent`, and writes it to `agent/agents/<name>.md`. Add `agents: string[]` to `UpdateImpeccableResult`.
  Run: `bun test tests/impeccable-update.test.ts`
  Expected after implementation: passes.

- [ ] Fail the update when the bundle has no `.claude/agents` directory, or when the set of translated names does not equal `LOCAL_MANAGED_AGENTS`. Either means upstream moved the agents and the registry is now wrong.
  Run: `bun test tests/impeccable-update.test.ts -t 'agents'`
  Expected: a case asserting the mismatch message names both the expected and the found agent sets.

- [ ] Commit.
  Message: `feat(agents): vendor Impeccable subagents on update`

### Task 4: Deploy and diagnose

**Files:**
- Modify: `src/bootstrap.ts`
- Modify: `src/cli.ts`
- Modify: `tests/bootstrap.test.ts`

- [ ] Add `LOCAL_MANAGED_AGENTS` to the three places in `src/bootstrap.ts` that already carry skills and rules: the import, `sourcesToSnapshot`, and the `planManagedLinks` array, mapping each name to source `agent/agents/<name>.md` and destination `<agentDir>/agents/<name>.md`.
  Run: `bun test tests/bootstrap.test.ts`
  Expected: the existing suite still passes.

- [ ] Assert in `tests/bootstrap.test.ts` that the link plan contains all four agent destinations under `<agentDir>/agents/`.
  Run: `bun test tests/bootstrap.test.ts -t 'agents'`
  Expected: passes, and fails if a name is added to the registry without a payload file.

- [ ] Add the four agents to `managedAgentChecks` in `src/cli.ts`, mapping each to `[join(agentDir, "agents", name + ".md"), name + ".md", "symlink"]`, mirroring the skills mapping directly above it.
  Run: `bun run doctor`
  Expected: four new `MISS` lines before the payload exists, which is the check proving doctor is watching them.

- [ ] Print the vendored agent count in the `update-impeccable` CLI report beside the per-fix status.
  Run: `bun run check:types`
  Expected: passes.

- [ ] Commit.
  Message: `feat(agents): deploy and diagnose the managed agents`

### Task 5: Generate the payload and verify end to end

**Files:**
- Create: `agent/agents/impeccable-finish-reviewer.md`
- Create: `agent/agents/impeccable-documenter.md`
- Create: `agent/agents/impeccable-asset-producer.md`
- Create: `agent/agents/impeccable-manual-edit-applier.md`

- [ ] Run `bun run update-impeccable`.
  Expected: reports four vendored agents, every existing vendor fix still `apply`, and the four files appear under `agent/agents/`.

- [ ] Review the generated front-matter against the spec's translation table, then confirm the run is idempotent by running `bun run update-impeccable` a second time.
  Verification: `git status --short agent/agents`
  Expected: empty after the second run.

- [ ] Run `bun run bootstrap`, then `bun run doctor`.
  Expected: doctor prints `ok impeccable-finish-reviewer.md -> …` for each of the four and ends `Doctor: healthy.`

- [ ] Confirm OMP discovers them. In a new session in any project, check that `impeccable-finish-reviewer` appears in the available agent list, then spawn it with a trivial assignment.
  Expected: it returns prose. An empty or 49-byte envelope means an `output` block survived translation, which Task 2's assertion should have caught.

- [ ] Commit.
  Message: `feat(agents): vendor the four Impeccable subagents`

### Task 6: Record the surface

**Files:**
- Modify: `AGENTS.md`
- Modify: `README.md`
- Modify: `docs/plans/2026-08-01-impeccable-subagent-deployment-spec.md`

- [ ] Extend the `update-impeccable` row in the `AGENTS.md` maintenance table to say it also vendors and translates the four Claude-variant subagents, and add a boundary row: agents under `agent/agents/` are generated by `update-impeccable`, never hand-edited.
  Verification: `grep -c 'agent/agents' AGENTS.md`
  Expected: at least `2`.

- [ ] Mirror the deployment surface in `README.md` wherever it lists what bootstrap deploys.
  Verification: `grep -c 'agents' README.md`
  Expected: at least `1`.

- [ ] Set the spec's `status` to `implemented`.
  Verification: `omp-plans check`
  Expected: exits `0`.

- [ ] Run the full gate.
  Run: `bun run ci`
  Expected: lint, types, dead-code, audit, and tests all pass, with coverage over the 0.8 threshold on `src/impeccable-agents.ts` and `src/managed-agents.ts`.

- [ ] Commit.
  Message: `docs(agents): record the managed agent surface`

## Report upstream

Independent of the tasks above, and worth sending to Impeccable rather than working around: the `.pi`, `.cursor`, and `.opencode` bundle variants ship no agent definitions while `.claude`, `.codex`, and `.agents` ship four, and `reference/new-work.md` §7 points at `reference/degraded/finish-reviewer.md` and `reference/degraded/documenter.md`, which exist in no variant. A Pi-variant install therefore has neither the agents the skill instructs it to spawn nor the fallback it names.
