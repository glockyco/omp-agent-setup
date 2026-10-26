## 1. Establish the Disposition Ledger

- [x] 1.1 Create `disposition.md` with one row for each of the 17 records under `docs/plans/archive/`, including old path, inbound references, unique retained content, evidence, disposition, destination and verification.
- [x] 1.2 Prove that the ledger path set equals the tracked archive path set.
- [x] 1.3 Record every current reference to the archive or retired convention outside OpenSpec history.
- [x] 1.4 Record the accepted capability specs and current documents that can own retained content.

## 2. Verify Every Historical Record

- [x] 2.1 Verify and disposition `2026-05-15-documentation-skills-design.md` before source deletion.
- [x] 2.2 Verify and disposition `2026-05-15-documentation-skills-implementation.md` before source deletion.
- [x] 2.3 Verify and disposition `2026-05-16-acp-supported-features-implementation-spec.md` before source deletion.
- [x] 2.4 Verify and disposition `2026-05-16-doc-audit.md` before source deletion.
- [x] 2.5 Verify and disposition `2026-05-16-zed-integration-and-lsp-hygiene.md` before source deletion.
- [x] 2.6 Verify and disposition `2026-05-26-hindsight-codex-local-integration-design.md` before source deletion.
- [x] 2.7 Verify and disposition `2026-05-26-hindsight-codex-local-integration.md` before source deletion.
- [x] 2.8 Verify and disposition `2026-06-23-omp-plans-tooling.md` against current source and accepted specs.
- [x] 2.9 Verify and disposition `2026-06-23-planning-file-conventions-design.md`, separating current observations from the retired convention.
- [x] 2.10 Verify and disposition `2026-06-25-cross-repo-planning-docs-migration.md` without preserving its rollout as current work.
- [x] 2.11 Verify and disposition `2026-06-25-planning-convention-fanout.md` without claiming sibling cleanup.
- [x] 2.12 Verify and disposition `2026-07-09-remove-superpowers-from-managed-omp-setup.md` against the current immutable plugin.
- [x] 2.13 Verify and disposition `2026-07-31-command-surface-redesign-plan.md` against current commands and accepted specs.
- [x] 2.14 Verify and disposition `2026-07-31-command-surface-redesign-spec.md` against current commands and accepted specs.
- [x] 2.15 Verify and disposition `2026-07-31-setup-maintenance-overview.md` without preserving retired roadmap state.
- [x] 2.16 Verify and disposition `2026-08-01-impeccable-subagent-deployment-plan.md` against current plugin ownership and tests.
- [x] 2.17 Verify and disposition `2026-08-01-impeccable-subagent-deployment-spec.md` against current plugin ownership and tests.

## 3. Migrate Retained Content

- [x] 3.1 Compare retained requirements with accepted capability specs, including `personal-omp-plugin`, `structured-commit`, `research-evidence` and `plugin-update-automation`. Treat the retired STE capability through its accepted removal contract.
- [x] 3.2 Move each missing current requirement into exactly one accepted capability spec with its complete observable contract, or record that no migration is needed.
- [x] 3.3 Move each unique verified technical fact into its current subject document, or record that no migration is needed. Do not create a generic legacy summary.
- [x] 3.4 Correct or discard any historical claim contradicted by current source, tests or accepted behavior.
- [x] 3.5 Resolve every ledger row and verify every retained destination exists before deletion.

## 4. Cut Over Current Guidance

- [x] 4.1 Confirm that `plugin/`, current guidance and current documentation contain no operational retired-convention instruction.
- [x] 4.2 Remove the historical archive entry and finished retirement procedure from `AGENTS.md`.
- [x] 4.3 Delete all 17 records and the `docs/plans/INDEX.md` index after disposition. Add no documentation text-scanning test.
- [x] 4.4 Review the cut-over tree and current references against the accepted planning contract.

## 5. Verify the Complete Change

- [x] 5.1 Prove that the 17-row ledger covers every removed archive path, separately account for the deleted index and verify retained destinations.
- [x] 5.2 Run `bun run check:local` and obtain the complete three-host CI and shared OpenSpec checks on the implementation PR.
- [x] 5.3 Run `openspec validate --all --strict` with the repository-pinned CLI.
- [x] 5.4 Review the final diff by subject and remove incidental changes.
- [x] 5.5 Report this repository separately from companion cleanup changes.

## Workflow follow-up

- After the implementation PR is green and merged, archive the change with the pinned CLI, validate the synchronized specs and push the archive as a separate follow-up commit.
