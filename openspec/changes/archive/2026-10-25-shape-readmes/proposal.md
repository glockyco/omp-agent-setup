# Proposal

## Why

Agents keep growing READMEs into everything known about a project: setup next to release procedures, internals, edge cases and history, so that what a first-time reader needs gets lost. A pass over the glockyco tool and site repositories on 2026-10-25 reworked their READMEs for that reason. The documentation rule says what documentation must not contain, but not what a README is for, so the same drift would start again.

## What Changes

- The documentation rule says what a README holds: what the project does and for whom, how to set it up and use it, and where to read more, with pointers to specs, docs and agent instructions instead of copies of them.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-omp-plugin`: the documentation rule.

## Impact

`plugin/rules/documentation.md` and the plugin version.
