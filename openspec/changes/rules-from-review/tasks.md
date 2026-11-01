# Tasks

## 1. Rules and skills

- [x] 1.1 Add the lines on questions in Plannotator and checks after a push to `plugin/rules/personal-policy.md`.
- [x] 1.2 Name posts about the games in `plugin/rules/compare-options.md` and in the description of `plugin/skills/compare-options/SKILL.md`.
- [x] 1.3 Add the line on task numbers to `plugin/skills/commit-policy/SKILL.md`.
- [x] 1.4 Raise the version to 0.11.5 in `.omp-plugin/marketplace.json`, `plugin/package.json` and `package.json`. Verify that `bun run check:local` passes and that the change validates.

## 2. Release

- [ ] 2.1 Obtain the three native CI contexts and the OpenSpec context on the pull request, merge and tag `v0.11.5`.
- [ ] 2.2 Upgrade the Mac and Korolev. Verify in a fresh OMP session on each host that the personal policy carries both new lines.

## Workflow follow-up

- Archive the change after both hosts run the release.
