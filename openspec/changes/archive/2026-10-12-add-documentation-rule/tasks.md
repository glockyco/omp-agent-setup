## 1. Rule

- [x] 1.1 Add `plugin/rules/documentation.md` and raise the version to the next minor release in `.omp-plugin/marketplace.json`, `plugin/package.json` and `package.json` in the same commit. Verify that `tests/plugin-load.unit.test.ts` finds the rule in the payload and that the release-version check passes.

## 2. Verification

- [x] 2.1 Add the rule to `RULES` in `scripts/release.ts`. Verify that `tests/release-tree.unit.test.ts` rejects a candidate without it.
- [x] 2.2 Add its heading to `RULE_HEADINGS` in `tests/release_gate.py` with a negative control that removes the rule. Verify that the gate names the missing rule.

## 3. Documentation and release

- [x] 3.1 List the rule in the payload table of `README.md`.
- [x] 3.2 Run the local checks and `openspec validate add-documentation-rule --strict`, and obtain the three native CI contexts and the OpenSpec context. `bun run check:local` passed 157 tests, and PR #62 passed all four contexts.
- [x] 3.3 Merge, tag and upgrade Korolev and the Mac. Verify in a fresh OMP session on each host that the system prompt carries the documentation rule. `v0.5.0` was tagged on 2026-10-12. Both hosts upgraded from the marketplace to 0.5.0, and a fresh `omp -p` session on each quoted `# Documentation` and `# Plain prose` from its system prompt.
