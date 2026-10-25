## 1. Rule and delivery

- [x] 1.1 Add the always-applied Project handoff rule and remove the duplicate handoff duty from the notes skill.
- [x] 1.2 Require the rule in release-tree validation, payload discovery and installed-prompt probes. Add missing-rule negative controls.
- [x] 1.3 Describe the handoff capability in README and raise all three release versions to 0.7.0 with the runtime change.

## 2. Verification and publication

- [ ] 2.1 Run `bun run check:local` and `openspec validate add-project-handoff-rule --strict` after implementation. Obtain all three native CI contexts and the shared OpenSpec context, then rebase-merge the PR.
- [ ] 2.2 Confirm green CI on the merged runtime commit. Archive the change after all checks pass, validate the archived artifacts and obtain green CI on the reviewed archive commit. Tag the released commit `v0.7.0` and push it.
- [ ] 2.3 Upgrade personal to 0.7.0 on Korolev and the Mac. Confirm each host's plugin list and that a fresh noninteractive `omp -p` session quotes `Project handoff`.
