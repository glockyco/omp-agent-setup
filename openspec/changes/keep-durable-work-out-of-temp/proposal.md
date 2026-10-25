## Why

A session stored lasting SCCH evaluation work in a temporary directory, and Windows Storage Sense later deleted four of its seven files. The personal policy needs to direct lasting work into storage that survives a session.

## What Changes

- Add one always-applied personal-policy bullet requiring lasting work to be written into its repository, the notes vault or a synced documents folder, never a temporary directory.
- Extend installed-session verification to detect loss of that instruction, with a negative control that leaves the rest of the rule intact.
- Release personal 0.7.2 and verify the instruction in fresh sessions on both hosts.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-omp-plugin`: Extend the short personal policy with durable storage for lasting session work.

## Impact

The new instruction reaches every session through the existing rule. Scratch work and release-gate isolation remain temporary. This change does not recover files, alter operating-system cleanup or change other repositories.
