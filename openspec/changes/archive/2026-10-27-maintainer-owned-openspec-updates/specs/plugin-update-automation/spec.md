## MODIFIED Requirements

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
