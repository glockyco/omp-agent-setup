## 1. Rule and verification

- [x] 1.1 Add the supplied durable-work bullet to personal policy, update its README description and bump the three release versions to 0.7.2.
- [x] 1.2 Observe the instruction in the installed system prompt and add a negative control that removes only that instruction while retaining the personal policy.
- [x] 1.3 Run the local checks and strict change validation after implementation. Obtain all three native CI contexts and shared OpenSpec, rebase-merge and confirm green merged CI. `bun run check:local` and strict change validation passed on Korolev. PR #76 passed all four contexts and rebase-merged as `7e766f1e6a475f087f70c4454688230a8bd9b277`. Main run `40195514156` passed all four contexts, including the installed-prompt omission control.

## 2. Publication and handoff

- [x] 2.1 Tag the checked runtime commit as v0.7.2 and push the tag. Upgrade personal on Korolev and the Mac. In fresh noninteractive sessions on each host, quote the new bullet. The annotated tag is pushed on `7e766f1e6a475f087f70c4454688230a8bd9b277`. Both hosts report `personal@glockyco (0.7.2) (user)`. Both fresh probes returned the exact supplied bullet, including its repository, notes vault and synced documents destinations and temporary-directory prohibition. The Mac probe closed remote stdin with `</dev/null`.
- [x] 2.2 Record verification and host acceptance, then archive the completed change and sync its requirement.

The archive PR must pass strict artifact validation and all four CI contexts before merge. This is the archive's delivery gate rather than an implementation task required by its own archived-task validation.
