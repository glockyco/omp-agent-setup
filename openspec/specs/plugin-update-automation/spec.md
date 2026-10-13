# plugin-update-automation Specification

## Purpose
Define how the personal OMP plugin receives dependency updates through reviewable pull requests while local development and both CI systems use one Nix-selected toolchain.

## Requirements

### Requirement: Single Bun toolchain

The repository SHALL select one exact native Bun version through `.bun-version` and SHALL use that version for local checks and CI on Linux, macOS, and Windows without Nix. CI setup SHALL read the same pin, and local checks SHALL reject a different installed version. Renovate's Bun constraint SHALL be an enforced mirror of this pin, not an independent toolchain selection. Frozen lock-file installation SHALL remain required.

#### Scenario: Compare local and CI execution

- **WHEN** a maintainer and each CI runner execute the documented release gate
- **THEN** all development commands resolve native Bun at the version named by the same `.bun-version`
- **AND** no command requires the Nix development shell

#### Scenario: Local Bun version differs

- **WHEN** the installed development Bun does not match the repository pin
- **THEN** checks fail with the expected and observed versions rather than silently running another toolchain

#### Scenario: Renovate updates Bun

- **WHEN** Renovate proposes a newer development Bun
- **THEN** the pin, mirrored lock-file-writing constraint, and any regenerated lock file are reviewed together
- **AND** a stale mirrored constraint fails CI

### Requirement: Explicit dependency ownership

Renovate SHALL own JavaScript dependencies, their lock-file maintenance, GitHub Actions, and the repository's native Bun, npm OpenSpec, Python setup, and Windows terminal-support pins. The repository maintainer SHALL own the selected OMP tag and all six reviewed platform digests through one explicit pin-update command; automatic tag-only OMP updates SHALL be disabled. The central dependency automation control plane SHALL continue owning retained Nix inputs until the flake is removed in a separately gated change. Renovate's beta Nix manager SHALL remain disabled so one dependency has one updater. The target repository SHALL NOT store the updater App private key or run a competing Nix scheduler.

#### Scenario: Inspect update configuration

- **WHEN** a maintainer inspects Renovate, target workflow, and central registry configuration
- **THEN** each dependency class has exactly one declared update owner
- **AND** the target repository contains no App credential or scheduled Nix update workflow

#### Scenario: Native release-tool pin changes

- **WHEN** Renovate finds a newer npm OpenSpec version
- **THEN** it proposes a reviewable native-pin update that runs the complete cross-system gates
- **AND** it neither selects a mutable latest runtime nor publishes or upgrades a host

#### Scenario: Maintainer updates the OMP release pin

- **WHEN** a maintainer requests an explicit newer OMP release tag
- **THEN** the repository command fetches only that release's fixed SHA256SUMS.txt URL and writes the tag and six required platform digests together after complete validation
- **AND** missing, malformed or duplicate required checksums and download failures leave the existing pin unchanged
- **AND** the pin diff requires review and complete cross-system gates without selecting latest, fetching runtime metadata or changing a host

### Requirement: Review-only flake updates

A weekly and manually dispatchable central workflow SHALL update the retained plugin flake lock and open or refresh a pull request. It SHALL authenticate with a short-lived GitHub App token scoped to this repository and SHALL NOT merge the pull request. This ownership SHALL remain until a separately accepted flake-removal change deregisters the target.

#### Scenario: Trigger a flake update

- **WHEN** the central workflow finds a changed locked input
- **THEN** it creates a pull request whose head commit starts the normal Linux, macOS, Windows, and shared OpenSpec CI jobs automatically

#### Scenario: No flake change exists

- **WHEN** all locked inputs are current
- **THEN** the workflow exits successfully without creating an empty pull request

### Requirement: Enforced cross-system checks

The main branch SHALL require the current Linux, macOS, Windows, and shared OpenSpec CI job contexts for all actors, including administrators and automation. Every native platform SHALL run equivalent formatting, type, dead-code, audit, release-tree/version, behavior/coverage, adapter-freshness, and isolated installed-release checks without Nix. Force-push and branch deletion SHALL remain disabled.

#### Scenario: A required check fails

- **WHEN** an update pull request has a failing required job
- **THEN** GitHub prevents the pull request from merging

#### Scenario: Windows check fails while Unix checks pass

- **WHEN** native Windows CI detects a process, path, hook, or release-gate regression while Linux/macOS jobs pass
- **THEN** branch protection still prevents merge for humans and automation
- **AND** no platform skips the affected observable gate merely because a Unix fixture is unavailable

### Requirement: Deliberate runtime release

Automated dependency updates SHALL stop after tested pull-request creation. A plugin behavior, native release-tool pin, or retained `llm-agents` change SHALL require human review, the applicable development and cross-system gates, and explicit owner-authorized publication before downstream consumption. Runtime releases SHALL use the native marketplace install/upgrade procedure and fresh host-managed OMP sessions in Tern, not downstream Nix runtime-pin updates, a wrapper, or activation of a plugin package.

The downstream host SHALL retain its previous deployment until its own applicable release checks pass. Authentication and elevated host operations SHALL remain owner-assisted; pushes, merges, and release tags SHALL require explicit owner authorization. Publication and plugin upgrades SHALL NOT implicitly update upstream OMP or vice versa. An official binary installed only for CI SHALL NOT replace Korolev's Tern-managed OMP.

#### Scenario: Merge a behavior update

- **WHEN** a reviewed dependency update changes runtime behavior
- **THEN** no automation activates it on the workstation before the downstream release procedure succeeds
- **AND** the release is versioned, reviewed and explicitly authorized for publication before nix-config consumes it

#### Scenario: Verify the new deployment

- **WHEN** an owner upgrades the published personal plugin through the native manager
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
