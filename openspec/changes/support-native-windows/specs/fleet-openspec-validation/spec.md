## MODIFIED Requirements

### Requirement: Every repository holding OpenSpec artifacts is verified

A repository that contains an `openspec/` directory SHALL fail its continuous integration when an artifact is invalid under strict validation, or when an archived change contains an unchecked task.

The same verification SHALL be reproducible on Linux, macOS, and native Windows without Nix or network access once the host's OpenSpec is fetched. Documented local hook commands SHALL require archive-validation support and use the host's CLI without installing a consumer-owned CLI pin. The local result SHALL match CI when the host CLI matches the shared definition's advertised version; a mismatched version SHALL be reported rather than claimed equivalent.

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

#### Scenario: Host-local OpenSpec lacks archive support

- **WHEN** the host CLI's validation help does not advertise `--archived`
- **THEN** the local hook fails explicitly rather than accepting only active validation

#### Scenario: Host and CI versions differ

- **WHEN** a maintainer compares the host's OpenSpec version with the advertised shared-workflow version and they differ
- **THEN** the guidance reports the mismatch and directs correction through host tooling ownership
- **AND** it does not silently download a repository-selected CLI or claim result parity

### Requirement: One definition, consumed rather than copied

This repository SHALL expose portable CI verification through `.github/workflows/openspec.yml` with `on: workflow_call`. A consuming CI job SHALL reference that workflow at a reviewed immutable full commit SHA, not copy its validation commands, flags, or CLI installation. The existing `lib.openspecCheck` SHALL remain operational until nix-config, phd-thesis, and test-generalization have migrated. Consumer local hooks MAY contain only the documented host-local command sequence rather than a second validator implementation.

#### Scenario: The verification changes

- **WHEN** the commands or flags in the shared definition change
- **THEN** a consuming repository picks the change up by updating its reviewed workflow reference or retained flake lock
- **AND** no file describing a private validation implementation is edited in that repository

#### Scenario: A repository adopts the verification

- **WHEN** a repository adopts the shared reusable workflow
- **THEN** it declares a job-level workflow reference and optionally its artifact root
- **AND** it states nothing about which validation commands run in CI

#### Scenario: No repository keeps its own implementation

- **WHEN** consumer CI configurations are searched for the validation commands
- **THEN** they appear only in the shared definition, not in consumer CI implementations
- **AND** documented host-local hooks are not mistaken for an independently owned validator

#### Scenario: Unmigrated Nix consumer still runs

- **WHEN** a named consumer still references `lib.openspecCheck` during the migration period
- **THEN** its strict and archive-completeness check remains available with its existing input lock
- **AND** publishing the portable workflow does not remove that interface

### Requirement: The shared definition owns the pinned version

The shared CI definition SHALL pin the OpenSpec version it runs. A consuming repository SHALL NOT pin the CI CLI itself or depend on a CLI installed outside that verification. Consumers SHALL select the shared workflow revision, not an OpenSpec version input. Host-local commands SHALL use their host-owned installation as a separate documented execution context.

The pinned version SHALL support both validations. A version that cannot check archived task completion SHALL NOT be used, whatever its other merits. The workflow SHALL fail when `openspec validate --help` lacks `--archived`, then run `openspec validate --all --strict --no-interactive` and `openspec validate --archived --strict --no-interactive` without an archive-disable option.

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

#### Scenario: Caller tries to weaken the gate

- **WHEN** a consumer configures a call to the shared workflow
- **THEN** no supported input permits a CLI override, arbitrary commands, changed validation flags, or disabling archived checks

### Requirement: The verification reads only the artifacts

The shared definition SHALL validate the consuming repository's OpenSpec artifacts rather than its unrelated source/build outputs. The reusable workflow SHALL check out the caller's triggering revision and use its optional repository-relative `openspec-root` input, default `.`, as the directory containing `openspec/`. An absent artifact directory or a root outside the caller checkout SHALL fail. Nix artifact-only cache reuse SHALL remain available through the retained flake interface; the reusable workflow SHALL NOT promise content-addressed result reuse for unrelated caller changes.

#### Scenario: A repository carries large unrelated files

- **WHEN** a repository containing large build outputs or documents is verified
- **THEN** only its OpenSpec artifacts are passed to artifact validation

#### Scenario: An unrelated file changes

- **WHEN** a file outside the OpenSpec artifacts changes
- **THEN** the retained Nix interface reuses its artifact-only result
- **AND** the portable CI job may rerun without changing the artifacts or requiring unrelated project dependencies

#### Scenario: Caller uses a nested OpenSpec root

- **WHEN** the caller provides a valid repository-relative `openspec-root` containing `openspec/`
- **THEN** the called workflow validates those artifacts from the caller's triggering checkout, not the workflow publisher's checkout

#### Scenario: Caller supplies an unavailable or escaping root

- **WHEN** the input is absolute, escapes the checkout, or contains no `openspec/`
- **THEN** the workflow fails clearly rather than silently validating nothing or another repository
