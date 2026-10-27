# Tasks

## 1. Skill

- [x] 1.1 Add `plugin/skills/persona-trials/SKILL.md` with the method, scope and prompt template from design.md, and raise the version to the next minor release in `.omp-plugin/marketplace.json`, `plugin/package.json` and `package.json` in the same commit. Add the skill to the expected list in `tests/plugin-load.unit.test.ts`. Verify that the plugin-load test finds the skill in the payload and that the release-version check passes.
- [x] 1.2 Give a fresh agent only the skill and the task of planning persona trials for a research artifact's README. Verify that its plan limits what each agent sees, audits what the trial machine provides for free, protects shared state, confirms findings independently and does not treat the results as evidence about users. Revise the skill where the plan misses one of these.

## 2. Release checks

- [x] 2.1 Add the skill to `SKILLS` in `scripts/release.ts` and in `tests/release_gate.py`. Verify that `tests/release-tree.unit.test.ts` passes and that a candidate without `plugin/skills/persona-trials` is reported as missing the skill.

## 3. Documentation and release

- [x] 3.1 Name persona trials among the skills in the README's "Use the skills and workflows" section.
- [ ] 3.2 Run `bun run check:local` and `openspec validate add-persona-trials-skill --strict`, and obtain the three native CI contexts and the OpenSpec context on the pull request.
- [ ] 3.3 With explicit authorization, merge, tag and upgrade Korolev and the Mac. Verify in a fresh OMP session on each host that the `persona-trials` skill is discovered.
