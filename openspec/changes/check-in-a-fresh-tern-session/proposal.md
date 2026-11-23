# Proposal

## Why

When a check needs a fresh OMP session, such as a new host variable or a plugin release, agents tell the person to restart OMP or to open a terminal. They can start that session themselves through Tern, and nothing in OMP or Tern tells them so. The trials are in [evidence.md](evidence.md).

## What Changes

- The always-applied personal policy gains one sentence: never tell the person to restart OMP or open a terminal for a check, and start, observe and end a fresh Tern session instead.
- No skill is added. `tern --help` documents the commands, and agents read it without being told.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-omp-plugin`: the personal policy directs checks that need a fresh session to Tern.

## Impact

`plugin/rules/personal-policy.md`. The sentence ships with the next plugin release. It assumes that OMP sessions run in Tern, which holds on Korolev and the Mac.
