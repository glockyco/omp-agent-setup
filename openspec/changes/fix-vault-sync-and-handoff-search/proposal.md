# Proposal

## Why

Two failures looked like an honest "nothing there". The `vault` tool synchronizes once per OMP process, so an entry added during a session stayed invisible until the vault was locked and unlocked with the master password. The handoff rule names a search of `vault://notes/` and tells agents to skip the handoff when no note exists, and that search returns no matches at the vault root on Korolev while the note is there.

## What Changes

- A vault search that finds no entry synchronizes the vault and searches once more before it reports that nothing matches. A failed synchronization is reported as a failure.
- The handoff rule no longer names a search mechanism. It tells the agent to find the note through the vault as the `notes` skill reaches it, and to skip the handoff only when a search that worked found no note.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `vault-access`: a search result of no entries is fresh.
- `personal-omp-plugin`: the handoff rule separates a failed search from a missing note.

## Impact

- `plugin/extensions/vault.ts` and `tests/vault.unit.test.ts`.
- `plugin/rules/project-handoff.md`.
- The plugin, marketplace and root package versions advance together by a patch version.
- The root search of `vault://notes/` is reported to OMP. This change does not depend on its repair.
