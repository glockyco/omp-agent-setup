## 1. Rule

- [x] 1.1 Add `plugin/rules/plain-prose.md` with the rule text from `design.md`, and raise the version to the next minor release in `.omp-plugin/marketplace.json`, `plugin/package.json` and `package.json` in the same commit. Verify that `tests/plugin-load.test.ts` finds the rule in the payload and that the release-version check passes.

## 2. Verification

- [x] 2.1 Replace the single `RULE` path in `scripts/release.ts` with a list of both rule paths. Verify that `tests/release-tree.test.ts` rejects a candidate without either rule.
- [x] 2.2 Check the first heading of every shipped rule in a fresh session's system prompt in `tests/release_gate.py`, and add a negative control that removes `plain-prose.md`. Verify that the gate names the missing rule.

## 3. Documentation and release

- [x] 3.1 List `plugin/rules/plain-prose.md` in the payload table of `README.md`. Verify that the table names every file under `plugin/rules/`.
- [x] 3.2 Run `nix develop --command bun run ci` and `nix flake check`, and validate the change with `openspec validate add-plain-prose-rule --strict`. Verify that all three pass.
- [ ] 3.3 With owner authorization, merge, tag and upgrade the hosts. Verify in a fresh OMP session in Tern that the system prompt carries the plain-prose rule.
