## Context

See `proposal.md` for motivation and `specs/repository/planning-state/spec.md` for the contract.

`AGENTS.md` already makes OpenSpec authoritative and prohibits restoring `omp-plans`. The packaged plugin contains no `docs/plans/`, `planning-files`, or `omp-plans` instruction. The remaining defect is a tracked archive of 17 records plus an always-read pointer to that archive.

The records cover several generations of the repository. They include mutable bootstrap design, retired global planning tools, completed command redesign, superseded integrations, and the migration into the current immutable plugin. Status labels are not evidence that a requirement remains current.

## Goals / Non-Goals

**Goals:**

- Account for all 17 records before deleting the archive.
- Preserve each unique current requirement or technical fact in one accepted owner.
- Remove the retired planning namespace and its always-read pointer.
- Keep the planning boundary explicit without testing documentation vocabulary.

**Non-Goals:**

- Change packaged plugin behavior or workstation activation.
- Implement abandoned or superseded work described by a record.
- Preserve a browsable historical corpus beside Git history.
- Edit the `nix-darwin` or project repositories.

## Decisions

### 1. Use a complete disposition ledger

Create `disposition.md` under this change. Give every archived record one row with its old path, current inbound references, unique retained content, evidence, disposition, destination, and verification.

Use three dispositions:

1. **Accepted owner.** Move a verified current requirement into the matching accepted capability spec.
2. **Current documentation owner.** Move a verified technical fact into the current document that owns the subject.
3. **Git history only.** Remove completed, superseded, duplicated, abandoned, or retired workflow content.

Do not infer current intent from front matter, unchecked tasks, or imperative language inside a historical record.

**Alternative:** Delete the archive because `AGENTS.md` labels it historical. Rejected because current specs or docs can still depend on a unique decision that has not been migrated.

### 2. Do not create another historical documentation tree

After disposition, remove `docs/plans/` completely. Git retains the exact records, commits, and review history. Current documentation retains only facts needed to operate or maintain the repository.

**Alternative:** Move the files to `docs/history/`. Rejected because it preserves obsolete mandatory instructions as an attractive source and creates another maintenance surface.

### 3. Preserve facts by capability, not by source record

Compare retained content with the accepted capability specs and current runtime payload. The old `simplified-technical-english` capability has been retired, so its removal contract in `personal-omp-plugin` is the relevant boundary. Add only missing current requirements. Do not copy implementation narratives or old architecture into a generic migration summary.

A fact contradicted by current source, tests, or accepted specs is corrected or discarded. The observation wins over the historical description.

**Alternative:** Add one legacy-decisions document. Rejected because it mixes unrelated ownership and recreates the archive in condensed form.

### 4. Review the cutover without a documentation text test

Do not add the planned Bun test that scans documentation for retired tool names, competing planning declarations or old paths. The user approved dropping that test because it checks text rather than behavior. Review the tracked tree and current references during the cutover instead. Strict OpenSpec validation still checks the planning contract's structure.

This is a documentation-only removal. It adds no runtime detector and makes no claim that CI rejects every future prose violation.

### 5. Cut over guidance and files together

Keep all 17 records until the ledger is complete and every retained destination exists. Remove the source-layout pointer from `AGENTS.md` and delete the archive and its index in one cutover commit.

Do not edit plugin runtime files unless the audit finds an active dependency. The current scan found none.

## Risks / Trade-offs

- A historical record contains the only copy of a current requirement. Compare every record with accepted specs and current behavior before removal.
- Without a documentation text test, future guidance can diverge. Keep the planning authority in `AGENTS.md` and review documentation changes against the accepted contract.
- Deleting 17 files hides a small substantive migration. Land retained requirements by capability before the mechanical cutover.
- The cleanup is mistaken for fleet-wide completion. Report this repository separately from companion cleanup changes.

## Migration Plan

1. Create the 17-row disposition ledger and record all inbound references.
2. Verify each retained claim against accepted specs, current source, tests, and history.
3. Move missing current requirements or facts to their subject owners.
4. Confirm that the active plugin and current guidance contain no operational retired-convention instruction.
5. Remove the `AGENTS.md` archive pointer and the complete `docs/plans/` tree in one cutover.
6. Compare the ledger path set with the deleted tracked paths and inspect retained destinations.
7. Run native repository checks and `openspec validate --all --strict`. Retained Nix compatibility remains independent of this documentation cutover.

## Workflow follow-up

- After the implementation PR is green and merged, archive this change with the repository-pinned CLI, validate the resulting main specs and push the archive as a separate follow-up commit.

Rollback is a normal commit revert because the change affects tracked documentation and validation only. Keep verified requirement migrations if the final deletion must be reverted.
