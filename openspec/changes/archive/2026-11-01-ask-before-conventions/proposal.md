# Proposal

## Why

The vault's `Conventions.md` applies to every note and every session. Agents changed it twice without asking: on 2026-10-30 an agent extended it with plugin behavior while upgrading a plugin, and on 2026-11-01 an agent changed its Items section together with a rule change, before the person had seen either. A line asking agents to propose such changes first was written on 2026-10-30 but never committed, so no session loaded it.

## What Changes

- The notes skill asks agents to propose a change to `Conventions.md` in Plannotator and make it only once approved, never as a side effect of other work, and to describe a plugin's behavior in its README.
- Release the change as 0.11.4.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-omp-plugin`: the notes skill has agents ask before they change the vault's conventions note.

## Impact

Sessions on upgraded hosts propose a change to `Conventions.md` in Plannotator before making it. Changes to other notes are unaffected.
