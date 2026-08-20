## Context

See `proposal.md` for motivation and `specs/repository/planning-state/spec.md` for the contract.

`AGENTS.md` already makes OpenSpec authoritative and prohibits restoring `omp-plans`. The packaged plugin contains no `docs/plans/`, `planning-files`, or `omp-plans` instruction. The remaining defect is a tracked archive of 17 records plus an always-read pointer to that archive.

The records cover several generations of the repository. They include mutable bootstrap design, retired global planning tools, completed command redesign, superseded integrations, and the migration into the current immutable plugin. Status labels are not evidence that a requirement remains current.

## Goals / Non-Goals

**Goals:**

- Account for all 17 records before deleting the archive.
- Preserve each unique current requirement or technical fact in one accepted owner.
- Remove the retired planning namespace and its always-read pointer.
- Make restoration fail in the existing `bun run ci` gate.

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

Compare retained content with `personal-omp-plugin`, `structured-commit`, `research-evidence`, `simplified-technical-english`, and `plugin-update-automation`. Add only missing current requirements. Do not copy implementation narratives or old architecture into a generic migration summary.

A fact contradicted by current source, tests, or accepted specs is corrected or discarded. The observation wins over the historical description.

**Alternative:** Add one legacy-decisions document. Rejected because it mixes unrelated ownership and recreates the archive in condensed form.

### 4. Guard current surfaces through the existing test gate

Add a repository-level test to the existing Bun test suite. It will reject a tracked `docs/plans/` path and current instructions for `planning-files` or operational `omp-plans` use. It will also reject guidance that declares another planning home.

The test will allow the retired names in OpenSpec history and in explicit removal requirements. It will include a synthetic positive control that proves a known conflict is reported.

**Alternative:** Keep only the prohibition in `AGENTS.md`. Rejected because prose did not prevent the archive and its pointer from surviving the earlier cutover.

### 5. Cut over guidance and files together

Keep all 17 records until the ledger is complete and every retained destination exists. Remove the source-layout pointer from `AGENTS.md`, delete the archive, and enable the repository scan in one cutover commit.

Do not edit plugin runtime files unless the audit finds an active dependency. The current scan found none.

## Risks / Trade-offs

- **A historical record contains the only copy of a current requirement.** → Compare every record with accepted specs and current behavior before removal.
- **A text scan rejects a removal requirement that names `omp-plans`.** → Exclude OpenSpec history and explicit prohibition contexts, then test both allowed and rejected fixtures.
- **Deleting 17 files hides a small substantive migration.** → Land retained requirements by capability before the mechanical cutover.
- **The cleanup is mistaken for fleet-wide completion.** → Report this repository separately from `nix-darwin` and project cleanup changes.

## Migration Plan

1. Create the 17-row disposition ledger and record all inbound references.
2. Verify each retained claim against accepted specs, current source, tests, and history.
3. Move missing current requirements or facts to their subject owners.
4. Confirm that the active plugin and current guidance contain no operational retired-convention instruction.
5. Add the repository guard and its positive controls.
6. Remove the `AGENTS.md` archive pointer and the complete `docs/plans/` tree in one cutover.
7. Run the focused guard test, `nix develop --command bun run ci`, `nix flake check`, and `openspec validate --all --strict`.

Rollback is a normal commit revert because the change affects tracked documentation and validation only. Keep verified requirement migrations if the final deletion must be reverted.
