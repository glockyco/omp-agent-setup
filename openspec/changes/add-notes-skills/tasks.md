## 1. Skills and rule

- [x] 1.1 Add `plugin/skills/notes/SKILL.md` and `plugin/skills/weekly-review/SKILL.md`, exempt vault notes in `plugin/rules/documentation.md`, and raise the version to the next minor release in `.omp-plugin/marketplace.json`, `plugin/package.json` and `package.json` in the same commit. Verify that `tests/plugin-load.unit.test.ts` finds both skills in the payload and that the release-version check passes.

## 2. Verification

- [x] 2.1 Add both skills to `SKILLS` in `scripts/release.ts`. Verify that `tests/release-tree.unit.test.ts` rejects a candidate without the `notes` skill.
- [x] 2.2 Add both skills to `SKILLS` in `tests/release_gate.py` with a negative control that removes the `notes` skill. Verify that the gate names the missing skill. `test_missing_notes_skill` runs in the release gate of every native CI context.

## 3. Documentation and release

- [x] 3.1 List both skills in the payload table of `README.md`, and state the vault exemption in the documentation rule's row.
- [x] 3.2 Run the local checks and `openspec validate add-notes-skills --strict`, and obtain the three native CI contexts and the OpenSpec context. `bun run check:local` passed on Korolev, and PR #70 passed all four contexts.
- [x] 3.3 Merge, tag and upgrade Korolev and the Mac. Verify in a fresh OMP session on each host that both skills are discovered and that `vault://notes/Conventions.md` reads the conventions note. `v0.6.0` was tagged on 2026-10-23, and both hosts upgraded to 0.6.0. A fresh `omp -p` session from the SANER repository on Korolev and from the nix-config checkout on the Mac listed both skills, read the vault through `vault://notes/`, listed its tasks and wrote and read back a scratch note, which was then deleted.
