# Design

## Context

The shared preset will own safe dependency automerge and Renovate's three-day release age. Bun already enforces 259200 seconds through its install configuration. The root automerge false override blocks inheritance.

## Goals / Non-Goals

Remove contradictory repository policy without changing plugin runtime behavior, manual OMP/OpenSpec ownership, the Nix updater or publication authorization.

## Decisions

Delete the local automerge property rather than restating the shared value. Keep the existing Bun gate unchanged. Update tests so pin ownership stays enforced while a local automerge override fails. Adjust the existing deliberate-release contract because merging a development dependency is not publication.

## Risks / Trade-offs

The shared preset controls the exact eligible update classes. Required CI remains mandatory, and manual runtime release procedures are unchanged.
