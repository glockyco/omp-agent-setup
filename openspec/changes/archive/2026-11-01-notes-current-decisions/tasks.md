# Tasks

## 1. Skill

- [x] 1.1 Replace the first Write line of `plugin/skills/notes/SKILL.md`.
- [x] 1.2 Raise the version to 0.11.6 in `.omp-plugin/marketplace.json`, `plugin/package.json` and `package.json`. Verify that `bun run check:local` passes and that the change validates.

## 2. Release

- [x] 2.1 Obtain the three native CI contexts and the OpenSpec context on the pull request, merge and tag `v0.11.6`.
- [x] 2.2 Upgrade the Mac and Korolev. Verify in a fresh OMP session on each host that the notes skill carries the new line.

## Workflow follow-up

- Archive the change after both hosts run the release.
