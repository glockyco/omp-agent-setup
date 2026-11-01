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

Renovate SHALL own JavaScript dependencies other than OpenSpec, lockfiles, Actions, native Bun, Python setup and Windows terminal-support pins. The maintainer SHALL own the OMP tag and six reviewed digests and the npm OpenSpec dependency, each through one explicit update procedure, with automatic updates of both disabled. The central control plane SHALL own retained Nix inputs until separately gated flake removal. Each dependency SHALL have exactly one updater.

#### Scenario: Inspect update configuration

- **WHEN** a maintainer inspects Renovate, target workflow, and central registry configuration
- **THEN** each dependency class has exactly one declared update owner
- **AND** the target repository contains no App credential or scheduled Nix update workflow
- **AND** Renovate's beta Nix manager remains disabled
- **AND** the repository stores no updater App private key and runs no competing Nix scheduler

#### Scenario: Native release-tool pin changes

- **WHEN** a newer npm OpenSpec version is published
- **THEN** Renovate opens no pull request for it
- **AND** the maintainer changes the dependency, refreshes the Nix packaging lock and hashes and runs the synchronization command in one reviewable update that runs the complete cross-system gates
- **AND** the update neither selects a mutable latest runtime nor publishes or upgrades a host

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

The main branch SHALL require the current Linux, macOS, Windows, and shared OpenSpec CI job contexts for all actors, including administrators and automation. When selected by path classification, every native platform SHALL run equivalent formatting, type, dead-code, audit, release-tree/version, behavior/coverage, adapter-freshness, and isolated installed-release checks without Nix. Force-push and branch deletion SHALL remain disabled.

#### Scenario: A required check fails

- **WHEN** an update pull request has a failing required job
- **THEN** GitHub prevents the pull request from merging

#### Scenario: Windows check fails while Unix checks pass

- **WHEN** native Windows CI detects a process, path, hook, or release-gate regression while Linux/macOS jobs pass
- **THEN** branch protection still prevents merge for humans and automation
- **AND** no platform skips the affected observable gate merely because a Unix fixture is unavailable

### Requirement: Deliberate runtime release

Renovate MAY merge minor, patch and lockfile development updates under the shared preset after required checks pass. Plugin behavior, native release-tool pins and retained `llm-agents` changes SHALL require human review, applicable gates and explicit authorization before publication or downstream consumption. Runtime releases SHALL use native marketplace delivery, not Nix runtime pins, wrappers or plugin-package activation.

#### Scenario: Merge a behavior update

- **WHEN** a reviewed dependency update changes runtime behavior
- **THEN** no automation activates it on the workstation before the downstream release procedure succeeds
- **AND** the release is versioned, reviewed and explicitly authorized for publication before nix-config consumes it
- **AND** the downstream host retains its previous deployment until its applicable release checks pass
- **AND** authentication and elevated host operations remain interactive
- **AND** behavior-changing pushes, merges and release tags require explicit authorization

#### Scenario: Verify the new deployment

- **WHEN** isolated installed-release CI verifies a candidate through the native manager
- **THEN** a fresh isolated OMP session observes the advertised version, complete capabilities and always-applied rules in the system prompt
- **AND** no manual fresh-session check on macbook-pro or Korolev is required for routine release acceptance
- **AND** nix-config owns hourly host plugin upgrades independently of release completion
- **AND** no wrapper or Nix runtime-package activation is needed to expose the plugin
- **AND** publication and plugin upgrades do not implicitly update upstream OMP or vice versa

#### Scenario: Official binary CI finishes

- **WHEN** release verification completes with an isolated official OMP binary
- **THEN** Korolev's Tern-managed executable and real OMP state remain unchanged
- **AND** actual host UI acceptance for changed visual behavior remains required and separate from routine installed-release CI evidence

#### Scenario: Safe development update is eligible for preset automerge

- **WHEN** Renovate proposes a minor, patch or lockfile development update
- **THEN** the repository does not override the shared preset's automerge or release-age policy
- **AND** Bun retains its three-day resolution gate
- **AND** a dependency merge does not publish a plugin release or upgrade a host

### Requirement: Version-signalled marketplace releases

Distributed releases SHALL declare the same semantic version in the personal catalog entry and payload manifest. Runtime, generated-adapter, catalog LSP or compatibility changes SHALL bump it in the same reviewed revision. Development/docs-only changes MAY leave it unchanged. The gate SHALL reject mismatches and runtime changes without a newer version. Immutable release tags SHALL identify reviewed commits. Rollback SHALL restore known-good content in a newer reviewed release.

#### Scenario: A newer release is published

- **WHEN** the catalog entry and payload version are raised together and the reviewed release is published
- **THEN** catalog refresh makes the newer personal release available to OMP's version-based update detection
- **AND** explicit user-scoped upgrade installs that advertised version
- **AND** a marketplace metadata version or source commit alone does not replace the personal catalog entry's version signal

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

### Requirement: Upgrade acceptance preserves deliberate state

The release gate SHALL exercise catalog refresh and plugin upgrade to a newer fixture release in a disposable profile. A fresh load SHALL verify the new installed version and complete capabilities without resetting disabled state, selected features or plugin settings. Instructions SHALL distinguish targeted reinstallation from newer-version detection and require refresh before user-scoped target upgrade.

#### Scenario: Upgrade a disposable candidate

- **WHEN** the gate refreshes a candidate catalog to a newer declared version and upgrades `personal@glockyco` in user scope
- **THEN** the installed registry and a fresh capability load use the newer version
- **AND** the gate proves all declared capabilities remain available when the plugin is enabled
- **AND** instructions do not substitute startup notifications or all-plugin partial-success output for release acceptance

#### Scenario: Upgrade an intentionally disabled plugin

- **WHEN** an installed personal plugin is disabled before the gate upgrades it
- **THEN** its disabled state and persisted feature/settings selections remain unchanged
- **AND** the gate does not mistake disabled discovery for missing installed release assets

### Requirement: Single pull request per release

Each plugin runtime release SHALL use one pull request containing the implementation, matching catalog, payload and root manifest version bumps, and its completed archived OpenSpec change. Publication SHALL retain an immutable version tag on the reviewed release commit. Release completion SHALL NOT require a separate archive pull request or routine manual per-host installation, upgrade or fresh-session smoke checks.

#### Scenario: Review a runtime release

- **WHEN** a runtime release pull request is ready to merge
- **THEN** its implementation, matching version bumps, accepted specs and archived change are reviewed together after applicable checks pass
- **AND** no later archive pull request or routine two-host smoke is needed

#### Scenario: Documentation-only update

- **WHEN** a pull request changes documentation or accepted procedure without changing the distributed runtime
- **THEN** its plugin version may remain unchanged
