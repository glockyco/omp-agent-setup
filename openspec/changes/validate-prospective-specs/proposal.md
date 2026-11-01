# Proposal

## Why

Strict delta validation can accept a requirement that fails strict validation once archive produces the full spec, including the 500-character requirement limit. The shared workflow must reject that result before a change merges.

## What Changes

- Add a shared workflow step that archives every open change in a disposable copy and strictly validates the resulting specs.
- Retain current active and archived checks, root safety, telemetry disablement and the artifact-only dependency boundary.
- Exercise valid and invalid prospective specs, multiple changes, no open changes and source-tree immutability.
- Explain the additional CI guarantee and the local-hook boundary in README.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `fleet-openspec-validation`: validate the full specs produced by all open changes without mutating the triggering checkout.

## Impact

The reusable workflow, its local execution harness and integration tests change. No plugin payload, generated adapter, runtime version or release changes. Current callers are discovered from GitHub repository trees because GitHub code search returns no results.
