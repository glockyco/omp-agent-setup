# Tasks

## 1. Vault search

- [ ] 1.1 Synchronize the vault and search once more when a search finds no entry, and raise the synchronization failure when that synchronization fails. Verify with unit tests for an entry that appears after the synchronization, for a search that stays empty after exactly one synchronization, and for a failed synchronization.
- [ ] 1.2 Verify on Korolev that an entry created in the web vault during a session is found by the next search without a master password prompt.

## 2. Handoff rule

- [ ] 2.1 Replace the named search in `plugin/rules/project-handoff.md` with the pointer to the `notes` skill, and state in its last line that a search that fails is not a missing note. Verify that the installed-release gate still finds the rule in the system prompt.
- [ ] 2.2 Run the two real trials from design.md in fresh OMP sessions and record their outcomes in this change. Verify that the first reads the item note and the second reports that the handoff could not be read.

## 3. Local release preparation

- [ ] 3.1 Raise the marketplace, plugin manifest and root package to the next matching patch version. Verify with the release-version check.
- [ ] 3.2 Run strict validation for this change and `bun run check:local`. Verify that both pass.
- [ ] 3.3 Stage only this change and create a local Conventional Commit with a causal body. Verify that the commit holds nothing else.

## Workflow follow-up

- Archive the change with its accepted specs in the implementation pull request.
