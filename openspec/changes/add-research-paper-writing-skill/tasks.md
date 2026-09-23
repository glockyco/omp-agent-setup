## 1. Source and redistribution

- [x] 1.1 Select an exact upstream Research Paper Writing Skills commit and verify the skill directory's file list and relative links against that commit.
- [x] 1.2 Record the upstream MIT terms, third-party source provenance, unresolved redistribution permissions, and the user's explicit decision to include the complete package despite that risk. Do not describe these permissions as verified.

## 2. Immutable skill payload

- [x] 2.1 Vendor the complete upstream `research-paper-writing/` tree into `plugin/skills/research-paper-writing/`, include the upstream license, record provenance in the change, and compare the copied tree with the selected revision to verify no writing guidance or references were lost or rewritten.
- [x] 2.2 Update `plugin/tests/plugin-load.test.ts` and the `flake.nix` package-shape check to require the new skill and linked section guides in both source and built output. Verify those assertions through the release gates in task 3.1.
- [x] 2.3 Update the plugin README's capability inventory and verify it names the new skill without suggesting that the writing guidance automatically verifies sources.

## 3. Verification

- [x] 3.1 Run `openspec validate add-research-paper-writing-skill --strict`, `nix develop --command bun run ci`, and `nix flake check`. Verify all gates pass before declaring the plugin revision ready.
- [x] 3.2 Start a fresh wrapped OMP session with the locally built plugin output and exercise the real skill: discover it, request an outline for a sample paper section, and read one linked guide from the package. Verify the existing `research-evidence` skill remains available and no upstream checkout or runtime installation is needed.
