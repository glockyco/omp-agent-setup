## Why

Storing the dependency-updater App private key in each target repository makes every target a trust root for the full App installation. The new fleet control plane can hold the key once while preserving repository-scoped tokens, review-only pull requests, and normal target CI.

## What Changes

- Move the weekly and manually triggered Nix update schedule to `glockyco/dependency-automation`.
- Remove the target-local update workflow and App credentials.
- Keep Renovate's Nix manager disabled so the central controller remains the only Nix owner.
- Preserve complete lock updates, App-authored pull requests, and mandatory Darwin and Linux CI.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `plugin-update-automation`: Change scheduled flake updates from a target-local credentialed workflow to the central fleet control plane.

## Impact

- Removes `.github/workflows/update.yml` and two target-repository Actions configuration values.
- Updates dependency guidance and the accepted automation contract.
- Adds `omp-agent-setup` to the central controller registry and GitHub App installation scope.
