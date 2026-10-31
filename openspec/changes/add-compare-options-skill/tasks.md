# Tasks

## 1. Skill and rule

- [ ] 1.1 Add `plugin/skills/compare-options/SKILL.md` and `plugin/rules/compare-options.md` with the texts from design.md, and raise the version to the next minor release in `.omp-plugin/marketplace.json`, `plugin/package.json` and `package.json` in the same commit. Add the skill and the rule to the expected lists in `tests/plugin-load.unit.test.ts`. Verify that the plugin-load test finds both in the payload and that the release-version check passes.
- [ ] 1.2 Give a fresh agent only the skill and the task of wording a known-issue entry for a game bug that helps the player. Verify that its plan gathers references, drafts options that differ in structure together with the current text, marks a recommendation with a reason, plans a Plannotator review and a case in the notes vault, and ships nothing. Revise the skill where the plan misses one of these.

## 2. Plain prose

- [ ] 2.1 Change the last line of `plugin/rules/plain-prose.md` to "Factual sentences without filler or hedging." Verify that `tests/plugin-load.unit.test.ts` passes and that the rule file holds no other change.

## 3. Release checks

- [ ] 3.1 Add the skill to `SKILLS` and the rule to `RULES` in `scripts/release.ts`, and to `SKILLS` and the rule headings in `tests/release_gate.py`. Verify that `tests/release-tree.unit.test.ts` passes and that a candidate without the skill or without the rule is reported as missing it.

## 4. Documentation and release

- [ ] 4.1 Name comparisons of player-facing text and design among the workflows in the README's "Use the skills and workflows" section. Verify that the README links the skill and states no other change.
- [ ] 4.2 Run `bun run check:local` and `openspec validate add-compare-options-skill --strict`, and obtain the three native CI contexts and the OpenSpec context on the pull request.
- [ ] 4.3 With explicit authorization, merge, tag the release and upgrade the Mac. Verify in a fresh OMP session that `compare-options` is discovered and that the system prompt of a session and of a subagent carries the compare-options rule.

## Workflow follow-up

- Upgrade Korolev once SSH works, together with the remaining host tasks of `adopt-official-plannotator`, and check the skill in a Tern desktop session.
- Archive the change after both hosts run the release.
