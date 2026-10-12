## 1. Rule

- [ ] 1.1 Add `plugin/rules/documentation.md` and raise the version to the next minor release in `.omp-plugin/marketplace.json`, `plugin/package.json` and `package.json` in the same commit. Verify that `tests/plugin-load.unit.test.ts` finds the rule in the payload and that the release-version check passes.

## 2. Verification

- [ ] 2.1 Add the rule to `RULES` in `scripts/release.ts`. Verify that `tests/release-tree.unit.test.ts` rejects a candidate without it.
- [ ] 2.2 Add its heading to `RULE_HEADINGS` in `tests/release_gate.py` with a negative control that removes the rule. Verify that the gate names the missing rule.

## 3. Documentation and release

- [ ] 3.1 List the rule in the payload table of `README.md`.
- [ ] 3.2 Run the local checks and `openspec validate add-documentation-rule --strict`, and obtain the three native CI contexts and the OpenSpec context.
- [ ] 3.3 Merge, tag and upgrade Korolev and the Mac. Verify in a fresh OMP session on each host that the system prompt carries the documentation rule.
