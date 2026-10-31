# Tasks

## 1. Remove the adapter

- [x] 1.1 Delete the extension, its tests and fixtures, and its entries in `plugin/package.json`, `scripts/release.ts`, `tests/release_gate.py`, `tests/plugin-load.unit.test.ts` and `tests/release-tree.unit.test.ts`. Verify that `bun run check:local` passes and no source refers to the adapter.
- [x] 1.2 Delete the withdrawn change `annotate-html-and-images`. Verify with `openspec validate --all --strict`.
- [x] 1.3 Replace the README's annotation sections with a pointer to the official plugin and update the marketplace descriptions. Verify that no README line describes the adapter.

## 2. Release

- [ ] 2.1 Raise the version to 0.10.0 in the three version fields and run `bun run ci`. Verify that the native gate passes.
- [ ] 2.2 Obtain the CI contexts on all three hosts, merge and tag `v0.10.0`. Verify that the tag points at the merged commit.
- [ ] 2.3 Upgrade the Mac after nix-config installs the official plugin. Verify in a fresh OMP session that `/plannotator-annotate` and `/plannotator-last` come from the official plugin.

## Workflow follow-up

- Upgrade Korolev in a Tern desktop session and check the same commands.
- Archive the change after both hosts run the release.
