## Purpose

Define how the personal OMP plugin receives dependency updates through reviewable pull requests while local development and both CI systems use one Nix-selected toolchain.

## ADDED Requirements

### Requirement: Single Bun toolchain

The repository SHALL select Bun through its locked Nix development shell and SHALL use that executable for local checks and CI on every supported system. It SHALL NOT maintain a second Bun version file or install a separate Bun runtime in CI.

#### Scenario: Compare local and CI execution

- **WHEN** a maintainer and each CI runner execute the documented release gate
- **THEN** all commands resolve Bun from the development shell selected by the same `flake.lock`

### Requirement: Explicit dependency ownership

Renovate SHALL own JavaScript dependencies, lock-file maintenance for those dependencies, and GitHub Actions. The official flake-lock updater SHALL own Nix inputs. Renovate's beta Nix manager SHALL remain disabled so one dependency has one updater.

#### Scenario: Inspect update configuration

- **WHEN** a maintainer inspects Renovate and scheduled workflow configuration
- **THEN** each dependency class has exactly one declared update owner

### Requirement: Review-only flake updates

A weekly and manually dispatchable workflow SHALL update the plugin flake lock and open or refresh a pull request. It SHALL authenticate with a short-lived token from a repository-scoped GitHub App and SHALL NOT merge the pull request.

#### Scenario: Trigger a flake update

- **WHEN** the workflow finds a changed locked input
- **THEN** it creates a pull request whose head commit starts the normal Darwin and Linux CI jobs automatically

#### Scenario: No flake change exists

- **WHEN** all locked inputs are current
- **THEN** the workflow exits successfully without creating an empty pull request

### Requirement: Enforced cross-system checks

The main branch SHALL require the current Darwin and Linux CI job contexts for all actors, including administrators and automation. Force-push and branch deletion SHALL remain disabled.

#### Scenario: A required check fails

- **WHEN** an update pull request has a failing required job
- **THEN** GitHub prevents the pull request from merging

### Requirement: Deliberate runtime release

Automated dependency updates SHALL stop after tested pull-request creation. A plugin behavior or `llm-agents` change SHALL require human review, publication, downstream workstation pin update, activation verification, and the real wrapped OMP smoke.

#### Scenario: Merge a behavior update

- **WHEN** a reviewed dependency update changes runtime behavior
- **THEN** no automation activates it on the workstation before the downstream release procedure succeeds
