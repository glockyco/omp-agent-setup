# Proposal

## Why

The notes skill tells agents that `git push` on Korolev needs Tern's desktop session. nix-config now stores Git's credentials in Git Credential Manager's DPAPI store, which SSH sessions can read, and a vault push over plain SSH worked. The line sends agents through Tern for nothing.

## What Changes

- Remove the Korolev push line from the `notes` skill.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-omp-plugin`: vault pushes need no particular session on Korolev.

## Impact

`plugin/skills/notes/SKILL.md` only.
