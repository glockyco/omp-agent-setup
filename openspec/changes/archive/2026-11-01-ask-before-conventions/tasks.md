# Tasks

## 1. Skill

- [x] 1.1 Add the line to the Write section of `plugin/skills/notes/SKILL.md` and raise the version to 0.11.4 in `.omp-plugin/marketplace.json`, `plugin/package.json` and `package.json`. Verify that the plugin-load and release-version checks pass and that the change validates.

## 2. Release

- [x] 2.1 Obtain the three native CI contexts and the OpenSpec context on the pull request, merge and tag `v0.11.4`.
- [x] 2.2 Upgrade the Mac and Korolev and discard the uncommitted line in Korolev's clone. Verify in a fresh OMP session on each host that the notes skill carries the line.

## Workflow follow-up

- Archive the change after both hosts run the release.
