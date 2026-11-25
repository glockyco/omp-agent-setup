## MODIFIED Requirements

### Requirement: Review-only flake updates

A weekly and manually dispatchable central workflow SHALL update the retained plugin flake lock and open or refresh a pull request. It SHALL authenticate with a short-lived GitHub App token scoped to this repository and SHALL NOT merge the pull request. This ownership SHALL remain until a separately accepted flake-removal change deregisters the target.

#### Scenario: Trigger a flake update

- **WHEN** the central workflow finds a changed locked input
- **THEN** it creates a pull request whose head commit starts the normal Linux, Windows, and shared OpenSpec CI jobs automatically

#### Scenario: No flake change exists

- **WHEN** all locked inputs are current
- **THEN** the workflow exits successfully without creating an empty pull request

### Requirement: Enforced cross-system checks

The main branch SHALL require the current Linux, Windows, and shared OpenSpec CI job contexts for all actors, including administrators and automation. When selected by path classification, every native platform SHALL run equivalent formatting, type, dead-code, audit, release-tree/version, behavior/coverage, adapter-freshness, and isolated installed-release checks without Nix. Force-push and branch deletion SHALL remain disabled.

#### Scenario: A required check fails

- **WHEN** an update pull request has a failing required job
- **THEN** GitHub prevents the pull request from merging

#### Scenario: Windows check fails while Unix checks pass

- **WHEN** native Windows CI detects a process, path, hook, or release-gate regression while the Linux job passes
- **THEN** branch protection still prevents merge for humans and automation
- **AND** no platform skips the affected observable gate merely because a Unix fixture is unavailable
