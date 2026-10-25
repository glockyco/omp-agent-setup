## MODIFIED Requirements

### Requirement: Deliberate runtime release

Automated dependency updates SHALL stop after tested pull-request creation. A plugin behavior, native release-tool pin, or retained `llm-agents` change SHALL require human review, the applicable development and cross-system gates, and explicitly authorized publication before downstream consumption. Runtime releases SHALL use the native marketplace install/upgrade procedure and fresh host-managed OMP sessions in Tern, not downstream Nix runtime-pin updates, a wrapper, or activation of a plugin package.

The downstream host SHALL retain its previous deployment until its own applicable release checks pass. Authentication and elevated host operations SHALL remain interactive. Pushes, merges, and release tags SHALL require explicit authorization. Publication and plugin upgrades SHALL NOT implicitly update upstream OMP or vice versa. An official binary installed only for CI SHALL NOT replace Korolev's Tern-managed OMP.

#### Scenario: Merge a behavior update

- **WHEN** a reviewed dependency update changes runtime behavior
- **THEN** no automation activates it on the workstation before the downstream release procedure succeeds
- **AND** the release is versioned, reviewed and explicitly authorized for publication before nix-config consumes it

#### Scenario: Verify the new deployment

- **WHEN** the published personal plugin is upgraded through the native manager
- **THEN** a fresh host-managed OMP session in Tern observes the advertised installed version and exercises the changed capability
- **AND** no wrapper or Nix runtime-package activation is needed to expose the plugin

#### Scenario: Official binary CI finishes

- **WHEN** release verification completes with an isolated official OMP binary
- **THEN** Korolev's Tern-managed executable and real OMP state remain unchanged
- **AND** actual host acceptance remains separate from that CI evidence

### Requirement: Version-signalled marketplace releases

Every distributed runtime release SHALL declare the same semantic version in the personal catalog entry and payload package manifest. Runtime-content, generated-adapter, catalog LSP semantics, or compatibility changes SHALL bump that version in the same reviewed release revision. Development-only or documentation-only changes MAY leave the runtime version unchanged. A marketplace metadata version or source commit alone SHALL NOT replace the personal catalog entry's version signal.

The release gate SHALL reject mismatched versions and a changed runtime payload without a newer semantic version. Published release tags SHALL be immutable and SHALL identify the reviewed release commit. A corrective rollback SHALL restore known-good runtime content in a newer reviewed version rather than overwrite a published version or tag.

#### Scenario: A newer release is published

- **WHEN** the catalog entry and payload version are raised together and the reviewed release is published
- **THEN** catalog refresh makes the newer personal release available to OMP's version-based update detection
- **AND** explicit user-scoped upgrade installs that advertised version

#### Scenario: Runtime content changes without a bump

- **WHEN** a release revision changes distributed runtime content but leaves its catalog version unchanged or older
- **THEN** the release gate fails rather than publishing changed content under the prior version

#### Scenario: Version sources disagree

- **WHEN** the personal catalog entry and payload manifest declare different release versions
- **THEN** the release gate fails and identifies the mismatch

#### Scenario: Roll back a bad release

- **WHEN** publication of known-good content as a newer corrective release is authorized
- **THEN** the ordinary catalog-refresh and user-scoped upgrade procedure installs it
- **AND** no published tag or same-version cache content is rewritten as the rollback mechanism
