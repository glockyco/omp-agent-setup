# Proposal

## Why

Windows CI spends most of its time in installed-release verification. Repeated PowerShell process-table queries add process startup overhead to every CLI invocation, ownership poll and cleanup check.

## What Changes

- Read native process snapshots in the Windows release gate without starting a shell.
- Preserve creation-qualified ownership, descendant cleanup, failure visibility and all existing tests and coverage.
- Keep Windows process tooling pinned and maintained with the existing Python development tooling.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-omp-plugin`: Windows release verification queries ownership without spawning another process.

## Impact

Changes are limited to development requirements, dependency-update grouping and the release gate with its regression tests. No plugin payload, version or installed host state changes.
