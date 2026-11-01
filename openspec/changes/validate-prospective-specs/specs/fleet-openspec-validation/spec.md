## ADDED Requirements

### Requirement: Validate the specs produced by open changes

The shared workflow SHALL archive every open change in a disposable artifact copy and strictly validate the resulting specs. It SHALL fail on an archive error or invalid resulting spec, preserve the triggering checkout byte for byte and succeed when valid specs have no open changes. Prospective validation SHALL NOT require unrelated repository dependencies.

#### Scenario: Delta produces an invalid full spec

- **WHEN** an open change passes strict delta validation but archive produces a requirement exceeding the full-spec limit
- **THEN** the shared workflow fails before that change merges and identifies the archive or spec failure

#### Scenario: Multiple open changes contribute to the resulting specs

- **WHEN** the repository contains multiple open changes
- **THEN** the disposable copy archives every change before strict resulting-spec validation
- **AND** the original active changes, accepted specs and archived changes remain unchanged

#### Scenario: No open changes exist

- **WHEN** the repository has valid specs and no open changes
- **THEN** prospective validation succeeds after strictly validating those specs

#### Scenario: Prospective archive fails

- **WHEN** an open change cannot be archived in the disposable copy
- **THEN** the workflow fails with that change's archive diagnostic and removes its scratch directory
