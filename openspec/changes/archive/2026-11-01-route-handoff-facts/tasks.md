# Tasks

## 1. Rule and skill

- [x] 1.1 Rewrite `plugin/rules/project-handoff.md` as design.md describes, and raise the version to 0.11.2 in `.omp-plugin/marketplace.json`, `plugin/package.json` and `package.json`. Verify that the plugin-load test and the release-version check pass.
- [x] 1.2 Change the notes skill's line on history so that it names Notes sections and daily notes and says that a `Resume here:` line holds only the current state.
- [x] 1.3 Run the trial that design.md describes with the previous and the new rule, revise the rule where an agent misplaced or dropped a fact of the old line, and repeat with fresh agents until a round places every fact.

## 2. Vault

- [x] 2.1 Change the Items section of the vault's `Conventions.md` to the same definition of the line.
- [x] 2.2 Rewrite the Ancient Kingdoms Compendium note by hand: its line, its tasks and its Notes.
- [x] 2.3 Rewrite the other lines of more than 100 words under the new rule: ANITA, nix-config, The Bloodline Compendium, Security Incentivization, Workbench, PhD thesis and omp-agent-setup. Verify for each note that every fact of its old line is in the new line, a task, a `#waiting` task or the Notes, or is history or state that Git and Workbench keep.

## 3. Release

- [x] 3.1 Run `bun run check:local` and `openspec validate route-handoff-facts --strict`, and obtain the three native CI contexts and the OpenSpec context on the pull request.
- [x] 3.2 With explicit authorization, merge, tag the release and upgrade the Mac. Verify in a fresh OMP session that its system prompt carries the new Project handoff rule.

## Workflow follow-up

- Upgrade Korolev once SSH works, together with the changes that already wait for it.
- Archive the change after both hosts run the release.
