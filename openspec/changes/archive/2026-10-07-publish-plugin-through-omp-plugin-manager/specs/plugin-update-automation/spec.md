## MODIFIED Requirements

### Requirement: Deliberate runtime release

Automated dependency updates SHALL stop after tested pull-request creation. A plugin behavior or `llm-agents` change SHALL require human review, the applicable existing development and cross-system gates, and explicit owner-authorized publication before downstream consumption. Runtime releases SHALL use the native marketplace install/upgrade procedure and fresh upstream OMP sessions in Tern, not downstream Nix runtime-pin updates, a wrapper, or activation of a plugin package.

The downstream host SHALL retain its previous deployment until its own applicable release checks pass. Authentication and elevated host operations SHALL remain owner-assisted; pushes, merges, and release tags SHALL require explicit owner authorization. Publication and plugin upgrades SHALL NOT implicitly update upstream OMP or vice versa.

#### Scenario: Merge a behavior update

- **WHEN** a reviewed dependency update changes runtime behavior
- **THEN** no automation activates it on the workstation before the downstream release procedure succeeds
- **AND** the release is versioned, reviewed and explicitly authorized for publication before nix-config consumes it

#### Scenario: Verify the new deployment

- **WHEN** an owner upgrades the published personal plugin through the native manager
- **THEN** a fresh upstream OMP session in Tern observes the advertised installed version and exercises the changed capability
- **AND** no wrapper or Nix runtime-package activation is needed to expose the plugin

## ADDED Requirements

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

- **WHEN** the owner authorizes publication of known-good content as a newer corrective release
- **THEN** the ordinary catalog-refresh and user-scoped upgrade procedure installs it
- **AND** no published tag or same-version cache content is rewritten as the rollback mechanism

### Requirement: Upgrade acceptance preserves deliberate state

The release gate SHALL exercise catalog refresh and plugin upgrade in a disposable profile using a newer fixture release. It SHALL verify the new installed version and complete capability surface after a fresh load. It SHALL also verify that disabled state, selected features, and plugin settings already present in the native manager are not silently reset by upgrade.

Current instructions SHALL distinguish targeted reinstallation from newer-version detection and SHALL require catalog refresh before the explicit user-scoped target upgrade. They SHALL NOT instruct users to rely on startup notifications or all-plugin partial-success output as release acceptance.

#### Scenario: Upgrade a disposable candidate

- **WHEN** the gate refreshes a candidate catalog to a newer declared version and upgrades `personal@glockyco` in user scope
- **THEN** the installed registry and a fresh capability load use the newer version
- **AND** the gate proves all declared capabilities remain available when the plugin is enabled

#### Scenario: Upgrade an intentionally disabled plugin

- **WHEN** an installed personal plugin is disabled before the gate upgrades it
- **THEN** its disabled state and persisted feature/settings selections remain unchanged
- **AND** the gate does not mistake disabled discovery for missing installed release assets
