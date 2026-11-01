# Tasks

## 1. Rule

- [x] 1.1 Add the reader line to `plugin/rules/plain-prose.md`, above the punctuation bullets.
- [x] 1.2 Archive `notes-current-decisions`.
- [x] 1.3 Raise the version to 0.11.7 in `.omp-plugin/marketplace.json`, `plugin/package.json` and `package.json`. Verify that `bun run check:local` passes and that the change validates.

## 2. Release

- [ ] 2.1 Obtain the three native CI contexts and the OpenSpec context on the pull request, merge and tag `v0.11.7`.
- [ ] 2.2 Upgrade the Mac and Korolev. Verify in a fresh OMP session on each host that the plain-prose rule carries the reader line.

## Workflow follow-up

- Archive the change after both hosts run the release.
