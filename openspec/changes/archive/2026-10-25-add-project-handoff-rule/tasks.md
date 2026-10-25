## 1. Rule and delivery

- [x] 1.1 Add the always-applied Project handoff rule and remove the duplicate handoff duty from the notes skill.
- [x] 1.2 Require the rule in release-tree validation, payload discovery and installed-prompt probes. Add missing-rule negative controls.
- [x] 1.3 Describe the handoff capability in README and raise all three release versions to 0.7.0 with the runtime change.

## 2. Verification and publication

- [x] 2.1 Run `bun run check:local` and `openspec validate add-project-handoff-rule --strict` after implementation. Obtain all three native CI contexts and the shared OpenSpec context, then rebase-merge the PR. Local checks passed on Korolev. PR #73 passed all four contexts and merged as `fe748f3b2c59fbc79ed6e5bca0432aa34d9f530f`. Its main CI run `40187072901` also passed all four contexts.
- [x] 2.2 Confirm green CI on the merged runtime commit, archive the change after those checks pass, and tag the released commit `v0.7.0`. The change was archived on 2026-10-25 after main run `40187072901` passed. The annotated tag was pushed on `fe748f3b2c59fbc79ed6e5bca0432aa34d9f530f`.
- [x] 2.3 Upgrade personal to 0.7.0 on Korolev and the Mac. Both plugin lists report `personal@glockyco (0.7.0) (user)`. Fresh noninteractive `omp -p "Quote the first heading of your Project handoff rule."` sessions on both hosts answered `The rule has only one heading:` followed by `> # Project handoff`. The Mac probe needed `</dev/null` inside the remote command to close its stdin.

The archive PR must pass strict archived-artifact validation and all four CI contexts before merge. This is the archive's delivery gate, not an implementation task that archived-artifact validation can require before its own CI run.
