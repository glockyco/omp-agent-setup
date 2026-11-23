# Tasks

## 1. Vault search

- [x] 1.1 Synchronize the vault and search once more when a search finds no entry, and raise the synchronization failure when that synchronization fails. Verify with unit tests for an entry that appears after the synchronization, for a search that stays empty after exactly one synchronization, and for a failed synchronization.

## 2. Handoff rule

- [x] 2.1 Replace the named search in `plugin/rules/project-handoff.md` with the pointer to the `notes` skill, and state in its last line that a search that fails is not a missing note. Verify that the installed-release gate still finds the rule in the system prompt.

## 3. Local release preparation

- [x] 3.1 Ship with the unreleased version 0.11.17 that the access change already raised. Verify with the release-version check.
- [x] 3.2 Run strict validation for this change and `bun run check:local`. Verify that both pass.
- [x] 3.3 Stage only this change and create a local Conventional Commit with a causal body. Verify that the commit holds nothing else.

## Workflow follow-up

These two checks need the installed release, so they run after 0.11.17 is installed and are recorded in the notes vault item `omp-agent-setup`.

- Verify on Korolev that an entry created in the web vault during a session is found by the next search without a master password prompt.
- Run the two real trials from design.md in fresh OMP sessions: one reads the item note, the other reports that the handoff could not be read.
- Archive the change with its accepted specs in the implementation pull request.
