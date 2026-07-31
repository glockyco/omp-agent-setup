---
title: Command Surface Redesign Plan
type: plan
status: active
created: 2026-07-31
parent: 2026-07-31-command-surface-redesign-spec
superseded_by:
archived:
---

This plan implements the contracts in [Command Surface Redesign Spec](./2026-07-31-command-surface-redesign-spec.md).

## File map

- Modify `package.json`: replace the undocumented `plans` wrapper with `update-omp`.
- Create `src/omp-update.ts`: own argument parsing, workflow ordering, events, and fail-fast results.
- Create `src/omp-update-runtime.ts`: own `omp --version` capture and inherited-stdio `omp update` execution.
- Modify `src/cli.ts`: expose `update-omp` and add Impeccable content findings to doctor.
- Modify `src/impeccable-update.ts`: share Pi variant inspection between update and doctor.
- Modify `extensions/impeccable-hook.ts`: send immediate and terminal audits to the vendored writer.
- Modify `src/lsp-audit.ts`: render healthy server names with resolved executable paths.
- Modify `README.md` and `AGENTS.md`: distinguish maintenance from developer commands and make `update-omp` the normal update path.
- Create `tests/omp-update.test.ts`: cover parsing, ordered success, and every fail-fast stage.
- Modify `tests/cli.test.ts`: cover update command help and invalid arguments.
- Modify `tests/impeccable-update.test.ts` and `tests/doctor-links.test.ts`: cover shared invariant findings and doctor presentation inputs.
- Modify `tests/impeccable-hook.test.ts`: cover actual NDJSON writes for immediate and terminal events.
- Modify `tests/lsp-audit.test.ts`: cover resolved global and project-local paths.
- Create ignored `.impeccable/config.local.json` files in the Erenshor and ancient-kingdoms-mods repository roots for the bounded local pilot.

## Tasks

### Task 1: Add safe OMP update workflow

- [x] Replace the `plans` package script with `update-omp`, implement exact argument parsing and the ordered `version-before → update → bootstrap → doctor → verify → version-after` workflow, and bind it to the CLI without duplicating stage logic.
  Verification: `bun test tests/omp-update.test.ts tests/cli.test.ts`.
  Expected: success ordering and every first-failure cutoff pass.
- [x] Verify the command boundary directly.
  Verification: `bun run update-omp --help` and `bun run update-omp --force`.
  Expected: help prints only usage and exits 0; unsupported input prints usage, exits 2, and never invokes OMP.
- [x] Update README and agent guidance, regenerate and validate the planning index, then commit.
  Verification: `omp-plans index && omp-plans check`.
  Expected: current docs identify `update-omp` as normal operation and direct `omp update` plus bootstrap as recovery.
  Commit: `feat(cli): add safe omp update workflow`.

### Task 2: Share Impeccable doctor invariants

- [x] Add the stable read-only inspector, make the updater aggregate its findings, and render every finding in doctor with the exact healthy and remediation lines.
  Verification: `bun test tests/impeccable-update.test.ts tests/doctor-links.test.ts`.
  Expected: healthy, provider, Markdown, filesystem, unapplied-fix, and ambiguous-anchor fixtures pass.
- [x] Verify the live deployed tree and commit.
  Verification: `bun run doctor`.
  Expected: doctor prints `ok   impeccable content (Pi provider, clean Markdown, <N> vendor fixes)` without mutation.
  Commit: `feat(doctor): verify Impeccable content invariants`.

### Task 3: Record Impeccable hook audits

- [ ] Call the vendored audit writer for successful immediate and settled terminal detector results using one environment snapshot per event.
  Verification: `bun test tests/impeccable-hook.test.ts`.
  Expected: actual vendored code writes one `PostToolUse` and one `Stop` NDJSON record while existing reminder assertions remain green.
- [ ] Create ignored project-local pilot configs, exercise one named UI file in each repository, and verify project-specific records plus unchanged tracked status.
  Verification: inspect each NDJSON log and run `git status --short` plus `git check-ignore` in both pilot repositories.
  Expected: both logs contain their project event, and local config/cache state is ignored.
- [ ] Commit only repository extension and test changes.
  Commit: `feat(extensions): record Impeccable hook audits`.

### Task 4: Show resolved LSP server paths

- [ ] Render healthy servers as comma-separated `name -> resolved` values without changing resolution or remediation logic.
  Verification: `bun test tests/lsp-audit.test.ts`.
  Expected: fixtures include `/fixture/bin/...` and a project-local `node_modules/.bin/...` path.
- [ ] Verify the live report and commit.
  Verification: `bun run audit-lsp`.
  Expected: active healthy entries show absolute paths and missing-binary remediation remains present.
  Commit: `feat(lsp): show resolved server paths`.

### Task 5: Complete live verification

- [ ] Run the repository quality gate.
  Verification: `bun run ci`.
  Expected: lint, types, dead-code, audit, and coverage tests pass.
- [ ] Run the real safe updater.
  Verification: `bun run update-omp`.
  Expected: before version, all four stage headings, healthy doctor, successful verify, and after version appear in exact order.
- [ ] Re-run the live LSP audit and search living source and docs for stale package-wrapper and normal-path raw-update guidance.
  Verification: `bun run audit-lsp` plus scoped searches excluding `docs/plans/archive/`.
  Expected: resolved paths remain visible, `bun run plans` is absent, and raw `omp update` appears only in recovery or expert context.

### Task 6: Complete planning artifacts

- [ ] Mark the implemented spec and plan complete, archive them, refresh the overview current focus, and regenerate the index.
  Verification: `omp-plans complete 2026-07-31-command-surface-redesign-plan`, `omp-plans complete 2026-07-31-command-surface-redesign-spec`, `omp-plans index`, and `omp-plans check`.
  Expected: the overview remains active, implemented docs are archived, and planning links validate.
- [ ] Verify the repository worktree is clean and commit planning completion.
  Commit: `docs: complete setup maintenance plan`.
