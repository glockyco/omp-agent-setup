# Proposal

## Why

The repository disables all Renovate automerge locally, which would override the shared preset's approved minor, patch and lockfile policy. Bun already enforces the required three-day age gate, so no package-manager gate change is needed.

## What Changes

- Remove the local automerge override and inherit the shared preset.
- Keep OMP and OpenSpec updates manual and retained Nix updates review-only.
- Clarify that safe development dependency merges do not authorize plugin publication or host upgrades.
- Update pin-ownership tests to reject a repository automerge override.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `plugin-update-automation`: distinguish preset-controlled safe dependency merges from deliberate runtime releases.

## Impact

Renovate configuration, its tests and the dependency contract change. The plugin payload and all release versions remain unchanged. Shared policy is tracked in glockyco/renovate-config#6.
