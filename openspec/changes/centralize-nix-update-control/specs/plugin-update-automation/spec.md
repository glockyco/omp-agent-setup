## MODIFIED Requirements

### Requirement: Explicit dependency ownership

Renovate SHALL own JavaScript dependencies, lock-file maintenance for those dependencies, and GitHub Actions. The central dependency automation control plane SHALL own Nix inputs. Renovate's beta Nix manager SHALL remain disabled so one dependency has one updater. The target repository SHALL NOT store the updater App private key or run a competing Nix scheduler.

#### Scenario: Inspect update configuration

- **WHEN** a maintainer inspects Renovate, target workflow, and central registry configuration
- **THEN** each dependency class has exactly one declared update owner
- **AND** the target repository contains no App credential or scheduled Nix update workflow

### Requirement: Review-only flake updates

A weekly and manually dispatchable central workflow SHALL update the plugin flake lock and open or refresh a pull request. It SHALL authenticate with a short-lived GitHub App token scoped to this repository and SHALL NOT merge the pull request.

#### Scenario: Trigger a flake update

- **WHEN** the central workflow finds a changed locked input
- **THEN** it creates a pull request whose head commit starts the normal Darwin and Linux CI jobs automatically

#### Scenario: No flake change exists

- **WHEN** all locked inputs are current
- **THEN** the workflow exits successfully without creating an empty pull request
