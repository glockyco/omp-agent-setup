# fleet-openspec-validation Specification

## Purpose

Define the validation every repository on this workstation applies to its own OpenSpec artifacts, and how this repository supplies that validation as one definition every repository consumes rather than copies.

## Requirements

### Requirement: Every repository holding OpenSpec artifacts is verified

A repository that contains an `openspec/` directory SHALL fail its continuous integration when an artifact is invalid under strict validation, or when an archived change contains an unchecked task.

The same verification SHALL be reproducible on Linux, macOS, and native Windows with a matching host-owned CLI, without Nix or network access.

#### Scenario: Invalid artifact reaches the default branch

- **WHEN** a repository holding OpenSpec artifacts contains an artifact that fails strict validation
- **THEN** its continuous integration fails
- **AND** the failure identifies the artifact

#### Scenario: Change archived with unfinished work

- **WHEN** an archived change in such a repository contains an unchecked task
- **THEN** its continuous integration fails
- **AND** the failure names the change and the count of unchecked tasks

#### Scenario: Reproducing a failure locally

- **WHEN** a maintainer runs the documented host-local checks with the same already-fetched CLI version as CI
- **THEN** the same verification runs without Nix or network access
- **AND** it reports the same result as continuous integration
- **AND** documented hooks require archive-validation support without installing a consumer-owned CLI pin

#### Scenario: Host-local OpenSpec lacks archive support

- **WHEN** the host CLI's validation help does not advertise `--archived`
- **THEN** the local hook fails explicitly rather than accepting only active validation

#### Scenario: Host and CI versions differ

- **WHEN** a maintainer compares the host's OpenSpec version with the advertised shared-workflow version and they differ
- **THEN** the guidance reports the mismatch and directs correction through host tooling ownership
- **AND** it does not silently download a repository-selected CLI or claim result parity

### Requirement: One definition, consumed rather than copied

This repository SHALL expose portable CI verification through `.github/workflows/openspec.yml` with `on: workflow_call`. Consumers SHALL reference a reviewed immutable full commit SHA rather than copy the implementation. The existing `lib.openspecCheck` SHALL remain operational until nix-config, phd-thesis, and test-generalization have migrated.

#### Scenario: The verification changes

- **WHEN** the commands or flags in the shared definition change
- **THEN** a consuming repository picks the change up by updating its reviewed workflow reference or retained flake lock
- **AND** no file describing a private validation implementation is edited in that repository

#### Scenario: A repository adopts the verification

- **WHEN** a repository adopts the shared reusable workflow
- **THEN** it declares a job-level workflow reference and optionally its artifact root
- **AND** it states nothing about which validation commands run in CI
- **AND** it copies no validation commands, flags, or CLI installation

#### Scenario: No repository keeps its own implementation

- **WHEN** consumer CI configurations are searched for the validation commands
- **THEN** they appear only in the shared definition, not in consumer CI implementations
- **AND** documented host-local hooks are not mistaken for an independently owned validator
- **AND** local hooks may contain only the documented host-local command sequence

#### Scenario: Unmigrated Nix consumer still runs

- **WHEN** a named consumer still references `lib.openspecCheck` during the migration period
- **THEN** its strict and archive-completeness check remains available with its existing input lock
- **AND** publishing the portable workflow does not remove that interface

### Requirement: The shared definition owns the pinned version

The shared CI definition SHALL pin an OpenSpec version supporting strict active validation and archived task completion. Consumers SHALL select a workflow revision, not a CLI dependency, external CI installation or version input. Host-local commands SHALL use a separate host-owned installation.

#### Scenario: A consuming repository is inspected

- **WHEN** a consuming repository is searched for an OpenSpec CI CLI dependency
- **THEN** it declares none
- **AND** the version it validates with comes from the shared definition through its reviewed reference or retained flake lock

#### Scenario: Upgrading the version

- **WHEN** the OpenSpec version in the shared definition is raised
- **THEN** each consuming repository adopts it by updating the shared workflow reference or retained flake input
- **AND** no consuming repository is edited to name the new CLI version

#### Scenario: A candidate version lacks the archive check

- **WHEN** a version under consideration does not support validating archived task completion
- **THEN** it is rejected as a source for the shared definition
- **AND** the workflow fails when `openspec validate --help` lacks `--archived`

#### Scenario: The pinned CLI supports complete validation

- **WHEN** the workflow's CLI advertises archive support
- **THEN** it runs `openspec validate --all --strict --no-interactive` and `openspec validate --archived --strict --no-interactive` without an archive-disable option

#### Scenario: Caller tries to weaken the gate

- **WHEN** a consumer configures a call to the shared workflow
- **THEN** no supported input permits a CLI override, arbitrary commands, changed validation flags, or disabling archived checks

### Requirement: The verification reads only the artifacts

The shared definition SHALL validate only the caller's OpenSpec artifacts from its triggering checkout. Its optional repository-relative `openspec-root` input SHALL default to `.` and identify the directory containing `openspec/`. An absent artifact directory or root outside the checkout SHALL fail.

#### Scenario: A repository carries large unrelated files

- **WHEN** a repository containing large build outputs or documents is verified
- **THEN** only its OpenSpec artifacts are passed to artifact validation

#### Scenario: An unrelated file changes

- **WHEN** a file outside the OpenSpec artifacts changes
- **THEN** the retained Nix interface reuses its artifact-only result
- **AND** the portable CI job may rerun without changing the artifacts or requiring unrelated project dependencies
- **AND** only the retained Nix interface promises artifact-only cache reuse, not the reusable workflow

#### Scenario: Caller uses a nested OpenSpec root

- **WHEN** the caller provides a valid repository-relative `openspec-root` containing `openspec/`
- **THEN** the called workflow validates those artifacts from the caller's triggering checkout, not the workflow publisher's checkout

#### Scenario: Caller supplies an unavailable or escaping root

- **WHEN** the input is absolute, escapes the checkout, or contains no `openspec/`
- **THEN** the workflow fails clearly rather than silently validating nothing or another repository

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
