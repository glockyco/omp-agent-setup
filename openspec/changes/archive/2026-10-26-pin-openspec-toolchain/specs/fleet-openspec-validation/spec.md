## ADDED Requirements

### Requirement: One repository-owned CLI selection

Repository-native generation, the reusable validator and retained Nix execution SHALL use the exact OpenSpec version selected by one repository-owned npm dependency. Updating an unrelated flake input SHALL NOT change that selection. Nix source and dependency inputs SHALL remain fixed and independently verifiable. Existing `lib.openspecCheck` consumers SHALL retain their interface and artifact-only source boundary.

#### Scenario: An upstream flake input changes OpenSpec

- **WHEN** a lock refresh selects an upstream input containing another OpenSpec version
- **THEN** repository Nix generation and validation still execute the repository-selected CLI
- **AND** retained consumers need no CLI dependency or interface change

#### Scenario: A Nix packaging lock is stale

- **WHEN** the vendored npm lock identifies a different package or version than the canonical dependency
- **THEN** validation rejects that packaging input before claiming toolchain parity

### Requirement: Coordinated OpenSpec update artifacts

One npm dependency SHALL be the version-update target. The adapter synchronization command SHALL derive reusable-workflow and documented host-hook version mirrors from that dependency and regenerate the adapters. Checks SHALL reject stale, missing or ambiguous mirrors. The caller's manifest or a version input SHALL NOT choose the shared validator's CLI. Automated dependency updates SHALL NOT propose that dependency, because a change to it alone cannot pass.

#### Scenario: Update the canonical CLI pin

- **WHEN** the canonical npm version changes and synchronization runs
- **THEN** the workflow install mirror, both documented hook comparisons and diagnostics, and generated adapters match that selection
- **AND** unrelated bytes remain unchanged

#### Scenario: A generated mirror drifts

- **WHEN** a mirror has another version or lacks a unique expected anchor
- **THEN** the native gate fails with the affected boundary identified
- **AND** malformed synchronization does not partially update other mirrors

#### Scenario: A new OpenSpec release appears

- **WHEN** Renovate finds a newer `@fission-ai/openspec` release
- **THEN** it opens no pull request for it
- **AND** the update happens only through the coordinated synchronization

### Requirement: CI verifies the retained Nix generator

GitHub CI SHALL execute the retained Nix CLI version check, byte-exact adapter comparison and artifact validation. A Nix-selected executable or adapter drift SHALL report a failing CI job rather than rely solely on the separate native npm checks. All existing native platform and shared artifact checks SHALL remain enabled.

#### Scenario: Nix generation disagrees with committed adapters

- **WHEN** the actual Nix CLI generates different, missing or extra adapters
- **THEN** the Nix CI job fails
- **AND** successful native npm checks do not turn the workflow green
