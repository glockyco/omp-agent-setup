## Why

The plugin-update-automation spec still makes Renovate the updater of the npm OpenSpec dependency and expects its pull request to pass the complete gates. Since pin-openspec-toolchain, a version change has to move together with the generated workflow and hook pins, the Nix packaging lock and hashes and the adapters, which Renovate cannot regenerate. Such a pull request could never pass, so Renovate no longer proposes it, as the fleet-openspec-validation spec states. The two specs contradict each other, and AGENTS.md repeats the outdated rule.

## What Changes

- The maintainer owns the npm OpenSpec dependency, as for the OMP release pin: change the dependency, refresh the Nix packaging lock and hashes, and run the synchronization command, then review and run the cross-system gates.
- AGENTS.md states the same ownership.

## Capabilities

### New Capabilities

### Modified Capabilities

- `plugin-update-automation`: the npm OpenSpec dependency moves from Renovate to the maintainer.

## Impact

AGENTS.md. No code or configuration changes, because renovate.json already disables the dependency.
