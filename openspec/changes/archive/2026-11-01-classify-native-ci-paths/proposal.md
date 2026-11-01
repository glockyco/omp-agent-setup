# Proposal

## Why

Documentation and OpenSpec-only pull requests currently provision three complete native environments even though shared artifact validation can check their contracts independently.

## What Changes

- Classify the complete PR diff and skip native gates only for OpenSpec and Markdown paths.
- Preserve required check contexts and fail them when classification fails.
- Keep shared OpenSpec validation independent and retain every native test and coverage gate.

## Capabilities

### New Capabilities

- `repository/ci-path-classification`: conservative native CI selection with stable required contexts.

### Modified Capabilities

None.

## Impact

The CI workflow, a dependency-free Python classifier and regression tests change. AGENTS check guidance is coordinated with the release-procedure change. Runtime payload and reusable OpenSpec workflow remain unchanged.
