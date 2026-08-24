## 1. Global Policy and Commit Guidance

- [ ] 1.1 Revise `plugin/rules/personal-policy.md` to route covered technical prose to `skill://simplified-technical-english`, require atomic commits at coherent verified checkpoints, permit only task-owned staging, and prohibit implicit pushes.
- [ ] 1.2 Revise the `commit-policy` description and body to cover autonomous checkpoints, staged-diff inspection, revision commits versus amend, explicit push authorization, and concise causal-body examples.
- [ ] 1.3 Confirm that `personal_commit` remains a staging-free and push-free transport and that its existing behavior tests still pass.

## 2. Technical Prose Guidance

- [ ] 2.1 Revise the STE skill description and pragmatic workflow to cover plans, specifications, commit text, comments, docstrings, API prose, CLI text, errors, and agent instructions.
- [ ] 2.2 Revise `references/use-cases.md` to cover plans, specifications, comments, docstrings, API prose, and protected technical tokens.
- [ ] 2.3 Remove instructions that require ordinary produced text to carry an `STE-based` label while retaining the human-review compliance boundary.
- [ ] 2.4 Run the STE traceability test and confirm that the complete 53-identifier inventory and checklist citations remain intact.

## 3. Computer-Science Evidence Workflow

- [ ] 3.1 Revise the research skill description and workflow to distinguish evidence work from metadata-only DOI or bibliography maintenance without adding formal research modes.
- [ ] 3.2 Make repository bibliography conventions authoritative and retain the documented BibTeX conventions only as defaults when no repository convention applies.
- [ ] 3.3 Add a concise evidence characterization that records the supported claim, read location, relevant method or data, result, limitations, and full-text status without irrelevant placeholders.
- [ ] 3.4 State the computer-science and adjacent-technical-literature focus without adding systematic-review procedures or unrelated domain database catalogs.
- [ ] 3.5 Preserve the metadata-first publisher open-access check and the existing publisher OA, Sci-Hub, green OA, arXiv, and manual acquisition order.
- [ ] 3.6 Run the deterministic PDF acquisition fixtures and confirm source reporting, PDF-byte validation, and explicit Unpaywall identity remain unchanged.

## 4. Documentation and Package Verification

- [ ] 4.1 Update authored repository guidance and README text that would otherwise contradict the new personal policy or skill boundaries.
- [ ] 4.2 Confirm that no generated `plugin/skills/openspec-*` skill or `plugin/commands/opsx-*` command changed.
- [ ] 4.3 Run `openspec validate strengthen-personal-skills --strict`.
- [ ] 4.4 Run `nix develop --command bun run ci` and `nix flake check`.
- [ ] 4.5 Build the immutable plugin and run its isolated discovery smoke to confirm the always-applied policy, three authored skills, generated workflow payload, commit tool, and LSP overrides remain discoverable.
