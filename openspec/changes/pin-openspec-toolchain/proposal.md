## Why

A flake-lock refresh can currently change the OpenSpec generator without changing the repository's npm pin or committed adapters. Native GitHub jobs do not exercise that Nix generator, so they can report green while the retained flake check fails.

## What Changes

- Make the exact root npm dependency the authoritative OpenSpec version for every repository execution path.
- Package that exact CLI independently of the `llm-agents` input, with fixed source and npm dependency inputs.
- Preserve the `lib.openspecCheck` API and artifact-only source boundary for retained consumers.
- Treat the reusable workflow and offline-hook versions as generated mirrors. Refresh them through the existing adapter synchronization command and reject drift in checks.
- Remove the independent Renovate workflow-version manager, and keep Renovate off the OpenSpec dependency itself, because a pull request that changes it without the generated artifacts cannot pass. The coordinated synchronization is the only update path.
- Run the Nix CLI version, byte-exact adapter comparison and artifact contracts in GitHub CI as a separate Ubuntu job.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `fleet-openspec-validation`: Require one repository-owned CLI selection across native, reusable-workflow and retained Nix execution, coordinated mirror generation, and CI coverage of the Nix adapter boundary.

## Impact

The change affects development tooling, Nix packaging, update ownership, CI, tests and contributor guidance. It does not change the plugin payload at the current CLI version, remove retained consumers, install global tools or move consumers to a new CLI version. A later eligible OpenSpec update must use this coordinated path and obtain its own verification.
