## 1. Establish the Disposition Ledger

- [ ] 1.1 Create `disposition.md` with one row for each of the 17 records under `docs/plans/archive/`, including old path, inbound references, unique retained content, evidence, disposition, destination and verification.
- [ ] 1.2 Prove that the ledger path set equals the tracked archive path set.
- [ ] 1.3 Record every current reference to the archive or retired convention outside OpenSpec history.
- [ ] 1.4 Record the accepted capability specs and current documents that can own retained content.

## 2. Verify Every Historical Record

- [ ] 2.1 Verify and disposition `2026-05-15-documentation-skills-design.md` without editing or deleting the source.
- [ ] 2.2 Verify and disposition `2026-05-15-documentation-skills-implementation.md` without editing or deleting the source.
- [ ] 2.3 Verify and disposition `2026-05-16-acp-supported-features-implementation-spec.md` without editing or deleting the source.
- [ ] 2.4 Verify and disposition `2026-05-16-doc-audit.md` without editing or deleting the source.
- [ ] 2.5 Verify and disposition `2026-05-16-zed-integration-and-lsp-hygiene.md` without editing or deleting the source.
- [ ] 2.6 Verify and disposition `2026-05-26-hindsight-codex-local-integration-design.md` without editing or deleting the source.
- [ ] 2.7 Verify and disposition `2026-05-26-hindsight-codex-local-integration.md` without editing or deleting the source.
- [ ] 2.8 Verify and disposition `2026-06-23-omp-plans-tooling.md`; treat its mandatory workflow as retired unless current source and accepted specs prove otherwise.
- [ ] 2.9 Verify and disposition `2026-06-23-planning-file-conventions-design.md`; separate durable observations from the retired global convention.
- [ ] 2.10 Verify and disposition `2026-06-25-cross-repo-planning-docs-migration.md`; do not preserve its fleet rollout as current work.
- [ ] 2.11 Verify and disposition `2026-06-25-planning-convention-fanout.md`; record sibling cleanup only through repository-local companion changes.
- [ ] 2.12 Verify and disposition `2026-07-09-remove-superpowers-from-managed-omp-setup.md` against the current immutable plugin.
- [ ] 2.13 Verify and disposition `2026-07-31-command-surface-redesign-plan.md` against current commands and accepted specs.
- [ ] 2.14 Verify and disposition `2026-07-31-command-surface-redesign-spec.md` against current commands and accepted specs.
- [ ] 2.15 Verify and disposition `2026-07-31-setup-maintenance-overview.md`; do not preserve completed roadmap state as current guidance.
- [ ] 2.16 Verify and disposition `2026-08-01-impeccable-subagent-deployment-plan.md` against current plugin ownership and tests.
- [ ] 2.17 Verify and disposition `2026-08-01-impeccable-subagent-deployment-spec.md` against current plugin ownership and tests.

## 3. Migrate Retained Content

- [ ] 3.1 Compare retained requirements with accepted capability specs, including `personal-omp-plugin`, `structured-commit`, `research-evidence` and `plugin-update-automation`. Treat the retired STE capability through its accepted removal contract.
- [ ] 3.2 Move each missing current requirement into exactly one accepted capability spec with its complete observable contract, or record that no migration is needed.
- [ ] 3.3 Move each unique verified technical fact into its current subject document, or record that no migration is needed. Do not create a generic legacy summary.
- [ ] 3.4 Correct or discard any historical claim contradicted by current source, tests or accepted behavior.
- [ ] 3.5 Resolve every ledger row and verify every retained destination exists before deletion.

## 4. Cut Over Current Guidance

- [ ] 4.1 Confirm that `plugin/`, current guidance and current documentation contain no operational retired-convention instruction.
- [ ] 4.2 Remove the historical archive entry and finished retirement procedure from `AGENTS.md`.
- [ ] 4.3 Delete all 17 records and the `docs/plans/INDEX.md` index after disposition. Add no documentation text-scanning test.
- [ ] 4.4 Review the cut-over tree and current references against the accepted planning contract.

## 5. Verify the Complete Change

- [ ] 5.1 Prove that the 17-row ledger covers every removed archive path, separately account for the deleted index and verify retained destinations.
- [ ] 5.2 Run `bun run check:local` and obtain the complete three-host CI and shared OpenSpec checks on the implementation PR.
- [ ] 5.3 Run `openspec validate --all --strict` with the repository-pinned CLI.
- [ ] 5.4 Review the final diff by subject and remove incidental changes.
- [ ] 5.5 Report this repository separately from companion cleanup changes.

## Workflow follow-up

- After the implementation PR is green and merged, archive the change with the pinned CLI, validate the synchronized specs and push the archive as a separate follow-up commit.
